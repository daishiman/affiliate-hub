/** @tier 2 @req REQ-SEC09 @types audit-log */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import { createDeps } from "@/infrastructure/composition";
import type { EditorialPublishedContentPort } from "@/application/ports/site";
import type { PublishedArticle } from "@/application/read-models/published-article";
import {
  createAdvanceContentStateUseCase,
  createApproveContentUseCase,
  createListContentBoardUseCase,
  createGetContentUseCase,
} from "@/application/usecases/content/manage-content";
import type { AdvanceContentStateDeps } from "@/application/usecases/content/manage-content";
import type { Publication } from "@/domain/distribution";
import type { ActorContext, ContentPackageId, ContentVariantId } from "@/domain/shared";
import { ok, taggedString } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { anOwner } from "../support/actors";
import { failing } from "../support/doubles";

/**
 * 記事の進行を、**本物の D1 と本物のマイグレーション**で通す結合テスト。
 *
 * --- なぜこれが要るのか ---
 * かんばんの現在地は、これまで**見本データの中にしか存在していなかった**。
 * つなぎ目（ポート）に現在地を保存する手段が無く、段階を進める処理は
 * 遷移の可否だけを見て**何も保存せずに成功を返して**いた。
 * 画面からは「操作が効いていない」のか「保存が壊れている」のかを区別できない。
 *
 * つないだこと自体は、次の 3 つが揃って初めて言える:
 *
 *   1. マイグレーション 0009 が content_variants を実際に作る
 *   2. 組み立てた SQL がその表に対して通る（列の綴り・型が合っている）
 *   3. **進めた段階が読み直せる**（返り値ではなく、読み直しで確かめる）
 *
 * --- ここでいちばん見たいこと ---
 * **本文の保存が現在地を巻き戻さないこと。** 承認は本文を書き換えるので、
 * ここで現在地の既定値を書き込むと、承認するたびに列が先頭へ戻る。
 * 承認したのに列が戻る、は「承認できていない」と読まれる。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-5（結合テスト）/ REQ-TS07
 */

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

let proxy: Proxy;
let deps: AdvanceContentStateDeps;
let publishedContent: EditorialPublishedContentPort;

/** 見本の記事と同じ作業場所にいて、記事の編集と承認ができる人。 */
const editor: ActorContext = anOwner({ workspaceId: SAMPLE_WORKSPACE_ID });

/** 見本の記事。事実確認中（FACT_CHECK）から始まる。 */
const IN_FACT_CHECK = "cv_alpha_review";
/** 表示のきまりを確認中（COMPLIANCE_REVIEW）の見本。承認の出発点になる。 */
const IN_COMPLIANCE = "cv_beta_short";

