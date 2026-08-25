/** @tier 2 @req REQ-FB07, REQ-FB08, REQ-FB09, REQ-FB10, REQ-FB12, REQ-TM09, REQ-TS07 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import { createHandOffFeedbackUseCase } from "@/application/usecases/feedback/hand-off-feedback";
import { createListFeedbackUseCase } from "@/application/usecases/feedback/list-feedback";
import { createManageIntegrationKeysUseCase } from "@/application/usecases/feedback/manage-integration-keys";
import { createReadFeedbackUseCase } from "@/application/usecases/feedback/read-feedback";
import { createSubmitFeedbackUseCase } from "@/application/usecases/feedback/submit-feedback";
import { createUpdateFeedbackStatusUseCase } from "@/application/usecases/feedback/update-feedback-status";
import type { AppDeps } from "@/application/deps";
import * as schema from "@/db/schema";
import { DIAGNOSTICS_RETENTION_DAYS } from "@/domain/feedback";
import type { ActorContext } from "@/domain/shared";
import { createDeps } from "@/infrastructure/composition";
import {
  createD1FeedbackDiagnosticsPurge,
  purgeExpiredFeedbackDiagnostics,
  runFeedbackDiagnosticsPurge,
} from "@/infrastructure/platform/feedback-diagnostics-purge";
import { createD1FeedbackRepository } from "@/infrastructure/persistence/d1/feedback-repository";
import { OTHER_WORKSPACE, WORKSPACE, anOwner } from "../support/actors";

/**
 * 改善要望と取得用の鍵を、**本物の D1 と本物のマイグレーション**で通す結合テスト。
 *
 * --- なぜこれが要るのか ---
 * ここまで、改善要望の保存先は「この実行中だけ覚える」仮置きだった。
 * 仮置きのままでは、次の 3 つが**公開してから初めて分かる**:
 *
 *   1. マイグレーションが、その表を本当に作れるか
 *   2. 組み立てた SQL が、その表に対して本当に通るか
 *   3. 日付や入れ子の項目が、保存して読み戻したあとも同じ形か
 *
 * 3 つ目はこの文脈に固有である。改善要望は履歴・払い出し・技術情報という
 * 入れ子を持ち、それを 1 列の文字列にまとめて保存している。
 * `Date` は文字列になって戻るので、戻し忘れると**並べ替えだけが静かに壊れる**。
 * 見た目には日付が出ているので、目で見ても気づけない。
 *
 * `drizzle/*.sql` をそのまま流し込む。手で書いた CREATE TABLE は使わない。
 * 手で書くと、マイグレーションが壊れていてもテストだけが通る。
 *
 * --- ここで見ないこと ---
 * 入力検証・権限・文面の組み立ては単体側で見る。
 * ここは**保存して読み戻したときに同じものが返ること**だけを見る。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-5（結合テスト）
 */

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

let proxy: Proxy;
let deps: AppDeps;

const owner: ActorContext = anOwner({ workspaceId: WORKSPACE });
/** 別の作業場所の人。**他社の要望が見えないこと**を確かめるためだけに居る。 */
const otherOwner: ActorContext = anOwner({ workspaceId: OTHER_WORKSPACE });

/** マイグレーションの本文を、実行できる単位に割る。 */
function migrationStatements(): readonly string[] {
  const dir = path.resolve(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  // 1 件も読めていないのに緑になるのが最悪なので、そこだけ先に落とす。
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
    // 手元のファイルに残すと、前回の実行結果が次の実行に混ざる。
    persist: false,
  });
  for (const statement of migrationStatements()) {
    await proxy.env.DB.prepare(statement).run();
  }
  deps = createDeps({ db: drizzle(proxy.env.DB, { schema }) });
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM feedback_reports").run();
  await proxy.env.DB.prepare("DELETE FROM integration_key_usages").run();
  await proxy.env.DB.prepare("DELETE FROM integration_keys").run();
});

