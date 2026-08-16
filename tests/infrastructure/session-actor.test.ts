import { describe, expect, it } from "vitest";
import {
  createD1SessionReader,
  hashSessionToken,
  type SessionReaderPort,
} from "@/infrastructure/identity/session-repository";
import { createSessionActorResolver } from "@/infrastructure/identity/session-actor";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";
import type { MembershipRepositoryPort } from "@/application/ports/identity";
import type { SessionRow } from "@/db/schema";
import { asUserId, asWorkspaceId, domainError, err, ok } from "@/domain/shared";
import type { Role, UserId, WorkspaceId } from "@/domain/shared";
import type { Membership } from "@/domain/identity";

/**
 * ログインの仕組みを差し替えたときの確認（変更容易性シナリオ ⑦）。
 *
 * ここで見るのは「合言葉を確かめる側」の振る舞い。
 * 合言葉を**発行する側**（Google ログイン）はまだ無く、
 * それは利用者ご自身による接続情報の登録が要るため、ここでは扱わない。
 *
 * この分け方そのものが確認対象でもある。
 * 発行と確認が同じ関数に入っていると、ログイン方式を替えるたびに
 * 権限の判定まで書き直すことになる。
 */

const WS = asWorkspaceId("ws_sample") as WorkspaceId;
const USER = asUserId("u_1") as UserId;
const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-08-17T00:00:00.000Z");

function sessionRow(over: Partial<SessionRow> = {}): SessionRow {
  return {
    tokenHash: "",
    userId: "u_1",
    workspaceId: "ws_sample",
    createdAt: new Date(NOW.getTime() - HOUR),
    expiresAt: new Date(NOW.getTime() + HOUR),
    revokedAt: null,
    ...over,
  };
}

/** 合言葉を潰した値で引く、偽の保存先。 */
function fakeDb(rows: readonly SessionRow[]) {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(rows),
  };
  return { select: () => chain } as unknown as DrizzleD1;
}

function membershipRepo(membership: Membership | null): MembershipRepositoryPort {
  return {
    findById: async () => ok(null),
    findByUser: async () => ok(membership),
    list: async () => ok({ items: [], nextCursor: null }),
    save: async (m) => ok(m),
    findOwner: async () => ok(null),
  };
}

function membership(over: Partial<Membership> = {}): Membership {
  return {
    id: asUserId("m_1") as unknown as Membership["id"],
    workspaceId: WS,
    userId: USER,
    roles: ["writer"] as readonly Role[],
    scopedBrandIds: [],
    displayName: "見本 太郎",
    invitedAt: NOW,
    acceptedAt: NOW,
    revokedAt: null,
    ...over,
  };
}

describe("合言葉の確かめ方", () => {
  it("合言葉そのものではなく、潰した値で引いている", async () => {
    let asked = "";
    const db = {
      select: () => ({
        from: () => ({
          where: (cond: unknown) => {
            asked = JSON.stringify(cond);
            return { limit: () => Promise.resolve([]) };
          },
        }),
      }),
    } as unknown as DrizzleD1;

    await createD1SessionReader(db).findValid("plain-secret-token", NOW);
    // 平文が問い合わせに乗っていたら、保存先にも平文が入っている。
    expect(asked).not.toContain("plain-secret-token");
  });

  it("潰した値は毎回同じで、違う合言葉では違う値になる", async () => {
    const a1 = await hashSessionToken("token-a");
    const a2 = await hashSessionToken("token-a");
    const b = await hashSessionToken("token-b");
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(a1).toHaveLength(64);
  });

  it("期限が切れていれば、行が残っていても無効にする", async () => {
    const reader = createD1SessionReader(
      fakeDb([sessionRow({ expiresAt: new Date(NOW.getTime() - 1) })]),
    );
    const result = await reader.findValid("t", NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it("取り消された合言葉は、期限内でも無効にする", async () => {
    const reader = createD1SessionReader(fakeDb([sessionRow({ revokedAt: NOW })]));
    const result = await reader.findValid("t", NOW);
    if (result.ok) expect(result.value).toBeNull();
  });

  it("有効なら、誰のものかを返す", async () => {
    const reader = createD1SessionReader(fakeDb([sessionRow()]));
    const result = await reader.findValid("t", NOW);
    expect(result.ok).toBe(true);
    if (!result.ok || result.value === null) throw new Error("有効なはずの合言葉が無効になりました");
    expect(String(result.value.userId)).toBe("u_1");
    expect(String(result.value.workspaceId)).toBe("ws_sample");
  });

  it("保存先が落ちたときは「ログインしていない」に化けさせない", async () => {
    const broken = {
      select: () => ({
        from: () => ({ where: () => ({ limit: () => Promise.reject(new Error("D1_ERROR")) }) }),
      }),
    } as unknown as DrizzleD1;
    const result = await createD1SessionReader(broken).findValid("t", NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.retryable).toBe(true);
    expect(JSON.stringify(result.error)).not.toContain("D1_ERROR");
  });
});

describe("合言葉から「いま操作している人」を決める", () => {
  const validSessions: SessionReaderPort = {
    findValid: async () => ok({ userId: USER, workspaceId: WS, expiresAt: NOW }),
  };

  it("権限は合言葉ではなく、担当者の登録から引く", async () => {
    const resolve = createSessionActorResolver({
      sessions: validSessions,
      memberships: membershipRepo(membership({ roles: ["reviewer", "publisher"] })),
      now: () => NOW,
    });
    const result = await resolve("t");
    expect(result.kind).toBe("actor");
    if (result.kind !== "actor") return;
    expect(result.actor.roles).toEqual(["reviewer", "publisher"]);
    expect(result.actor.isAiServiceAccount).toBe(false);
  });

  it("担当を外された人は、合言葉が生きていても操作できない", async () => {
    const resolve = createSessionActorResolver({
      sessions: validSessions,
      memberships: membershipRepo(membership({ revokedAt: NOW })),
      now: () => NOW,
    });
    expect((await resolve("t")).kind).toBe("not_member");
  });

  it("担当者として登録が無ければ、権限を与えない", async () => {
    const resolve = createSessionActorResolver({
      sessions: validSessions,
      memberships: membershipRepo(null),
      now: () => NOW,
    });
    expect((await resolve("t")).kind).toBe("not_member");
  });

  it("合言葉が無ければ、未ログインとして返す", async () => {
    const resolve = createSessionActorResolver({
      sessions: validSessions,
      memberships: membershipRepo(membership()),
      now: () => NOW,
    });
    expect((await resolve(null)).kind).toBe("anonymous");
    expect((await resolve("")).kind).toBe("anonymous");
  });

  it("確かめられなかったときは、未ログインと区別して返す", async () => {
    const resolve = createSessionActorResolver({
      sessions: {
        findValid: async () =>
          err(domainError("UPSTREAM_UNAVAILABLE", "確認できません", { retryable: true })),
      },
      memberships: membershipRepo(membership()),
      now: () => NOW,
    });
    const result = await resolve("t");
    // ここを anonymous にすると、保存先が落ちた瞬間に
    // 全員が「見本の権限」で動く状態になる。
    expect(result.kind).toBe("unavailable");
  });
});