function migrationStatements(): readonly string[] {
  const dir = path.resolve(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  expect(files.length).toBeGreaterThan(0);
  return files.flatMap((file) =>
    readFileSync(path.join(dir, file), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s !== ""),
  );
}

beforeAll(async () => {
  proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  for (const statement of migrationStatements()) {
    await proxy.env.DB.prepare(statement).run();
  }
  const all = createDeps({ db: drizzle(proxy.env.DB, { schema }) });
  deps = {
    packages: all.contentPackages,
    variants: all.contentVariants,
    personas: all.personas,
    policyRules: all.policyRules,
    auditLog: all.auditLog,
    ids: all.ids,
    events: all.events,
    publications: all.publications,
    articles: all.publishedArticles,
  };
  publishedContent = all.publishedContent;
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM content_variants").run();
  await proxy.env.DB.prepare("DELETE FROM content_packages").run();
  await proxy.env.DB.prepare("DELETE FROM audit_logs").run();
  await proxy.env.DB.prepare("DELETE FROM publications").run();
  await proxy.env.DB.prepare("DELETE FROM published_articles").run();
  await proxy.env.DB.prepare("DELETE FROM published_article_tombstones").run();
  await proxy.env.DB.prepare("DELETE FROM site_blueprints").run();
  await proxy.env.DB.prepare(
    `INSERT INTO site_blueprints
      (id, workspace_id, slug, name, pattern, published_at, blueprint_json)
     VALUES (
       'sb_archive_owner', ?, 'archive-integration-site', '取り下げ検証ブログ',
       'specialist_review', unixepoch(), '{}'
     )`,
  )
    .bind(String(editor.workspaceId))
    .run();
});

/** 承認の理由。空だと承認そのものが断られる（記録に理由が要るため）。 */
const APPROVE_REASON = "根拠と価格の表記を確認したため。";

const advance = () => createAdvanceContentStateUseCase(deps);
const approve = () => createApproveContentUseCase(deps);
const board = () => createListContentBoardUseCase(deps);
const detail = () => createGetContentUseCase(deps);

/** かんばんのどの列にいるかを、保存先ではなく**画面と同じ道**で読む。 */
async function columnOf(variantId: string): Promise<string | null> {
  const view = await board().execute(editor, {});
  expect(view.ok).toBe(true);
  if (!view.ok) return null;
  const found = view.value.columns.find((c) =>
    c.items.some((i) => i.variantId === variantId),
  );
  return found?.state ?? null;
}

describe("マイグレーションそのもの", () => {
  it("記事の表を実際に作り、進行の現在地を同じ行に持つ", async () => {
    const tables = await proxy.env.DB.prepare(
      "select name from sqlite_master where type = 'table'",
    ).all<{ name: string }>();
    expect(tables.results.map((r) => r.name)).toContain("content_variants");

    const columns = await proxy.env.DB.prepare("pragma table_info(content_variants)").all<{
      name: string;
      notnull: number;
    }>();
    const state = columns.results.find((c) => c.name === "state");
    expect(state, "進行の現在地の列がありません").toBeDefined();
    // 現在地を空にできると、どの列にも出ない記事が生まれる。
    expect(state?.notnull).toBe(1);
    const revision = columns.results.find((c) => c.name === "revision");
    expect(revision, "承認済み本文の版を表す列がありません").toBeDefined();
    expect(revision?.notnull).toBe(1);
  });
});

describe("記事本文の版", () => {
  it("本文保存は版を単調増加し、進行状態だけの保存は版を変えない", async () => {
    const id = taggedString<"ContentVariantId">(IN_FACT_CHECK) as ContentVariantId;
    const initial = await deps.variants.findVersionedById(editor.workspaceId, id);
    if (!initial.ok || initial.value === null) throw new Error("見本記事がありません");

    const firstSave = await deps.variants.save({
      ...initial.value.variant,
      body: `${initial.value.variant.body}\n初回の本文変更`,
    });
    if (!firstSave.ok) throw firstSave.error;
    const afterFirst = await deps.variants.findVersionedById(editor.workspaceId, id);
    if (!afterFirst.ok || afterFirst.value === null) throw new Error("保存後の記事がありません");
    expect(afterFirst.value.revision).toBe(initial.value.revision + 1);

    const stateSaved = await deps.variants.saveState(editor.workspaceId, id, "COMPLIANCE_REVIEW");
    if (!stateSaved.ok) throw stateSaved.error;
    const afterState = await deps.variants.findVersionedById(editor.workspaceId, id);
    if (!afterState.ok || afterState.value === null) throw new Error("進行更新後の記事がありません");
    expect(afterState.value.revision).toBe(afterFirst.value.revision);

    const secondSave = await deps.variants.save({
      ...afterState.value.variant,
      disclosure: `${afterState.value.variant.disclosure}（更新）`,
    });
    if (!secondSave.ok) throw secondSave.error;
    const afterSecond = await deps.variants.findVersionedById(editor.workspaceId, id);
    if (!afterSecond.ok || afterSecond.value === null) throw new Error("再保存後の記事がありません");
    expect(afterSecond.value.revision).toBe(afterFirst.value.revision + 1);
  });
});

describe("ブランド限定一覧のページング", () => {
  it("担当外をlimit前に除き、nextCursorも担当記事だけで進める", async () => {
    for (const [id, brandId] of [
      ["cp-scope-outside", "brand-outside"],
      ["cp-scope-allowed-1", "brand-allowed"],
      ["cp-scope-allowed-2", "brand-allowed"],
    ] as const) {
      await proxy.env.DB.prepare(
        `INSERT INTO content_packages
          (id, workspace_id, objective, status, domain_scope, updated_at, package_json)
         VALUES (?, ?, ?, 'researching', 'general', unixepoch(), ?)`,
      )
        .bind(id, String(editor.workspaceId), id, JSON.stringify({ brandId }))
        .run();
    }

    const sample = await deps.variants.findById(
      editor.workspaceId,
      taggedString<"ContentVariantId">(IN_FACT_CHECK) as ContentVariantId,
    );
    if (!sample.ok || sample.value === null) throw new Error("見本記事がありません");
    for (const [id, packageId] of [
      ["cv-scope-outside", "cp-scope-outside"],
      ["cv-scope-allowed-2", "cp-scope-allowed-2"],
      ["cv-scope-allowed-1", "cp-scope-allowed-1"],
    ] as const) {
      const variant = {
        ...sample.value,
        id: taggedString<"ContentVariantId">(id) as ContentVariantId,
        contentPackageId: taggedString<"ContentPackageId">(packageId) as ContentPackageId,
      };
      const saved = await deps.variants.save(variant);
      if (!saved.ok) throw saved.error;
      const state = await deps.variants.saveState(editor.workspaceId, variant.id, "FACT_CHECK");
      if (!state.ok) throw state.error;
    }

    const scope = { brandIds: [taggedString<"BrandId">("brand-allowed")] };
    const first = await deps.variants.listByState(
      editor.workspaceId,
      "FACT_CHECK",
      { limit: 1, cursor: null },
      scope,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.items.map((variant) => String(variant.id))).toEqual([
      "cv-scope-allowed-1",
    ]);
    expect(first.value.nextCursor).toBe("cv-scope-allowed-1");

    const removedCursor = await deps.variants.remove(
      editor.workspaceId,
      taggedString<"ContentVariantId">("cv-scope-allowed-1") as ContentVariantId,
    );
    if (!removedCursor.ok) throw removedCursor.error;
    const insertedBeforeCursor = {
      ...sample.value,
      id: taggedString<"ContentVariantId">("cv-scope-allowed-0") as ContentVariantId,
      contentPackageId: taggedString<"ContentPackageId">(
        "cp-scope-allowed-1",
      ) as ContentPackageId,
    };
    const inserted = await deps.variants.save(insertedBeforeCursor);
    if (!inserted.ok) throw inserted.error;
    const insertedState = await deps.variants.saveState(
      editor.workspaceId,
      insertedBeforeCursor.id,
      "FACT_CHECK",
    );
    if (!insertedState.ok) throw insertedState.error;

    const second = await deps.variants.listByState(
      editor.workspaceId,
      "FACT_CHECK",
      { limit: 1, cursor: first.value.nextCursor },
      scope,
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.items.map((variant) => String(variant.id))).toEqual([
      "cv-scope-allowed-2",
    ]);
    expect(second.value.nextCursor).toBeNull();

    for (const id of ["cv-scope-outside", "cv-scope-allowed-0", "cv-scope-allowed-2"]) {
      const moved = await deps.variants.saveState(
        editor.workspaceId,
        taggedString<"ContentVariantId">(id) as ContentVariantId,
        "REFRESH_DUE",
      );
      if (!moved.ok) throw moved.error;
    }
    const overdue = await deps.variants.listReviewOverdue(
      editor.workspaceId,
      new Date(),
      1,
      scope,
    );
    expect(overdue.ok).toBe(true);
    if (!overdue.ok) return;
    expect(overdue.value.map((variant) => String(variant.id))).toEqual([
      "cv-scope-allowed-0",
    ]);
  });
});

describe("進めた段階が保存される（読み直して確かめる）", () => {
  it("進めた先が、次に読み直したときも残っている", async () => {
    expect(await columnOf(IN_FACT_CHECK)).toBe("FACT_CHECK");

    const moved = await advance().execute(editor, {
      variantId: IN_FACT_CHECK,
      from: "FACT_CHECK",
      to: "COMPLIANCE_REVIEW",
    });
    expect(moved.ok, moved.ok ? "" : moved.error.message).toBe(true);

    // 返り値ではなく**読み直す**。返り値だけを見ると、保存が落ちていても
    // 「進んだ」と読めてしまう。実際、保存を呼んでいなかった頃も成功が返っていた。
    expect(await columnOf(IN_FACT_CHECK)).toBe("COMPLIANCE_REVIEW");

    const rows = await proxy.env.DB.prepare("select state from content_variants where id = ?")
      .bind(IN_FACT_CHECK)
      .all<{ state: string }>();
    expect(rows.results[0]?.state).toBe("COMPLIANCE_REVIEW");
  });

  it("進めても行が増えない（上書きであって、追記ではない）", async () => {
    await advance().execute(editor, {
      variantId: IN_FACT_CHECK,
      from: "FACT_CHECK",
      to: "COMPLIANCE_REVIEW",
    });
    await advance().execute(editor, {
      variantId: IN_FACT_CHECK,
      from: "COMPLIANCE_REVIEW",
      to: "FACT_CHECK",
    });
    const count = await proxy.env.DB.prepare(
      "select count(*) as n from content_variants where id = ?",
    )
      .bind(IN_FACT_CHECK)
      .all<{ n: number }>();
    expect(count.results[0]?.n).toBe(1);
    expect(await columnOf(IN_FACT_CHECK)).toBe("FACT_CHECK");
  });

  it("古い画面から前の段階を指定した操作は、黙って通らず理由が返る", async () => {
    await advance().execute(editor, {
      variantId: IN_FACT_CHECK,
      from: "FACT_CHECK",
      to: "COMPLIANCE_REVIEW",
    });

    // 画面を開いたままの人が、まだ FACT_CHECK にいるつもりで押した場合。
    const stale = await advance().execute(editor, {
      variantId: IN_FACT_CHECK,
      from: "FACT_CHECK",
      to: "GENERATED",
    });
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.error.code).toBe("CONFLICT");
    // 何が起きたのかと、どうすればよいかの両方が要る。
    expect(stale.error.message).toContain("表示のきまりを確認中");
    expect(stale.error.suggestedAction ?? "").not.toBe("");

    // 弾いたのだから、現在地は動いていない。
    expect(await columnOf(IN_FACT_CHECK)).toBe("COMPLIANCE_REVIEW");
  });

  it("進めない先へは進まず、保存先にも書かれない", async () => {
    // 事実確認中から、承認を飛ばして公開へ。
    const jumped = await advance().execute(editor, {
      variantId: IN_FACT_CHECK,
      from: "FACT_CHECK",
      to: "PUBLISHED",
    });
    expect(jumped.ok).toBe(false);

    const rows = await proxy.env.DB.prepare(
      "select count(*) as n from content_variants where id = ?",
    )
      .bind(IN_FACT_CHECK)
      .all<{ n: number }>();
    expect(rows.results[0]?.n).toBe(0);
  });

  it("公開記事を ARCHIVED にすると、監査を残して読者向けの写しを外す", async () => {
    const article: PublishedArticle = {
      slug: "archive-integration",
      siteSlug: "archive-integration-site",
      type: "guide",
      title: "取り下げ経路を確かめる記事",
      summary: "公開した写しが ARCHIVED と一緒に外れることを確かめます。",
      categorySlug: "checks",
      publishedAt: "2026-08-26",
      updatedAt: "2026-08-26",
      author: { slug: "editor", name: "編集者", bio: "検証担当", credentials: [] },
      disclosureRequired: false,
      sections: [],
    };
    expect((await deps.articles.save(editor.workspaceId, article)).ok).toBe(true);
    const publication = {
      id: "pub_own_site",
      workspaceId: editor.workspaceId,
      variantId: IN_FACT_CHECK,
      variantRevision: null,
      channelKind: "own_site",
      connectionId: "conn_own_site",
      state: "PUBLISHED",
      scheduledAt: null,
      idempotencyKey: "archive-integration:key",
      providerIdentity: null,
      attempts: 1,
      externalId: article.slug,
      externalUrl: `/s/${article.siteSlug}/guides/${article.slug}`,
      lastError: null,
      publishedAt: new Date("2026-08-26T00:00:00Z"),
    } as Publication;
    expect((await deps.publications.save(publication)).ok).toBe(true);
    expect(
      (
        await deps.variants.saveState(
          editor.workspaceId,
          IN_FACT_CHECK as ContentVariantId,
          "PUBLISHED",
        )
      ).ok,
    ).toBe(true);

    const archived = await advance().execute(editor, {
      variantId: IN_FACT_CHECK,
      from: "PUBLISHED",
      to: "ARCHIVED",
      reason: "公開内容を見直すため",
    });
    expect(archived.ok, archived.ok ? "" : archived.error.message).toBe(true);

    const found = await publishedContent.findArticle(article.siteSlug, article.slug);
    if (!found.ok) throw new Error("読者向けの記事を読み直せませんでした");
    expect(found.value).toBeNull();
    const audit = await proxy.env.DB.prepare(
      "SELECT action, reason FROM audit_logs WHERE target_id = ?",
    )
      .bind(IN_FACT_CHECK)
      .all<{ action: string; reason: string | null }>();
    expect(audit.results).toContainEqual({
      action: "content.unpublished",
      reason: "公開内容を見直すため",
    });
  });

  it("監査だけ失敗したARCHIVEDを、同じ要求で補記し重複させない", async () => {
    const moved = await deps.variants.saveState(
      editor.workspaceId,
      IN_FACT_CHECK as ContentVariantId,
      "PUBLISHED",
    );
    if (!moved.ok) throw moved.error;

    let rejectNextAppend = true;
    const retryingDeps: AdvanceContentStateDeps = {
      ...deps,
      publications: {
        ...deps.publications,
        async listByVariant() {
          return ok([]);
        },
      },
      auditLog: {
        ...deps.auditLog,
        async append(entry) {
          if (rejectNextAppend) {
            rejectNextAppend = false;
            return failing("監査記録の保存先に一時的に繋がりません。");
          }
          return deps.auditLog.append(entry);
        },
      },
    };
    const useCase = createAdvanceContentStateUseCase(retryingDeps);
    const input = {
      variantId: IN_FACT_CHECK,
      from: "PUBLISHED" as const,
      to: "ARCHIVED" as const,
      reason: "公開内容を見直すため",
    };

    const first = await useCase.execute(editor, input);
    expect(first.ok).toBe(false);
    expect(await columnOf(IN_FACT_CHECK)).toBe("ARCHIVED");

    const resumed = await useCase.execute(editor, input);
    expect(resumed.ok, resumed.ok ? "" : resumed.error.message).toBe(true);
    const repeated = await useCase.execute(editor, input);
    expect(repeated.ok, repeated.ok ? "" : repeated.error.message).toBe(true);

    const audits = await proxy.env.DB.prepare(
      `SELECT action, reason, before_json, after_json
       FROM audit_logs
       WHERE workspace_id = ? AND target_type = 'content_variant' AND target_id = ?`,
    )
      .bind(String(editor.workspaceId), IN_FACT_CHECK)
      .all<{
        action: string;
        reason: string | null;
        before_json: string | null;
        after_json: string | null;
      }>();
    expect(audits.results).toEqual([
      {
        action: "content.unpublished",
        reason: "公開内容を見直すため",
        before_json: JSON.stringify({ state: "PUBLISHED" }),
        after_json: JSON.stringify({ state: "ARCHIVED" }),
      },
    ]);
  });
});

