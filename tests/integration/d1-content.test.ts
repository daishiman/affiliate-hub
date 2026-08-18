/** @tier 2 @req REQ-SEC09 @types audit-log */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import { createDeps } from "@/infrastructure/composition";
import {
  createAdvanceContentStateUseCase,
  createApproveContentUseCase,
  createListContentBoardUseCase,
  createGetContentUseCase,
} from "@/application/usecases/content/manage-content";
import type { ManageContentDeps } from "@/application/usecases/content/manage-content";
import type { ActorContext } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { anOwner } from "../support/actors";

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
let deps: ManageContentDeps;

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
  };
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM content_variants").run();
  await proxy.env.DB.prepare("DELETE FROM audit_logs").run();
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
