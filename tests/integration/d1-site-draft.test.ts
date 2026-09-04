/** @tier 2 @req REQ-P07, REQ-S06, REQ-W10, REQ-TS07 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import { createDeps } from "@/infrastructure/composition";
import { createD1SiteRepository } from "@/infrastructure/persistence/d1/site-repository";
import { createGetSiteUseCase } from "@/application/usecases/site/read-site";
import {
  type BuildSiteDeps,
  createCreateSiteFromDraftUseCase,
  createGetSiteDraftUseCase,
  createListSiteDraftsUseCase,
  createSaveSiteDraftStepUseCase,
  createStartSiteDraftUseCase,
} from "@/application/usecases/site/build-site";
import { SITE_WIZARD_STEPS } from "@/domain/authoring";
import type { SiteProvisionRequest } from "@/application/ports/authoring";
import type { ActorContext } from "@/domain/shared";
import { domainError, err, markEditorial } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { SAMPLE_SITE_SLUG } from "@/infrastructure/persistence/sample/site-sample-repository";
import { OTHER_WORKSPACE, anOwner } from "../support/actors";
import { recordingAuditLog } from "../support/doubles";
import { readPublicSiteComposition } from "@/presentation/site/public-site-projection";
import { migrationFiles, splitStatements } from "../support/migrations";

/**
 * ブログ作成ウィザードを、**本物の D1 と本物のマイグレーション**で通す結合テスト。
 *
 * --- なぜこれが要るのか ---
 * この保存先を見本から本物へ切り替えた理由は「入れる口（ウィザード）が
 * 既にある」ことだった。入れる口があるということは、
 * **入れたものが読み出せなければ即座に業務が止まる**ということでもある。
 * 単体側（`tests/application/build-site.test.ts`）は覚え書き（メモリ）の
 * 保存先で通しているので、次の 3 つは公開してから初めて分かる:
 *
 *   1. マイグレーション 0006 が 2 つの表を本当に作れるか
 *   2. 13 段階ぶんの回答を JSON 1 列に畳んで、読み直したとき同じ形に戻るか
 *   3. 同じ URL 名で作り直したとき、**既存サイトを変更せず弾く**か
 *
 * 3 は特に、一意索引の付け方を間違えると
 * 「やり直しても永久に通らない失敗」になる。ここで実測する。
 *
 * --- ここで見ないこと ---
 * 段階ごとの入力検証・権限・質問文の網羅は単体側で見る。
 * ここは**下書きから読者向けの 1 本になるまで**だけを見る。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-5（結合テスト）/ REQ-TS07
 */

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

let proxy: Proxy;
let deps: BuildSiteDeps;
let sites: ReturnType<typeof createD1SiteRepository>;
/** 読者側の入口を、作る側と**同じ保存先**から組み立てるための一式。 */
let readerSide: ReturnType<typeof createDeps>;
let migrationBackfill: { readonly count: number; readonly name: string | null };

const owner: ActorContext = anOwner({ workspaceId: SAMPLE_WORKSPACE_ID });

/**
 * 移行の**途中に**値を仕込むために、1 本ずつ流す。
 *
 * 読み方そのもの（並び順・区切り・0 件で投げること）は
 * `tests/support/migrations.ts` に 1 つだけ置いてある。ここで読み直さないのは、
 * 17 ファイルに写した結果、母数を張る側と張らない側の 2 系統に割れていた
 * のと同じことを繰り返さないため。
 *
 * このファイルだけ `migrationStatements()`（全部を平らに繋いだ列）を使えないのは、
 * **移行の前に行を 1 つ入れておかないと確かめられない検査**があるからで、
 * 割り方は共有のものをそのまま使う。
 */
const BACKFILL_MIGRATION = "0042_small_amphibian.sql";