describe("承認が保存される", () => {
  it("承認したものが、読み直しても未承認に戻らない", async () => {
    const done = await approve().execute(editor, { variantId: IN_COMPLIANCE, reason: APPROVE_REASON });
    expect(done.ok, done.ok ? "" : done.error.message).toBe(true);

    const read = await detail().execute(editor, { variantId: IN_COMPLIANCE });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.variant.status).toBe("approved");
  });

  it("承認すると、かんばんの列も承認済みへ動く", async () => {
    expect(await columnOf(IN_COMPLIANCE)).toBe("COMPLIANCE_REVIEW");
    const done = await approve().execute(editor, { variantId: IN_COMPLIANCE, reason: APPROVE_REASON });
    expect(done.ok, done.ok ? "" : done.error.message).toBe(true);
    // 記事は「承認済み」なのに列は「確認中」のまま、という
    // 同じ 1 本について 2 つの答えが見える状態を作らない。
    expect(await columnOf(IN_COMPLIANCE)).toBe("APPROVED");
  });

  /**
   * 承認したことが、実際に保存先へ書かれていること。
   *
   * 受け皿を差し替えた単体テスト（tests/application/manage-content.test.ts）は
   * 「呼ばれたか」までしか見られない。列の名前が 1 つ違うだけで
   * 書き込みは落ちるので、**本物の表に入るところ**はここで見る。
   *
   * 要件 REQ-SEC09 / 種別 audit-log。**印はファイル冒頭にある**
   * （機械が読むのは先頭 40 行だけなので、ここに `@` で書いても読まれない）。
   */
  it("承認したことが、操作の記録として保存先に残る", async () => {
    const done = await approve().execute(editor, {
      variantId: IN_COMPLIANCE,
      reason: APPROVE_REASON,
    });
    expect(done.ok, done.ok ? "" : done.error.message).toBe(true);

    const rows = await proxy.env.DB.prepare(
      "SELECT action, actor_is_ai, target_id, reason FROM audit_logs WHERE action = 'content.approved'",
    ).all<{ action: string; actor_is_ai: number; target_id: string; reason: string }>();
    expect(rows.results.length).toBe(1);
    expect(rows.results[0]?.target_id).toBe(IN_COMPLIANCE);
    // 人が承認したことが、後から読める形で残っている。
    expect(rows.results[0]?.actor_is_ai).toBe(0);
    expect(rows.results[0]?.reason).toBe(APPROVE_REASON);
  });

  it("本文の保存が、進行の現在地を巻き戻さない", async () => {
    await advance().execute(editor, {
      variantId: IN_FACT_CHECK,
      from: "FACT_CHECK",
      to: "COMPLIANCE_REVIEW",
    });
    // 承認は本文を書き換える。ここで現在地の既定値を書き込むと列が先頭へ戻る。
    const done = await approve().execute(editor, { variantId: IN_FACT_CHECK, reason: APPROVE_REASON });
    expect(done.ok, done.ok ? "" : done.error.message).toBe(true);
    expect(await columnOf(IN_FACT_CHECK)).toBe("APPROVED");
  });
});

describe("見本との重ね置き", () => {
  it("まだ 1 本も保存していなくても、かんばんが空にならない", async () => {
    const view = await board().execute(editor, {});
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    // 空だと「まだ作っていない」のか「壊れている」のかを見分けられない。
    expect(view.value.total).toBeGreaterThan(0);
    expect(view.value.emptyReason).toBeNull();
  });

  it("見本を進めても、同じ記事が 2 つの列に並ばない", async () => {
    await advance().execute(editor, {
      variantId: IN_FACT_CHECK,
      from: "FACT_CHECK",
      to: "COMPLIANCE_REVIEW",
    });
    const view = await board().execute(editor, {});
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const appearances = view.value.columns.flatMap((c) =>
      c.items.filter((i) => i.variantId === IN_FACT_CHECK),
    );
    // 重ね方を間違えると、進めた先と元の列の両方に同じ札が出る。
    expect(appearances).toHaveLength(1);
  });
});