const submit = (now = new Date("2026-08-17T03:00:00Z")) =>
  createSubmitFeedbackUseCase({
    repository: deps.feedback,
    captures: deps.feedbackCaptures,
    ids: deps.ids,
    // 記録も本物の保存先を使う。差し替えると、この段でしか出ない
    // 「記録は書けるが要望が書けない」ような食い違いを見逃す。
    auditLog: deps.auditLog,
    now: () => now,
  });
const list = () => createListFeedbackUseCase({ repository: deps.feedback });
const read = () => createReadFeedbackUseCase({ repository: deps.feedback, captures: deps.feedbackCaptures });
const updateStatus = (now = new Date("2026-08-17T04:00:00Z")) =>
  createUpdateFeedbackStatusUseCase({
    repository: deps.feedback,
    ids: deps.ids,
    auditLog: deps.auditLog,
    now: () => now,
  });
const handOff = (now = new Date("2026-08-17T05:00:00Z")) =>
  createHandOffFeedbackUseCase({
    repository: deps.feedback,
    templates: deps.handoffTemplates,
    ids: deps.ids,
    auditLog: deps.auditLog,
    now: () => now,
  });
const keys = (now = new Date("2026-08-17T06:00:00Z")) =>
  createManageIntegrationKeysUseCase({
    keys: deps.integrationKeys,
    ids: deps.ids,
    mintSecret: deps.mintSecret,
    now: () => now,
    auditLog: deps.auditLog,
  });

/** 送信の入力ひな型。試験ごとに変えたいところだけ上書きする。 */
function aSubmission(over: Partial<Parameters<ReturnType<typeof submit>["execute"]>[1]> = {}) {
  return {
    kind: "hard_to_use" as const,
    body: "順位表の並び替えが、押しても効いているのか分かりません。",
    wish: "いまどの列で並んでいるのかを出してほしいです。",
    origin: {
      screenName: "順位表",
      url: "https://example.invalid/admin/rankings",
      route: "/admin/rankings",
      viewportWidth: 1440,
      viewportHeight: 900,
    },
    technical: {
      jsErrors: ["TypeError: Cannot read properties of null"],
      failedRequests: ["/api/rankings"],
      userAgent: "test-agent",
      recentActions: ["画面を開いた", "並び替えを押した"],
      redactedCount: 2,
    },
    ...over,
  };
}

async function submitOne(
  actor: ActorContext = owner,
  over: Parameters<typeof aSubmission>[0] = {},
  submittedAt?: Date,
): Promise<string> {
  const result = await submit(submittedAt).execute(actor, aSubmission(over));
  expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
  if (!result.ok) throw new Error("送信できていません");
  return result.value.reportId;
}

describe("マイグレーションそのもの", () => {
  it("改善要望と鍵の表を実際に作る", async () => {
    const tables = await proxy.env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    ).all<{ name: string }>();
    const names = tables.results.map((r) => r.name);
    expect(names).toContain("feedback_reports");
    expect(names).toContain("integration_keys");
    expect(names).toContain("integration_key_usages");
  });

  it("鍵の潰した値には一意の索引が付いている", async () => {
    // ここだけは一意にしてよい。同じ潰した値が 2 つ出るのは事故しか意味しない。
    const indexes = await proxy.env.DB.prepare(
      "SELECT name, \"unique\" FROM pragma_index_list('integration_keys')",
    ).all<{ name: string; unique: number }>();
    const hashed = indexes.results.find((r) => r.name === "integration_keys_hashed_value_idx");
    expect(hashed?.unique).toBe(1);
  });

  it("改善要望の本文には一意制約が無い（同じことを 2 回書ける）", async () => {
    // 同じ人が同じことを 2 回書くのは普通に起こる。保存先で弾くと、
    // 2 回目が**やり直しても永久に通らない失敗**になる。
    const first = await submitOne();
    const second = await submitOne();
    expect(first).not.toBe(second);
    const listed = await list().execute(owner, {});
    expect(listed.ok && listed.value.rows.length).toBe(2);
  });
});

