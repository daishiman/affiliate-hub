/**
 * @tier 1
 * @types equivalence, fault-injection, tenant-isolation
 * @req REQ-S10
 *
 * ログインした人の権限を引く側の確認。
 *
 * ここが見本データのままだと、ログインが成立しても全員が見本の役割で動く。
 * 「ログインできた」と「その人の権限で動いている」は別のことなので、
 * 後者が本物の登録から来ていることを確かめる。
 */
import { describe, expect, it } from "vitest";
import { createD1MembershipReader } from "@/infrastructure/identity/membership-reader";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";
import { asUserId, asWorkspaceId } from "@/domain/shared";
import type { UserId, WorkspaceId } from "@/domain/shared";
import type { MembershipRow } from "@/db/schema";

const WS = asWorkspaceId("ws_1") as WorkspaceId;
const USER = asUserId("u_1") as UserId;
const NOW = new Date("2026-08-18T00:00:00.000Z");

function row(over: Partial<MembershipRow> = {}): MembershipRow {
  return {
    id: "m_1",
    workspaceId: "ws_1",
    userId: "u_1",
    invitedEmail: "a@example.com",
    roles: ["reviewer", "publisher"],
    scopedBrandIds: ["b_1"],
    displayName: "見本 太郎",
    invitedAt: NOW,
    acceptedAt: NOW,
    revokedAt: null,
    ...over,
  };
}

function fakeDb(rows: readonly MembershipRow[]) {
  return {
    select: () => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
    }),
  } as unknown as DrizzleD1;
}

describe("担当者の登録を読む", () => {
  it("登録されている役割をそのまま返す（画面側で足さない）", async () => {
    const result = await createD1MembershipReader(fakeDb([row()])).findByUser(WS, USER);
    expect(result.ok).toBe(true);
    if (!result.ok || result.value === null) throw new Error("登録が読めませんでした");
    expect(result.value.roles).toEqual(["reviewer", "publisher"]);
    expect(result.value.scopedBrandIds.map(String)).toEqual(["b_1"]);
  });

  it("行が無ければ「担当ではない」", async () => {
    const result = await createD1MembershipReader(fakeDb([])).findByUser(WS, USER);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it("招待しただけで一度も入っていない行は、権限として渡さない", async () => {
    // `user_id` が空のまま。ここを通すと、招待しただけの人が動く。
    const result = await createD1MembershipReader(fakeDb([row({ userId: null })])).findByUser(
      WS,
      USER,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it("担当を外された行も返す。無効にするのは呼び出し側の仕事", async () => {
    // ここで null にすると「登録が無い」と「外された」が区別できなくなる。
    // 画面に出す言葉が変わるので、事実は事実として返す。
    const result = await createD1MembershipReader(
      fakeDb([row({ revokedAt: NOW })]),
    ).findByUser(WS, USER);
    if (!result.ok || result.value === null) throw new Error("登録が読めませんでした");
    expect(result.value.revokedAt).toEqual(NOW);
  });

  it("保存先が落ちたときは「担当ではない」に化けさせない", async () => {
    const broken = {
      select: () => ({
        from: () => ({ where: () => ({ limit: () => Promise.reject(new Error("D1_ERROR")) }) }),
      }),
    } as unknown as DrizzleD1;

    const result = await createD1MembershipReader(broken).findByUser(WS, USER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.retryable).toBe(true);
    expect(JSON.stringify(result.error)).not.toContain("D1_ERROR");
  });
});
