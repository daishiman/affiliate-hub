/** @tier 2 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import type { AuditLogPort } from "@/application/ports/compliance";
import { createD1AuditLog } from "@/infrastructure/persistence/d1/audit-log-repository";
import type { AuditLogEntry } from "@/domain/compliance";
import { createAuditLogEntry } from "@/domain/compliance";
import type { AuditLogId, UserId, WorkspaceId } from "@/domain/shared";
import { taggedString } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { migrationStatements } from "../support/migrations";

/**
 * 操作の記録の**読み口**を、本物の D1 と本物のマイグレーションで通す。
 *
 * --- 書く側だけでは足りない理由 ---
 * 承認が記録されることは `d1-content.test.ts` が見ている。だがこの表は
 * 「後から読んで説明する」ために存在していて、**読めない記録は無い記録と同じ**。
 * 絞り込み（誰の作業場所か・いつからいつまで・どの操作か）が 1 つでも
 * 効いていないと、規制対応の場面で「関係ない記録まで出した」か
 * 「あるはずの記録が出てこない」のどちらかになる。
 *
 * --- ここでいちばん見たいこと ---
 * **作業場所をまたいで漏れないこと**と、**続きの読み出しが同じ行を 2 回出さないこと**。
 * 前者は他社の操作履歴が見えるということで、単なる不具合では済まない。
 * 後者は件数で切ると起きる（読んでいる間に 1 件増えると 1 行ずれる）ので、
 * 時刻で切っていることをここで固定する。
 *
 * 規範: docs/product/traceability.md REQ-SEC09 / docs/spec/10-テスト戦略仕様.md §3-5
 *
 * @req REQ-SEC09
 * @types audit-log, db-migration
 */

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

let proxy: Proxy;
let repo: AuditLogPort;

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const OTHER_WS = taggedString<"WorkspaceId">("ws_other") as WorkspaceId;

/** 記録を 1 件作る。作れないものはここで落とす（テストが嘘の値を持たない）。 */
function anEntry(over: {
  readonly id: string;
  readonly workspaceId?: WorkspaceId;
  readonly action?: AuditLogEntry["action"];
  readonly targetId?: string;
  readonly occurredAt: Date;
  readonly userId?: string | null;
  readonly isAi?: boolean;
  readonly identified?: boolean;
  readonly before?: Readonly<Record<string, unknown>> | null;
}): AuditLogEntry {
  const isAi = over.isAi ?? false;
  const built = createAuditLogEntry({
    id: taggedString<"AuditLogId">(over.id) as AuditLogId,
    workspaceId: over.workspaceId ?? WS,
    action: over.action ?? "content.state_changed",
    actor: {
      userId:
        over.userId === null ? null : (taggedString<"UserId">(over.userId ?? "u_owner") as UserId),
      isAiServiceAccount: isAi,
      modelId: null,
      // 名前を渡さない呼び出し（`userId: null`）は、既定で確かめていない身元にする。
      // 名前があっても確かめていない場合（読者の `anonymous`）は明示して渡す。
      identified: over.identified ?? over.userId !== null,
    },
    targetType: "content_variant",
    targetId: over.targetId ?? "cv_alpha_review",
    before: over.before ?? null,
    after: { state: "FACT_CHECK" },
    reason: "検査のため。",
    occurredAt: over.occurredAt,
  });
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
}

const T = (iso: string) => new Date(iso);

beforeAll(async () => {
  proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  for (const statement of migrationStatements()) {
    await proxy.env.DB.prepare(statement).run();
  }
  repo = createD1AuditLog(drizzle(proxy.env.DB, { schema }));
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM audit_logs").run();
});