describe("保存して読み戻す", () => {
  it("送った要望が、詳細画面でそのまま読める", async () => {
    const id = await submitOne();
    const detail = await read().execute(owner, { id });
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.body).toContain("並び替え");
    expect(detail.value.screenName).toBe("順位表");
  });

  it("日付が日付のまま戻る（文字列になっていない）", async () => {
    // ここが崩れると、画面には日付が出ているのに並べ替えだけが文字列の
    // 大小で行われる。目で見ても気づけないので、機械で押さえる。
    await submitOne();
    const listed = await list().execute(owner, {});
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.rows[0].submittedAt).toBeInstanceOf(Date);
    expect(listed.value.rows[0].submittedAt.toISOString()).toBe("2026-08-17T03:00:00.000Z");
  });

  it("入れ子の技術情報が、件数まで含めて戻る", async () => {
    const id = await submitOne();
    const detail = await read().execute(owner, { id });
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    // 伏せた件数は 0 でないときに画面へ出る。ここが 0 に戻ると、
    // 「一部を伏せました」の案内が黙って消える。
    expect(detail.value.redactedCount).toBeGreaterThanOrEqual(2);
    expect(detail.value.jsErrorCount).toBe(1);
  });

  it("悪性 payload は D1 の JSON 列にも監査記録にも残らない", async () => {
    const secret = "d1-secret-token-987";
    await submitOne(owner, {
      origin: {
        screenName: `user@example.test ${secret}`,
        url: `https://example.invalid/admin/rankings?token=${secret}#private`,
        route: `/admin/rankings?email=user@example.test#${secret}`,
        viewportWidth: 1280,
        viewportHeight: 900,
      },
      technical: {
        jsErrors: [`TypeError: ${secret}`],
        failedRequests: [`500 https://example.invalid/api/rankings?token=${secret}`],
        userAgent: `user@example.test ${secret}`,
        recentActions: [`「user@example.test ${secret}」を押した`],
        redactedCount: 0,
      },
    });

    const stored = await proxy.env.DB.prepare(
      "SELECT origin_json AS originJson, technical_json AS technicalJson FROM feedback_reports LIMIT 1",
    ).first<{ originJson: string; technicalJson: string }>();
    const audit = await proxy.env.DB.prepare(
      "SELECT before_json AS beforeJson, after_json AS afterJson FROM audit_logs WHERE action = 'feedback.submitted' ORDER BY occurred_at DESC LIMIT 1",
    ).first<{ beforeJson: string | null; afterJson: string | null }>();
    const persisted = JSON.stringify({ stored, audit });
    expect(persisted).not.toContain(secret);
    expect(persisted).not.toContain("user@example.test");
    expect(stored?.originJson).not.toContain("?");
    expect(stored?.originJson).not.toContain("#");
  });

  it("履歴が積み上がったまま戻る（上書きで消えない）", async () => {
    // 届いた時点で 1 行目（「改善要望が届きました。」）が積まれている。
    // 数え始めが 0 でないのは、後から見たときに
    // 「いつ届いたか」を履歴だけで追えるようにするためである。
    const id = await submitOne();
    const first = await updateStatus().execute(owner, { id, status: "in_progress" });
    expect(first.ok && first.value.historyCount).toBe(2);
    const second = await updateStatus(new Date("2026-08-17T04:30:00Z")).execute(owner, {
      id,
      status: "resolved",
      note: "直しました",
    });
    expect(second.ok && second.value.historyCount).toBe(3);

    const detail = await read().execute(owner, { id });
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.history.length).toBe(3);
    expect(detail.value.history[0].summary).toContain("届きました");
    expect(detail.value.history[0].at).toBeInstanceOf(Date);
  });

  it("払い出しの記録が残り、次の一覧で「渡した」と分かる", async () => {
    const id = await submitOne();
    const handed = await handOff().execute(owner, { ids: [id], route: "copied_by_human" });
    expect(handed.ok, handed.ok ? "" : handed.error.message).toBe(true);

    const listed = await list().execute(owner, { handedOff: true });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.rows.map((r) => r.id)).toEqual([id]);
    expect(listed.value.rows[0].handoffCount).toBe(1);
    expect(listed.value.rows[0].lastHandoffAt).toBeInstanceOf(Date);
  });
});