beforeAll(async () => {
  proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  for (const file of migrationFiles()) {
    const name = file.slice(file.lastIndexOf("/") + 1);
    if (name === BACKFILL_MIGRATION) {
      await proxy.env.DB.prepare(
        `INSERT INTO site_blueprints
          (id, workspace_id, slug, name, pattern, blueprint_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          "sb_migration_backfill",
          String(SAMPLE_WORKSPACE_ID),
          "migration-backfill",
          "移行前のブログ",
          "beginner_guide",
          JSON.stringify({ migrationFixture: true }),
        )
        .run();
    }
    for (const statement of splitStatements(readFileSync(file, "utf8"))) {
      await proxy.env.DB.prepare(statement).run();
    }
    if (name === BACKFILL_MIGRATION) {
      const rows = await proxy.env.DB.prepare(
        "select count(*) as count, max(name) as name from site_network_node where site_slug = 'migration-backfill'",
      ).first<{ count: number; name: string | null }>();
      migrationBackfill = rows ?? { count: 0, name: null };
    }
  }
  const db = drizzle(proxy.env.DB, { schema });
  // 分解して組み直すと、商業データの印が落ちる（印は入れ物ごと持ち回る）。
  const all = createDeps({ db });
  // サイト作成は設計図と監査を同じ D1 batch に入れる。
  // BuildSiteDeps の auditLog はその他のユースケース用にだけ残る。
  deps = {
    drafts: all.siteDrafts,
    ids: all.ids,
    auditLog: recordingAuditLog().port,
    now: () => new Date(),
    capacity: { withLease: async (_workspaceId, _kind, mutation) => mutation() },
  };
  sites = createD1SiteRepository(db);
  readerSide = all;
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  // 親だけ消すと、前の試験の他構成要素が一意制約に残る。
  // 本番の取り下げは物理削除しないが、試験間分離では全子要素を初期化する。
  await proxy.env.DB.prepare("DELETE FROM audit_logs WHERE action = 'site.created'").run();
  await proxy.env.DB.prepare("DELETE FROM legal_page").run();
  await proxy.env.DB.prepare("DELETE FROM blog_layout_slot").run();
  await proxy.env.DB.prepare("DELETE FROM blog_layout_band").run();
  await proxy.env.DB.prepare("DELETE FROM site_network_node").run();
  await proxy.env.DB.prepare("DELETE FROM site_retirements").run();
  // 配色も同じ理由で消す。子を 1 種類でも残すと、次の試験が
  // 「前の試験が置いた配色」を自分の結果として読む。
  await proxy.env.DB.prepare("DELETE FROM page_theme_override").run();
  await proxy.env.DB.prepare("DELETE FROM blog_theme").run();
  await proxy.env.DB.prepare("DELETE FROM blog_template").run();
  await proxy.env.DB.prepare("DELETE FROM site_drafts").run();
  await proxy.env.DB.prepare("DELETE FROM site_blueprints").run();
});

/** 13 段階ぶんの答え。中身は最小限で足りる（見るのは往復であって内容ではない）。 */
const ANSWERS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  purpose: { purpose: "はじめて一眼カメラを買う人が、レンズ選びで迷わないようにする" },
  genre: { genre: "カメラ・交換レンズ" },
  audience: {
    targetReader: "一眼カメラを買って半年以内の人",
    searchIntent: "次に買う 1 本をどう選べばよいか知りたい",
  },
  author: {
    uniqueExperience: "同じ被写体を全レンズで撮り比べた作例",
    conclusionStance: "用途ごとに 1 本ずつ挙げる",
  },
  revenue: { revenueModel: "affiliate" },
  pattern: { pattern: "beginner_guide" },
  design: { theme: "indigo-clay" },
  policy: {
    articlePurpose: "用途から候補を 3 本に絞らせる",
    ctaStrategy: "在庫と価格が確認できる販売ページのみ",
  },
  content_plan: {
    evaluationAxis: "焦点距離と最短撮影距離",
    usageScene: "屋内で子どもを撮る",
    comparisonScope: "実売 10 万円以下の交換レンズ",
    internalLinkStrategy: "用途別の案内から個別レビューへ落とす",
  },
};

/** 13 段階すべてに答えた下書きを、本物の保存先の上で作る。 */
async function completeDraft(
  slug: string,
  name = "はじめてのレンズ",
  actor: ActorContext = owner,
): Promise<string> {
  const started = await createStartSiteDraftUseCase(deps).execute(actor, {});
  expect(started.ok).toBe(true);
  if (!started.ok) throw new Error("下書きを始められませんでした");
  const draftId = started.value.draftId;

  const saveStep = createSaveSiteDraftStepUseCase(deps);
  for (const step of SITE_WIZARD_STEPS) {
    if (step === "create") continue;
    const saved = await saveStep.execute(actor, {
      draftId,
      step,
      answers: step === "domain" ? { name, slug } : (ANSWERS[step] ?? {}),
      categoriesText:
        step === "categories"
          ? "prime-lenses / 単焦点レンズ / 明るさで選ぶ 1 本目\nzoom-lenses / ズームレンズ / 交換せずに済ませたい人向け"
          : undefined,
      articleTypes: step === "article_types" ? ["guide", "comparison"] : undefined,
    });
    expect(saved.ok, `${step} の保存に失敗しました`).toBe(true);
  }
  return draftId;
}

/**
 * 1 slug にひも付く作成 Unit of Work の全行。
 * 件数だけでなく値まで比べ、衝突失敗が既存行を書き換えていないことを見る。
 */
async function siteState(slug: string) {
  const [blueprints, nodes, bands, slots, pages, audits] = await Promise.all([
    proxy.env.DB.prepare(
      "select id, workspace_id, slug, name, pattern, blueprint_json from site_blueprints where slug = ? order by id",
    )
      .bind(slug)
      .all(),
    proxy.env.DB.prepare(
      "select id, workspace_id, site_slug, role, parent_slug, name, one_line, position, status, deleted_at from site_network_node where site_slug = ? order by id",
    )
      .bind(slug)
      .all(),
    proxy.env.DB.prepare(
      "select id, workspace_id, site_slug, band, title, enabled, position, item_limit from blog_layout_band where site_slug = ? order by id",
    )
      .bind(slug)
      .all(),
    proxy.env.DB.prepare(
      "select id, workspace_id, site_slug, region, slot_key, title, body, enabled, position from blog_layout_slot where site_slug = ? order by id",
    )
      .bind(slug)
      .all(),
    proxy.env.DB.prepare(
      "select id, workspace_id, site_slug, kind, title, body, status, deleted_at from legal_page where site_slug = ? order by id",
    )
      .bind(slug)
      .all(),
    proxy.env.DB.prepare(
      "select workspace_id, action, target_type, target_id, after_json from audit_logs where action = 'site.created' and target_id = ? order by id",
    )
      .bind(slug)
      .all(),
  ]);
  return {
    blueprints: blueprints.results,
    nodes: nodes.results,
    bands: bands.results,
    slots: slots.results,
    pages: pages.results,
    audits: audits.results,
  };
}

async function expectNoProvisioningFootprint(slug: string, draftId: string): Promise<void> {
  expect(await siteState(slug)).toEqual({
    blueprints: [],
    nodes: [],
    bands: [],
    slots: [],
    pages: [],
    audits: [],
  });
  const draft = await proxy.env.DB.prepare(
    "select created_site_slug as createdSiteSlug, draft_json as draftJson from site_drafts where id = ?",
  )
    .bind(draftId)
    .first<{ createdSiteSlug: string | null; draftJson: string }>();
  expect(draft?.createdSiteSlug).toBeNull();
  expect(JSON.parse(draft?.draftJson ?? "{}").createdSiteSlug).toBeNull();
}

describe("マイグレーションそのもの", () => {
  it("下書きと、作られたブログの表を実際に作る", async () => {
    const tables = await proxy.env.DB.prepare(
      "select name from sqlite_master where type = 'table'",
    ).all<{ name: string }>();
    const names = tables.results.map((r) => r.name);
    expect(names).toContain("site_drafts");
    expect(names).toContain("site_blueprints");
  });

  it("URL 名だけを一意にする（下書きは縛らない）", async () => {
    const blueprintIndexes = await proxy.env.DB.prepare(
      "pragma index_list(site_blueprints)",
    ).all<{ name: string; unique: number }>();
    // 同じ URL 名のブログが 2 本あると、読者がどちらを見ているか決められない。
    const bySlug = blueprintIndexes.results.find((r) => r.name.includes("slug"));
    expect(bySlug).toBeDefined();
    expect(bySlug?.unique).toBe(1);

    const draftIndexes = await proxy.env.DB.prepare("pragma index_list(site_drafts)").all<{
      name: string;
      unique: number;
      origin: string;
    }>();
    // 下書きは重複しても困らない。縛ると「同じ題材で作りかけをもう 1 本」ができなくなる。
    // 主キー（origin = "pk"）は別。行を 1 件に定める役目なので一意で正しい。
    for (const index of draftIndexes.results.filter((r) => r.origin !== "pk")) {
      expect(index.unique, `${index.name} が一意になっています`).toBe(0);
    }
  });

  it("0041 適用前からある blueprint に active network node を1件補填する", () => {
    expect(migrationBackfill).toEqual({ count: 1, name: "移行前のブログ" });
  });
});

describe("下書きから読者向けの 1 本になるまで（1 本の道）", () => {
  it("13 段階の答えが、保存先を往復しても同じ形で戻る", async () => {
    const draftId = await completeDraft("first-lens");

    const view = await createGetSiteDraftUseCase(deps).execute(owner, {
      draftId,
      step: "content_plan",
    });
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    // JSON 1 列に畳んだあと、段階の完了状態が落ちていないこと。
    expect(view.value.incomplete).toHaveLength(0);
    expect(view.value.name).toBe("はじめてのレンズ");
    expect(view.value.slug).toBe("first-lens");
  });

  it("作ると、D1 に実在するブログだけが一覧に載る", async () => {
    const draftId = await completeDraft("first-lens");
    const created = await createCreateSiteFromDraftUseCase(deps).execute(owner, { draftId });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.slug).toBe("first-lens");

    const found = await sites.findBySlug("first-lens");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value?.name).toBe("はじめてのレンズ");

    const listed = await sites.list();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const slugs = listed.value.map((entry) => entry.slug);
    expect(slugs).toContain("first-lens");
    expect(slugs).toEqual(["first-lens"]);
  });

  it("A1: 選んだ見せ方とウィザードの配色を設計図と同時に永続する", async () => {
    const draftId = await completeDraft("appearance-lens");
    const created = await createCreateSiteFromDraftUseCase(deps).execute(owner, {
      draftId,
      templateId: "comparison_focus",
    });
    expect(created.ok, created.ok ? "" : created.error.message).toBe(true);

    const template = await proxy.env.DB.prepare(
      "SELECT template_id FROM blog_template WHERE site_slug = 'appearance-lens'",
    ).first<{ template_id: string }>();
    const theme = await proxy.env.DB.prepare(
      "SELECT workspace_id, brand_theme, color_mode FROM blog_theme WHERE site_slug = 'appearance-lens'",
    ).first<{ workspace_id: string; brand_theme: string; color_mode: string }>();
    expect(template?.template_id).toBe("comparison_focus");
    expect(theme).toEqual({
      workspace_id: String(owner.workspaceId),
      brand_theme: "indigo-clay",
      color_mode: "auto",
    });
  });

  /*
   * 下の 2 件は、以前は見本の保存先の上（単体側）で見ていた。
   * 作ったことを記録に残すようになり、**記録の保存先が無い状態では
   * 作れなくなった**（残せない記録を「残した」ことにしないため）。
   * 見る値は変えずに、保存先が本物のここへ移してある。
   */
  it("読者向けの入口から、D1 に作ったブログを引ける", async () => {
    const draftId = await completeDraft("first-lens");
    const created = await createCreateSiteFromDraftUseCase(deps).execute(owner, { draftId });
    if (!created.ok) throw created.error;

    expect(created.value.readerPath).toBe("/s/first-lens");
    expect(created.value.categoryCount).toBe(2);
    /*
      固定ページは**枠を先に作らない**。作成直後は 0 件で、8 種すべてが
      公開準備の不足として残る（`SITE_PROVISIONING_REQUIRED_COUNTS` の
      `site_documents: 0` / `SITE_CONTENT_REQUIRED_COUNTS` は 8）。
      作成完了と公開準備完了を分けるのがここの主題である。
    */
    expect(created.value.pageCount).toBe(0);
    expect(created.value.counts.site_documents).toBe(0);
    expect(created.value.counts.articles).toBe(0);
    expect(created.value.reachable).toBe(true);
    expect(created.value.provisioningComplete).toBe(true);
    expect(created.value.contentReady).toBe(false);

    const opened = await readerSide.publicBlog.openSite("first-lens");
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value).not.toBeNull();
    const reloaded = await readPublicSiteComposition("first-lens", {
      source: readerSide.publicBlogSource,
      port: readerSide.publicBlog,
    });
    expect(reloaded.ok).toBe(true);
    if (!reloaded.ok) return;
    expect(reloaded.value).not.toBeNull();
    expect(reloaded.value?.counts).toEqual(created.value.counts);
    expect(reloaded.value?.reachable).toBe(created.value.reachable);
    expect(reloaded.value?.provisioningComplete).toBe(created.value.provisioningComplete);
    expect(reloaded.value?.contentReady).toBe(created.value.contentReady);

    // 読者側の入口は、見本のブログと同じユースケース。
    const site = await createGetSiteUseCase({
      sites: readerSide.sites,
      content: readerSide.publishedContent,
    }).execute(owner, { siteSlug: "first-lens" });
    expect(site.ok, "作ったブログが読者向けの経路で見つかりません").toBe(true);
    if (!site.ok) return;
    expect(site.value.blueprint.name).toBe("はじめてのレンズ");
  });

  it("差別化の 10 軸がすべて埋まっている（言い換えブログを作らせない）", async () => {
    const draftId = await completeDraft("third-lens");
    const created = await createCreateSiteFromDraftUseCase(deps).execute(owner, { draftId });
    // 10 軸のどれかが空なら createSiteBlueprint が断る。作れた時点で 10 軸が揃っている。
    expect(created.ok, created.ok ? "" : created.error.message).toBe(true);
  });

  it("同じ作業場所の新規下書きでも、同じ URL 名の既存サイトを変更しない", async () => {
    const first = await completeDraft("first-lens", "はじめてのレンズ");
    const created = await createCreateSiteFromDraftUseCase(deps).execute(owner, {
      draftId: first,
    });
    expect(created.ok).toBe(true);

    const before = await siteState("first-lens");

    // 名前だけ変えて、同じ URL 名でもう一度作る。
    const second = await completeDraft("first-lens", "はじめてのレンズ 改訂版");
    const again = await createCreateSiteFromDraftUseCase(deps).execute(owner, {
      draftId: second,
    });
    expect(again.ok).toBe(false);

    const found = await sites.findBySlug("first-lens");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value?.name).toBe("はじめてのレンズ");

    // 差し替えであって追記ではない（同じ URL 名が 2 行にならない）。
    const rows = await proxy.env.DB.prepare(
      "select count(*) as n from site_blueprints where slug = 'first-lens'",
    ).all<{ n: number }>();
    expect(rows.results[0]?.n).toBe(1);
    expect(await siteState("first-lens")).toEqual(before);
  });

  it("別の作業場所の新規下書きでも、同じ URL 名の既存サイトを変更しない", async () => {
    const first = await completeDraft("shared-lens", "元のサイト");
    const created = await createCreateSiteFromDraftUseCase(deps).execute(owner, { draftId: first });
    if (!created.ok) throw created.error;
    const before = await siteState("shared-lens");

    const outsider = anOwner({ workspaceId: OTHER_WORKSPACE, userId: "user-other-owner" });
    const second = await completeDraft("shared-lens", "他社の新規サイト", outsider);
    const attacked = await createCreateSiteFromDraftUseCase(deps).execute(outsider, {
      draftId: second,
    });

    expect(attacked.ok).toBe(false);
    expect(await siteState("shared-lens")).toEqual(before);
    const secondDraft = await createGetSiteDraftUseCase(deps).execute(outsider, {
      draftId: second,
      step: "create",
    });
    expect(secondDraft.ok).toBe(true);
    if (secondDraft.ok) expect(secondDraft.value.createdSiteSlug).toBeNull();
  });

  it("同じ URL 名を別の作業場所から登録しても、所有者は入れ替わらない", async () => {
    const draftId = await completeDraft("owned-lens", "元の所有者のブログ");
    const created = await createCreateSiteFromDraftUseCase(deps).execute(owner, { draftId });
    if (!created.ok) throw created.error;

    const current = await sites.findBySlug("owned-lens");
    if (!current.ok || current.value === null) throw new Error("登録したブログを読めませんでした");

    const attacked = await deps.drafts.publishBlueprint("owned-lens", {
      ...current.value,
      workspaceId: OTHER_WORKSPACE,
      name: "別の作業場所からの差し替え",
    });

    expect(attacked.ok).toBe(false);
    const rows = await proxy.env.DB.prepare(
      "select workspace_id as workspaceId, name from site_blueprints where slug = 'owned-lens'",
    ).all<{ workspaceId: string; name: string }>();
    expect(rows.results).toEqual([
      { workspaceId: String(owner.workspaceId), name: "元の所有者のブログ" },
    ]);
  });

  it("A1: 別workspaceのslug競合ではappearanceを1行も残さず、ownerの後続保存を妨げない", async () => {
    const draftId = await completeDraft("tenant-appearance", "元の所有者のブログ");
    const created = await createCreateSiteFromDraftUseCase(deps).execute(owner, { draftId });
    if (!created.ok) throw created.error;

    // 攻撃前の条件を明示する。設計図だけがあり、appearanceはまだ無い。
    await proxy.env.DB.prepare(
      "DELETE FROM blog_template WHERE site_slug = 'tenant-appearance'",
    ).run();
    await proxy.env.DB.prepare(
      "DELETE FROM blog_theme WHERE site_slug = 'tenant-appearance'",
    ).run();

    const current = await sites.findBySlug("tenant-appearance");
    if (!current.ok || current.value === null) throw new Error("owner blueprintを読めませんでした");

    const attacked = await deps.drafts.publishBlueprint(
      "tenant-appearance",
      { ...current.value, workspaceId: OTHER_WORKSPACE, name: "攻撃側の差し替え" },
      {
        templateId: "comparison_focus",
        theme: { brandTheme: "graphite-amber", colorMode: "dark" },
      },
    );
    expect(attacked.ok).toBe(false);

    const appearanceCount = async (table: string) =>
      proxy.env.DB.prepare(
        `SELECT count(*) AS n FROM ${table} WHERE site_slug = 'tenant-appearance'`,
      ).first<{ n: number }>();
    expect((await appearanceCount("blog_template"))?.n).toBe(0);
    expect((await appearanceCount("blog_theme"))?.n).toBe(0);
    expect((await appearanceCount("page_theme_override"))?.n).toBe(0);

    const ownerSaved = await deps.drafts.publishBlueprint(
      "tenant-appearance",
      current.value,
      {
        templateId: "comparison_focus",
        theme: { brandTheme: "indigo-clay", colorMode: "auto" },
      },
    );
    expect(ownerSaved.ok).toBe(true);

    const templates = await proxy.env.DB.prepare(
      "SELECT workspace_id FROM blog_template WHERE site_slug = 'tenant-appearance'",
    ).all<{ workspace_id: string }>();
    const themes = await proxy.env.DB.prepare(
      "SELECT workspace_id FROM blog_theme WHERE site_slug = 'tenant-appearance'",
    ).all<{ workspace_id: string }>();
    expect(templates.results).toEqual([{ workspace_id: String(owner.workspaceId) }]);
    expect(themes.results).toEqual([{ workspace_id: String(owner.workspaceId) }]);
  });

  it("取り下げた URL 名も、別の作業場所へ再割り当てしない", async () => {
    const draftId = await completeDraft("retired-lens", "取り下げ前のブログ");
    const created = await createCreateSiteFromDraftUseCase(deps).execute(owner, { draftId });
    if (!created.ok) throw created.error;

    const before = await sites.findBySlug("retired-lens");
    if (!before.ok || before.value === null) throw new Error("登録したブログを読めませんでした");

    const removed = await deps.drafts.removeBlueprint(owner.workspaceId, "retired-lens");
    expect(removed.ok).toBe(true);

    const attacked = await deps.drafts.publishBlueprint("retired-lens", {
      ...before.value,
      workspaceId: OTHER_WORKSPACE,
      name: "別の作業場所が再利用したブログ",
    });

    expect(attacked.ok).toBe(false);
    const rows = await proxy.env.DB.prepare(
      `select b.workspace_id as workspaceId, r.retired_at as retiredAt
       from site_blueprints b
       inner join site_retirements r on r.slug = b.slug
       where b.slug = 'retired-lens'`,
    ).all<{ workspaceId: string; retiredAt: number | null }>();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0]?.workspaceId).toBe(String(owner.workspaceId));
    expect(rows.results[0]?.retiredAt).not.toBeNull();

    const hidden = await sites.findBySlug("retired-lens");
    expect(hidden).toEqual({ ok: true, value: null });
  });

  it("D1 モードの管理一覧に、公開経路で引けない見本を混ぜない", async () => {
    expect(await sites.findBySlug(SAMPLE_SITE_SLUG)).toEqual({ ok: true, value: null });
    expect(await sites.list()).toEqual({ ok: true, value: [] });
  });

  it("作りかけの下書きは、2 本とも一覧に残る", async () => {
    const first = await completeDraft("older-blog", "先に始めたほう");
    const second = await completeDraft("newer-blog", "あとから始めたほう");

    const listed = await createListSiteDraftsUseCase(deps).execute(owner, {});
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    // 並び順（新しい順）はここでは見ない。試験内では 2 本の更新時刻が
    // 同じミリ秒に収まりうるため、たまに落ちる試験になる。
    const ids = listed.value.items.map((draft) => draft.draftId);
    expect(ids).toContain(first);
    expect(ids).toContain(second);
    expect(listed.value.total).toBe(2);
    expect(listed.value.emptyReason).toBeNull();
  });

  it("段階が埋まっていない下書きは作れない（どこが足りないかを言葉で返す）", async () => {
    const started = await createStartSiteDraftUseCase(deps).execute(owner, {});
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const created = await createCreateSiteFromDraftUseCase(deps).execute(owner, {
      draftId: started.value.draftId,
    });
    expect(created.ok).toBe(false);
    if (created.ok) return;
    // 「失敗しました」だけでは直せない。足りない段階の名前が要る。
    expect(created.error.message).toContain("まだ埋まっていない段階があります");
  });
});

describe("D1 batch の原子性", () => {
  const failures = [
    { name: "サイト網", table: "site_network_node", operation: "INSERT", column: "site_slug" },
    { name: "帯の途中", table: "blog_layout_band", operation: "INSERT", column: "site_slug" },
    { name: "枠の途中", table: "blog_layout_slot", operation: "INSERT", column: "site_slug" },
    /*
      「固定ページ」（`legal_page`）はここに無い。作成の batch が空の枠を
      8 行先に作るのをやめたので、作成中にこの表へは 1 行も書かない
      （書くのは運営者が本文を保存したとき＝`site-document-repository`）。
      **書かない表に原子性は無い。**触らない表への trigger を残すと、
      発火しないまま緑になり、原子性を見ていないのに見たつもりになる。
      代わりに、同じ batch に実在する「見せ方」を対象へ入れてある。
    */
    { name: "見せ方", table: "blog_template", operation: "INSERT", column: "site_slug" },
    { name: "下書き完了更新", table: "site_drafts", operation: "UPDATE", column: "created_site_slug" },
    { name: "作成監査", table: "audit_logs", operation: "INSERT", column: "target_id" },
  ] as const;

  it.each(failures)("$name が失敗しても、1 行も作成済みにしない", async (failure) => {
    const slug = `atomic-${failure.table.replaceAll("_", "-")}`;
    const draftId = await completeDraft(slug, `原子性 ${failure.name}`);
    const trigger = `fail_site_creation_${failure.table}`;
    await proxy.env.DB.prepare(
      `CREATE TRIGGER ${trigger} BEFORE ${failure.operation} ON ${failure.table}
       WHEN NEW.${failure.column} = '${slug}'
       BEGIN SELECT RAISE(ABORT, 'forced site creation failure'); END`,
    ).run();
    try {
      const created = await createCreateSiteFromDraftUseCase(deps).execute(owner, { draftId });
      expect(created.ok).toBe(false);
      await expectNoProvisioningFootprint(slug, draftId);
    } finally {
      await proxy.env.DB.prepare(`DROP TRIGGER IF EXISTS ${trigger}`).run();
    }
  });

  it("同一 draft の stale request と最新 request を並行実行しても、最新 slug だけを作る", async () => {
    const draftId = await completeDraft("parallel-old", "並行更新前");
    const captured: SiteProvisionRequest[] = [];
    const captureDeps: BuildSiteDeps = {
      ...deps,
      drafts: markEditorial({
        ...deps.drafts,
        async provisionSite(request) {
          captured.push(request);
          return err(domainError("UPSTREAM_UNAVAILABLE", "capture only"));
        },
      }),
    };

    // 1 本目は作成直前まで進めるが、書き込まず request だけ保持する。
    expect(
      (await createCreateSiteFromDraftUseCase(captureDeps).execute(owner, { draftId })).ok,
    ).toBe(false);

    // 別 request が domain 段階を更新し、新しい slug で作成を始める。
    const renamed = await createSaveSiteDraftStepUseCase(deps).execute(owner, {
      draftId,
      step: "domain",
      answers: { name: "並行更新後", slug: "parallel-new" },
    });
    expect(renamed.ok).toBe(true);
    expect(
      (await createCreateSiteFromDraftUseCase(captureDeps).execute(owner, { draftId })).ok,
    ).toBe(false);
    expect(captured).toHaveLength(2);

    const [oldResult, newResult] = await Promise.all([
      deps.drafts.provisionSite(captured[0]!),
      deps.drafts.provisionSite(captured[1]!),
    ]);

    expect(oldResult.ok).toBe(false);
    expect(newResult.ok).toBe(true);
    expect((await siteState("parallel-old")).blueprints).toEqual([]);
    expect((await siteState("parallel-new")).blueprints).toHaveLength(1);
    const stored = await proxy.env.DB.prepare(
      "select slug, created_site_slug as createdSiteSlug from site_drafts where id = ?",
    )
      .bind(draftId)
      .first<{ slug: string; createdSiteSlug: string | null }>();
    expect(stored).toEqual({ slug: "parallel-new", createdSiteSlug: "parallel-new" });
  });

  it.each(["stale-first", "latest-first"] as const)(
    "slug が同じでも回答 revision が古い create を拒否する（%s）",
    async (order) => {
      const slug = `revision-${order}`;
      const draftId = await completeDraft(slug, "更新前の名前");
      const captured: SiteProvisionRequest[] = [];
      const captureDeps: BuildSiteDeps = {
        ...deps,
        drafts: markEditorial({
          ...deps.drafts,
          async provisionSite(request) {
            captured.push(request);
            return err(domainError("UPSTREAM_UNAVAILABLE", "capture only"));
          },
        }),
      };

      expect(
        (await createCreateSiteFromDraftUseCase(captureDeps).execute(owner, { draftId })).ok,
      ).toBe(false);
      const renamed = await createSaveSiteDraftStepUseCase(deps).execute(owner, {
        draftId,
        step: "domain",
        answers: { name: "更新後の名前", slug },
      });
      expect(renamed.ok).toBe(true);
      const recategorized = await createSaveSiteDraftStepUseCase(deps).execute(owner, {
        draftId,
        step: "categories",
        answers: {},
        categoriesText: "latest / 最新カテゴリー / 最新回答だけを作成に使う",
      });
      expect(recategorized.ok).toBe(true);
      expect(
        (await createCreateSiteFromDraftUseCase(captureDeps).execute(owner, { draftId })).ok,
      ).toBe(false);
      expect(captured).toHaveLength(2);

      const [stale, latest] = captured;
      const first = order === "stale-first" ? stale! : latest!;
      const second = order === "stale-first" ? latest! : stale!;
      const firstResult = await deps.drafts.provisionSite(first);
      const secondResult = await deps.drafts.provisionSite(second);

      if (order === "stale-first") {
        expect(firstResult.ok).toBe(false);
        expect(secondResult.ok).toBe(true);
      } else {
        expect(firstResult.ok).toBe(true);
        expect(secondResult.ok).toBe(false);
      }
      const stored = await sites.findBySlug(slug);
      expect(stored.ok).toBe(true);
      if (!stored.ok) return;
      expect(stored.value?.name).toBe("更新後の名前");
      expect(stored.value?.categories.map((category) => category.slug)).toEqual(["latest"]);
    },
  );

  it("create 完了後に古い save が到着しても、createdSiteSlug を null へ戻さない", async () => {
    const slug = "stale-save-after-create";
    const draftId = await completeDraft(slug, "作成時の名前");
    const stale = await deps.drafts.find(owner.workspaceId, draftId as never);
    expect(stale.ok && stale.value !== null).toBe(true);
    if (!stale.ok || stale.value === null) return;

    const created = await createCreateSiteFromDraftUseCase(deps).execute(owner, { draftId });
    expect(created.ok).toBe(true);
    const overwritten = await deps.drafts.save({
      ...stale.value,
      name: "遅れて到着した保存",
      createdSiteSlug: null,
    });
    expect(overwritten.ok).toBe(false);

    const current = await deps.drafts.find(owner.workspaceId, stale.value.id);
    expect(current.ok).toBe(true);
    if (!current.ok) return;
    expect(current.value?.createdSiteSlug).toBe(slug);
    expect(current.value?.name).toBe("作成時の名前");
  });

  it("同じ revision を読んだ並行 save は片方だけを成功させる", async () => {
    const started = await createStartSiteDraftUseCase(deps).execute(owner, {});
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const firstRead = await deps.drafts.find(owner.workspaceId, started.value.draftId as never);
    const secondRead = await deps.drafts.find(owner.workspaceId, started.value.draftId as never);
    expect(firstRead.ok && firstRead.value !== null).toBe(true);
    expect(secondRead.ok && secondRead.value !== null).toBe(true);
    if (!firstRead.ok || firstRead.value === null || !secondRead.ok || secondRead.value === null) {
      return;
    }

    const [firstSave, secondSave] = await Promise.all([
      deps.drafts.save({ ...firstRead.value, purpose: "並行保存 A" }),
      deps.drafts.save({ ...secondRead.value, purpose: "並行保存 B" }),
    ]);
    expect([firstSave.ok, secondSave.ok].filter(Boolean)).toHaveLength(1);

    const current = await deps.drafts.find(owner.workspaceId, firstRead.value.id);
    expect(current.ok).toBe(true);
    if (!current.ok) return;
    expect(["並行保存 A", "並行保存 B"]).toContain(current.value?.purpose);
  });
});