describe("操作の記録（D1）", () => {
  it("追記したものが、対象ごとに読み直せる", async () => {
    const added = await repo.append(
      anEntry({ id: "al_t1", targetId: "cv_x", occurredAt: T("2026-08-18T01:00:00Z") }),
    );
    if (!added.ok) throw added.error;
    expect(String(added.value)).toBe("al_t1");

    const got = await repo.listByTarget(WS, "content_variant", "cv_x");
    if (!got.ok) throw got.error;
    expect(got.value.length).toBe(1);
    expect(got.value[0]?.targetId).toBe("cv_x");
    expect(got.value[0]?.reason).toBe("検査のため。");
    expect(got.value[0]?.after).toEqual({ state: "FACT_CHECK" });
  });

  it("別の作業場所の記録は、同じ対象名でも出てこない", async () => {
    // 対象の名前がたまたま同じなら混ざる、という作りにしない。
    // 混ざると、他社の操作履歴をそのまま画面に出すことになる。
    await repo.append(
      anEntry({ id: "al_mine", targetId: "cv_same", occurredAt: T("2026-08-18T01:00:00Z") }),
    );
    await repo.append(
      anEntry({
        id: "al_theirs",
        workspaceId: OTHER_WS,
        targetId: "cv_same",
        occurredAt: T("2026-08-18T01:00:00Z"),
      }),
    );

    const got = await repo.listByTarget(WS, "content_variant", "cv_same");
    if (!got.ok) throw got.error;
    expect(got.value.map((e) => String(e.id))).toEqual(["al_mine"]);
  });

  it("新しいものから順に返る", async () => {
    await repo.append(anEntry({ id: "al_old", occurredAt: T("2026-08-16T00:00:00Z") }));
    await repo.append(anEntry({ id: "al_new", occurredAt: T("2026-08-18T00:00:00Z") }));

    const got = await repo.search(WS, {}, { limit: 10, cursor: null });
    if (!got.ok) throw got.error;
    expect(got.value.items.map((e) => String(e.id))).toEqual(["al_new", "al_old"]);
    expect(got.value.nextCursor).toBeNull();
  });

  it("期間と操作の種類で絞れる", async () => {
    await repo.append(
      anEntry({ id: "al_a", action: "content.state_changed", occurredAt: T("2026-08-10T00:00:00Z") }),
    );
    await repo.append(
      anEntry({ id: "al_b", action: "content.published", occurredAt: T("2026-08-17T00:00:00Z") }),
    );
    await repo.append(
      anEntry({ id: "al_c", action: "content.state_changed", occurredAt: T("2026-08-18T00:00:00Z") }),
    );

    const byAction = await repo.search(
      WS,
      { action: "content.state_changed" },
      { limit: 10, cursor: null },
    );
    if (!byAction.ok) throw byAction.error;
    expect(byAction.value.items.map((e) => String(e.id))).toEqual(["al_c", "al_a"]);

    const byPeriod = await repo.search(
      WS,
      { from: T("2026-08-16T00:00:00Z"), to: T("2026-08-17T12:00:00Z") },
      { limit: 10, cursor: null },
    );
    if (!byPeriod.ok) throw byPeriod.error;
    expect(byPeriod.value.items.map((e) => String(e.id))).toEqual(["al_b"]);
  });

  it("続きを読んでも、同じ行を 2 回出さない", async () => {
    for (const [i, iso] of [
      "2026-08-18T03:00:00Z",
      "2026-08-18T02:00:00Z",
      "2026-08-18T01:00:00Z",
    ].entries()) {
      await repo.append(anEntry({ id: `al_p${i}`, occurredAt: T(iso) }));
    }

    const first = await repo.search(WS, {}, { limit: 2, cursor: null });
    if (!first.ok) throw first.error;
    expect(first.value.items.map((e) => String(e.id))).toEqual(["al_p0", "al_p1"]);
    expect(first.value.nextCursor).not.toBeNull();

    const next = await repo.search(WS, {}, { limit: 2, cursor: first.value.nextCursor });
    if (!next.ok) throw next.error;
    expect(next.value.items.map((e) => String(e.id))).toEqual(["al_p2"]);
    expect(next.value.nextCursor).toBeNull();
  });

  it("差分が読めない行でも、その行ごと消えない", async () => {
    // 差分は操作ごとに形が違うので文字列で持っている。1 行壊れただけで
    // 一覧が落ちると、「記録が読めない」と「記録が無い」を画面から区別できない。
    await repo.append(anEntry({ id: "al_broken", occurredAt: T("2026-08-18T00:00:00Z") }));
    await proxy.env.DB.prepare("UPDATE audit_logs SET before_json = ? WHERE id = ?")
      .bind("{壊れている", "al_broken")
      .run();

    const got = await repo.search(WS, {}, { limit: 10, cursor: null });
    if (!got.ok) throw got.error;
    expect(got.value.items.length).toBe(1);
    expect(got.value.items[0]?.before).toBeNull();
  });

  it("AI が動かした記録は、人の操作として読み直されない", async () => {
    await repo.append(
      anEntry({ id: "al_ai", userId: null, isAi: true, occurredAt: T("2026-08-18T00:00:00Z") }),
    );

    const got = await repo.listByTarget(WS, "content_variant", "cv_alpha_review");
    if (!got.ok) throw got.error;
    expect(got.value[0]?.actor.isAiServiceAccount).toBe(true);
    expect(got.value[0]?.actor.userId).toBeNull();
  });

  /*
   * **印は列で持っている。** 名前の有無から読み直せない——確かめていない身元にも
   * 名前は付いている（読者は `anonymous`、見本は `u_sample`）。
   * 保存の往復でこの印が落ちると、読者が押した操作が後から
   * 「人が確認した」として読まれる。落ちたことは画面にも記録にも出ない。
   */
  it("確かめていない身元の印が、保存の往復で消えない", async () => {
    await repo.append(
      anEntry({
        id: "al_unverified",
        userId: "anonymous",
        identified: false,
        occurredAt: T("2026-08-18T01:00:00Z"),
      }),
    );

    const got = await repo.listByTarget(WS, "content_variant", "cv_alpha_review");
    if (!got.ok) throw got.error;
    const row = got.value.find((e) => String(e.id) === "al_unverified");
    expect(row?.actor.userId, "名前まで落ちています。読者と見本が区別できなくなります。").toBe(
      "anonymous",
    );
    expect(
      row?.actor.identified,
      "確かめていない印が往復で消えました。名前が残っているので、確かめた身元に見えます。",
    ).toBe(false);
  });

  it("確かめた身元の印も、保存の往復で消えない", async () => {
    await repo.append(
      anEntry({ id: "al_verified", userId: "u_owner", occurredAt: T("2026-08-18T02:00:00Z") }),
    );

    const got = await repo.listByTarget(WS, "content_variant", "cv_alpha_review");
    if (!got.ok) throw got.error;
    const row = got.value.find((e) => String(e.id) === "al_verified");
    expect(row?.actor.identified, "確かめた身元まで false になっています。").toBe(true);
  });

  it("表が無ければ、空の成功ではなく失敗が返る", async () => {
    // 落ちたときに空一覧を返すと、画面には「記録 0 件」と出る。
    // 「まだ何も操作していない」と見分けが付かない。
    await proxy.env.DB.prepare("DROP TABLE audit_logs").run();
    const got = await repo.search(WS, {}, { limit: 10, cursor: null });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("UPSTREAM_UNAVAILABLE");

    // 後続のテストのために作り直す（この検査だけが表を壊す）。
    for (const statement of migrationStatements()) {
      if (
        /^CREATE TABLE `audit_logs`/.test(statement) ||
        /^ALTER TABLE `audit_logs` ADD /.test(statement) ||
        /^CREATE INDEX `audit_logs_/.test(statement)
      ) {
        await proxy.env.DB.prepare(statement).run();
      }
    }
  });
});