describe("一覧の絞り込み", () => {
  it("状態で絞れる", async () => {
    const a = await submitOne();
    await submitOne();
    await updateStatus().execute(owner, { id: a, status: "in_progress" });

    const listed = await list().execute(owner, { statuses: ["in_progress"] });
    expect(listed.ok && listed.value.rows.map((r) => r.id)).toEqual([a]);
  });

  it("画面で絞れる", async () => {
    await submitOne();
    const other = await submitOne(owner, {
      origin: {
        screenName: "リンクの受信箱",
        url: "https://example.invalid/admin/links/inbox",
        route: "/admin/links/inbox",
        viewportWidth: 1440,
        viewportHeight: 900,
      },
    });
    const listed = await list().execute(owner, { route: "/admin/links/inbox" });
    expect(listed.ok && listed.value.rows.map((r) => r.id)).toEqual([other]);
  });

  it("まだ何も決めていないものが、既定の一覧から消えない", async () => {
    // 廃棄の除外を SQL の `!= 'discarded'` で書くと、まだ何も決めていない
    // （NULL の）行が落ちる。**新着が既定の一覧から消える**という、
    // 最も気づきにくい壊れ方になるので、ここで押さえる。
    const untouched = await submitOne();
    const discarded = await submitOne();
    await updateStatus().execute(owner, {
      id: discarded,
      disposition: { kind: "discarded", reason: "誤って送信したため" },
    });

    const listed = await list().execute(owner, {});
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.rows.map((r) => r.id)).toEqual([untouched]);

    const withDiscarded = await list().execute(owner, { includeDiscarded: true });
    expect(withDiscarded.ok && withDiscarded.value.rows.length).toBe(2);
  });

  it("0 件のときに理由が返る", async () => {
    const listed = await list().execute(owner, { route: "/admin/nowhere" });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.rows).toEqual([]);
    expect(listed.value.emptyReason).toContain("この絞り込み");
  });
});

describe("作業場所の境目", () => {
  it("別の作業場所からは一覧に出ない", async () => {
    await submitOne();
    const listed = await list().execute(otherOwner, {});
    expect(listed.ok && listed.value.rows).toEqual([]);
  });

  it("別の作業場所からは、id を知っていても開けない", async () => {
    // 「無い」と答える。存在の有無そのものも漏らさない。
    const id = await submitOne();
    const detail = await read().execute(otherOwner, { id });
    expect(detail.ok).toBe(false);
  });
});

describe("取りに来るときの鍵", () => {
  it("発行すると平文が 1 度だけ返り、保存先には潰した値しか入らない", async () => {
    const issued = await keys().execute(owner, {
      action: "issue",
      label: "Claude Code 用",
      scopes: ["read"],
    });
    expect(issued.ok, issued.ok ? "" : issued.error.message).toBe(true);
    if (!issued.ok) return;
    const plain = issued.value.issuedValue;
    expect(plain).not.toBeNull();

    // 保存先の全列を舐めて、平文がどこにも無いことを確かめる。
    // 「気をつける」ではなく、機械で毎回見る。
    const rows = await proxy.env.DB.prepare("SELECT * FROM integration_keys").all();
    const dump = JSON.stringify(rows.results);
    expect(dump).not.toContain(plain);

    // 2 度目の一覧には平文が出ない。
    const listed = await keys().execute(owner, { action: "list" });
    expect(listed.ok && listed.value.issuedValue).toBeNull();
    expect(listed.ok && listed.value.rows.length).toBe(1);
  });

  it("発行した平文で、その鍵を突き止められる", async () => {
    const issued = await keys().execute(owner, {
      action: "issue",
      label: "Claude Code 用",
      scopes: ["read"],
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok || issued.value.issuedValue === null) return;

    const found = await deps.integrationKeys.authenticate(issued.value.issuedValue);
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value?.label).toBe("Claude Code 用");
  });

  it("知らない値では、見つからないという同じ形で返る", async () => {
    const found = await deps.integrationKeys.authenticate("x".repeat(40));
    expect(found.ok && found.value).toBeNull();
  });

  it("失効させても行は消えない（いつ止めたかが残る）", async () => {
    const issued = await keys().execute(owner, {
      action: "issue",
      label: "使わなくなった鍵",
      scopes: ["read"],
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    const id = issued.value.rows[0].id;

    const revoked = await keys(new Date("2026-08-17T07:00:00Z")).execute(owner, {
      action: "revoke",
      id,
    });
    expect(revoked.ok).toBe(true);
    if (!revoked.ok) return;
    expect(revoked.value.rows.length).toBe(1);
    expect(revoked.value.rows[0].revoked).toBe(true);
  });

  it("回数の上限を、保存先の記録から数える", async () => {
    const issued = await keys().execute(owner, {
      action: "issue",
      label: "回数の少ない鍵",
      scopes: ["read"],
      rateLimitPerMinute: 2,
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    const listed = await deps.integrationKeys.list(WORKSPACE);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const key = listed.value[0];

    const now = new Date("2026-08-17T06:00:30Z");
    expect((await deps.integrationKeys.withinRateLimit(key.id, now)).ok).toBe(true);

    for (let i = 0; i < 2; i += 1) {
      const recorded = await deps.integrationKeys.recordUsage(WORKSPACE, {
        keyId: key.id,
        keyLabel: key.label,
        at: new Date(now.getTime() + i * 1000),
        fetchedCount: 1,
      });
      expect(recorded.ok, recorded.ok ? "" : recorded.error.message).toBe(true);
    }

    const after = await deps.integrationKeys.withinRateLimit(
      key.id,
      new Date(now.getTime() + 3000),
    );
    expect(after.ok && after.value, "上限を超えたのに通っています").toBe(false);

    // 1 分より前の記録は数に入らない。ここを見ないと、
    // 一度でも上限に達した鍵が永久に使えなくなる。
    const muchLater = await deps.integrationKeys.withinRateLimit(
      key.id,
      new Date(now.getTime() + 120_000),
    );
    expect(muchLater.ok && muchLater.value).toBe(true);
  });

  it("別の作業場所の鍵は一覧に出ない", async () => {
    await keys().execute(owner, { action: "issue", label: "こちらの鍵", scopes: ["read"] });
    const listed = await keys().execute(otherOwner, { action: "list" });
    expect(listed.ok && listed.value.rows).toEqual([]);
  });
});


const DAY_MS = 24 * 60 * 60 * 1000;
/** 掃除を流す時刻。ここを基準に「いつ届いたか」を決める。 */
const PURGE_NOW = new Date("2026-08-17T17:00:00Z");

function submittedDaysBefore(days: number): Date {
  return new Date(PURGE_NOW.getTime() - days * DAY_MS);
}

async function storedTechnical(id: string): Promise<{
  jsErrors: string[];
  failedRequests: string[];
  recentActions: string[];
  userAgent: string;
  redactedCount: number;
  purgedAt: string | null;
}> {
  const row = await proxy.env.DB.prepare(
    "SELECT technical_json AS technicalJson FROM feedback_reports WHERE id = ?",
  )
    .bind(id)
    .first<{ technicalJson: string }>();
  return JSON.parse(String(row?.technicalJson));
}

describe("技術情報の保存期間（定期実行）", () => {
  beforeEach(async () => {
    // 記録の表は共有なので、この段の検査に前の段の行が混ざらないよう先に消す。
    await proxy.env.DB.prepare("DELETE FROM audit_logs WHERE action = ?")
      .bind("feedback.diagnostics_purged")
      .run();
  });

  it("期限の 1 日手前では、何も消さない", async () => {
    const id = await submitOne(owner, {}, submittedDaysBefore(DIAGNOSTICS_RETENTION_DAYS - 1));
    const result = await runFeedbackDiagnosticsPurge(proxy.env.DB, PURGE_NOW);
    expect(result.failures).toEqual([]);
    expect(result.purged).toBe(0);

    const technical = await storedTechnical(id);
    expect(technical.jsErrors.length).toBe(1);
    expect(technical.purgedAt).toBeNull();
  });

  it("期限ちょうどで、技術情報だけが消える（要望は残る）", async () => {
    const id = await submitOne(owner, {}, submittedDaysBefore(DIAGNOSTICS_RETENTION_DAYS));
    // 伏せた件数は、送信時の申告ではなく**保存側が数え直した値**である
    // （入口の申告は見ない）。消す前の実物と突き合わせる。
    const before = await storedTechnical(id);
    expect(before.redactedCount).toBeGreaterThan(0);

    const result = await runFeedbackDiagnosticsPurge(proxy.env.DB, PURGE_NOW);
    expect(result.failures).toEqual([]);
    expect(result.purged).toBe(1);

    const technical = await storedTechnical(id);
    expect(technical.jsErrors).toEqual([]);
    expect(technical.failedRequests).toEqual([]);
    expect(technical.recentActions).toEqual([]);
    expect(technical.userAgent).toBe("");
    // 伏せた件数と消した時刻は残す。ここまで消すと、後から
    // 「本当に伏せていたのか」を問われたときに答えられない。
    expect(technical.redactedCount).toBe(before.redactedCount);
    expect(technical.purgedAt).not.toBeNull();

    // 声そのものは消さない。90 日経っても、届いた事実は無かったことにならない。
    const detail = await read().execute(owner, { id });
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.body).toContain("並び替え");
    expect(detail.value.screenName).toBe("順位表");
    expect(detail.value.history.length).toBeGreaterThan(0);
    expect(detail.value.diagnosticsPurged).toBe(true);
    expect(detail.value.diagnosticsPurgedAt).toBeInstanceOf(Date);
  });

  it("期限を 1 日過ぎたものも、当然消える", async () => {
    const id = await submitOne(owner, {}, submittedDaysBefore(DIAGNOSTICS_RETENTION_DAYS + 1));
    await runFeedbackDiagnosticsPurge(proxy.env.DB, PURGE_NOW);
    expect((await storedTechnical(id)).purgedAt).not.toBeNull();
  });

  it("期限内のものは、同じ作業場所にあっても巻き添えにならない", async () => {
    const old = await submitOne(owner, {}, submittedDaysBefore(DIAGNOSTICS_RETENTION_DAYS + 5));
    const fresh = await submitOne(owner, {}, submittedDaysBefore(1));
    const result = await runFeedbackDiagnosticsPurge(proxy.env.DB, PURGE_NOW);
    expect(result.purged).toBe(1);
    expect((await storedTechnical(old)).purgedAt).not.toBeNull();
    expect((await storedTechnical(fresh)).purgedAt).toBeNull();
    expect((await storedTechnical(fresh)).jsErrors.length).toBe(1);
  });

  it("他の作業場所の期限内のものを、巻き添えで消さない", async () => {
    // 定期実行は「誰の分か」を持たない。絞りを 1 か所外すと、
    // ここが他社の期限内の記録まで消すことになる。
    const mine = await submitOne(owner, {}, submittedDaysBefore(DIAGNOSTICS_RETENTION_DAYS));
    const theirs = await submitOne(otherOwner, {}, submittedDaysBefore(1));
    const result = await runFeedbackDiagnosticsPurge(proxy.env.DB, PURGE_NOW);
    expect(result.purged).toBe(1);
    expect((await storedTechnical(mine)).purgedAt).not.toBeNull();
    expect((await storedTechnical(theirs)).purgedAt).toBeNull();
  });

  it("作業場所をまたいで、期限切れは全部消える", async () => {
    // 上と対で見る。片方だけだと「1 社しか回っていない」でも緑になる。
    const mine = await submitOne(owner, {}, submittedDaysBefore(DIAGNOSTICS_RETENTION_DAYS));
    const theirs = await submitOne(otherOwner, {}, submittedDaysBefore(DIAGNOSTICS_RETENTION_DAYS));
    const result = await runFeedbackDiagnosticsPurge(proxy.env.DB, PURGE_NOW);
    expect(result.workspaces).toBe(2);
    expect(result.purged).toBe(2);
    expect((await storedTechnical(mine)).purgedAt).not.toBeNull();
    expect((await storedTechnical(theirs)).purgedAt).not.toBeNull();
  });

  it("同じ時刻の期限切れが上限を超えても、次の回で残りへ進んで完了する", async () => {
    const seed = await submitOne(
      owner,
      {},
      submittedDaysBefore(DIAGNOSTICS_RETENTION_DAYS),
    );
    // 本番の上限500件と同じ分岐を、上限2件・合計3件へ縮約する。
    // 全件を完全な同着にして、時刻だけでは順序が決まらない境界も固定する。
    await proxy.env.DB.prepare(`
      WITH RECURSIVE clones(n) AS (
        SELECT 1
        UNION ALL
        SELECT n + 1 FROM clones WHERE n < 2
      )
      INSERT INTO feedback_reports (
        id, workspace_id, brand_id, site_id, kind, body, wish, route,
        origin_json, technical_json, capture_id, submitted_by, submitted_at,
        status, disposition_kind, disposition_json, handoff_count, handoff_json,
        beads_issue_id, history_json
      )
      SELECT
        'retention-bulk-' || printf('%03d', clones.n),
        seed.workspace_id, seed.brand_id, seed.site_id, seed.kind, seed.body,
        seed.wish, seed.route, seed.origin_json, seed.technical_json,
        seed.capture_id, seed.submitted_by, seed.submitted_at, seed.status,
        seed.disposition_kind, seed.disposition_json, seed.handoff_count,
        seed.handoff_json, seed.beads_issue_id, seed.history_json
      FROM feedback_reports AS seed
      CROSS JOIN clones
      WHERE seed.id = ?
    `)
      .bind(seed)
      .run();

    const repository = createD1FeedbackRepository(drizzle(proxy.env.DB, { schema }), {
      diagnosticsPurgeLimit: 2,
    });
    const first = await repository.purgeExpiredDiagnostics(WORKSPACE, PURGE_NOW);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value).toEqual({ purged: 2, finished: false });

    const second = await repository.purgeExpiredDiagnostics(WORKSPACE, PURGE_NOW);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value).toEqual({ purged: 1, finished: true });

    const remaining = await proxy.env.DB.prepare(
      "SELECT COUNT(*) AS count FROM feedback_reports WHERE workspace_id = ? AND json_extract(technical_json, '$.purgedAt') IS NULL",
    )
      .bind(String(WORKSPACE))
      .first<{ count: number }>();
    expect(remaining?.count).toBe(0);
  });

  it("2 度流しても、消した時刻が書き換わらない", async () => {
    const id = await submitOne(owner, {}, submittedDaysBefore(DIAGNOSTICS_RETENTION_DAYS));
    await runFeedbackDiagnosticsPurge(proxy.env.DB, PURGE_NOW);
    const first = (await storedTechnical(id)).purgedAt;

    const later = new Date(PURGE_NOW.getTime() + 30 * DAY_MS);
    const second = await runFeedbackDiagnosticsPurge(proxy.env.DB, later);
    // 消し済みは数に入らない。数えると、毎晩「消しました」の記録が積み上がる。
    expect(second.purged).toBe(0);
    expect((await storedTechnical(id)).purgedAt).toBe(first);
  });

  it("消したことが記録に残る（件数と保存日数だけで、中身は残さない）", async () => {
    await submitOne(owner, {}, submittedDaysBefore(DIAGNOSTICS_RETENTION_DAYS));
    await runFeedbackDiagnosticsPurge(proxy.env.DB, PURGE_NOW);

    const rows = await proxy.env.DB.prepare(
      "SELECT workspace_id AS workspaceId, actor_user_id AS actorUserId, target_type AS targetType, after_json AS afterJson FROM audit_logs WHERE action = ?",
    )
      .bind("feedback.diagnostics_purged")
      .all<{
        workspaceId: string;
        actorUserId: string;
        targetType: string;
        afterJson: string | null;
      }>();
    expect(rows.results.length).toBe(1);
    const row = rows.results[0];
    expect(row.workspaceId).toBe(String(WORKSPACE));
    expect(row.targetType).toBe("feedback_report");
    const after = JSON.parse(String(row.afterJson));
    expect(after.purgedCount).toBe(1);
    expect(after.retentionDays).toBe(DIAGNOSTICS_RETENTION_DAYS);
    // 消したものの中身が記録の側に残っていたら、消した意味が無い。
    expect(String(row.afterJson)).not.toContain("TypeError");
    expect(String(row.afterJson)).not.toContain("test-agent");
  });

  it("何も消さなかった夜には、記録を積まない", async () => {
    await submitOne(owner, {}, submittedDaysBefore(1));
    await runFeedbackDiagnosticsPurge(proxy.env.DB, PURGE_NOW);
    const rows = await proxy.env.DB.prepare(
      "SELECT id FROM audit_logs WHERE action = ?",
    )
      .bind("feedback.diagnostics_purged")
      .all<{ id: string }>();
    // 毎晩「0 件消しました」が増えると、本当に消えた日を探せなくなる。
    expect(rows.results.length).toBe(0);
  });

  it("消せなかった作業場所は、記録を残さず次の回で拾い直す", async () => {
    /*
     * **失敗したのに「消しました」の記録だけが残る**のが最悪の壊れ方である。
     * 中身は残っているのに、証跡は消したと言う。後から突き合わせても
     * どちらが本当か決められない。だから失敗した回は何も書かない。
     *
     * 失敗のさせ方は、表を一時的に別名にすること。実際に起きるのは
     * 接続断や上限超過だが、リポジトリから見れば同じ「書けなかった」である。
     */
    const id = await submitOne(owner, {}, submittedDaysBefore(DIAGNOSTICS_RETENTION_DAYS));
    const deps = createD1FeedbackDiagnosticsPurge(drizzle(proxy.env.DB, { schema }));
    // 一覧だけは先に取っておく（失敗させたいのは削除の側）。
    const failing = { ...deps, workspaceIds: async () => [String(WORKSPACE)] };

    await proxy.env.DB.prepare("DROP TABLE IF EXISTS feedback_reports_backup").run();
    await proxy.env.DB.prepare(
      "ALTER TABLE feedback_reports RENAME TO feedback_reports_backup",
    ).run();
    let failed: Awaited<ReturnType<typeof purgeExpiredFeedbackDiagnostics>>;
    try {
      failed = await purgeExpiredFeedbackDiagnostics(failing, PURGE_NOW);
    } finally {
      await proxy.env.DB.prepare(
        "ALTER TABLE feedback_reports_backup RENAME TO feedback_reports",
      ).run();
    }
    // 投げ返さない。投げると Cloudflare 側に再実行が積まれ、同じ失敗を繰り返す。
    expect(failed.purged).toBe(0);
    expect(failed.failures.length).toBe(1);
    expect(failed.failures[0].workspaceId).toBe(String(WORKSPACE));

    const audits = await proxy.env.DB.prepare("SELECT id FROM audit_logs WHERE action = ?")
      .bind("feedback.diagnostics_purged")
      .all<{ id: string }>();
    expect(audits.results.length, "消せていないのに記録が残っています").toBe(0);

    // 中身は消えずに残っている。次の回がそのまま拾い直す（再試行はこれで足りる）。
    expect((await storedTechnical(id)).purgedAt).toBeNull();
    const retried = await runFeedbackDiagnosticsPurge(proxy.env.DB, PURGE_NOW);
    expect(retried.failures).toEqual([]);
    expect(retried.purged).toBe(1);
    expect((await storedTechnical(id)).purgedAt).not.toBeNull();
  });
});
