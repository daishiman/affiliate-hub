/**
 * @tier 1
 * @types equivalence, boundary, permission-matrix, fault-injection
 * @req REQ-S10
 *
 * 入口の門（`proxy.ts` が呼ぶ判定）の確認。
 *
 * **できてはいけない側を主に並べてある。** 通る側だけを確かめると、
 * 「通行証を持っていれば通る」までしか言えず、
 * **持っていない人が止まること**が一度も確かめられない。
 * 門の値打ちは後者にしか無い。
 */
import { describe, expect, it } from "vitest";
import { decideEntry, isGuardedPath } from "@/infrastructure/identity/entry-gate";
import type { SessionReaderPort } from "@/infrastructure/identity/session-repository";
import { asUserId, asWorkspaceId, domainError, err, ok } from "@/domain/shared";

const NOW = new Date("2026-08-18T09:00:00.000Z");

/** 有効な通行証を 1 つだけ知っている、確かめる側の代役。 */
function readerWith(validToken: string): SessionReaderPort {
  return {
    async findValid(token) {
      if (token !== validToken) return ok(null);
      return ok({
        userId: asUserId("user-1"),
        workspaceId: asWorkspaceId("ws-1"),
        expiresAt: new Date(NOW.getTime() + 60_000),
      });
    },
  };
}

/** 保存先が落ちている状態の代役。 */
const brokenReader: SessionReaderPort = {
  async findValid() {
    return err(
      domainError("UPSTREAM_UNAVAILABLE", "ログイン状態の確認に失敗しました。", {
        retryable: true,
      }),
    );
  },
};

describe("どこを守るか", () => {
  it("管理画面は守る", () => {
    expect(isGuardedPath("/admin")).toBe(true);
    expect(isGuardedPath("/admin/settings")).toBe(true);
    expect(isGuardedPath("/admin/content/cv_alpha_approved")).toBe(true);
  });

  it("読者のページとサインイン画面は守らない", () => {
    // ここへ門を置くと、読者が記事を読めなくなる。
    expect(isGuardedPath("/")).toBe(false);
    expect(isGuardedPath("/s/video-editing-gear")).toBe(false);
    expect(isGuardedPath("/signin")).toBe(false);
  });

  it("ログインの往復そのものは守らない", () => {
    // ここを止めると、誰もログインできない（門を通る手段が消える）。
    expect(isGuardedPath("/api/auth/sign-in/social")).toBe(false);
    expect(isGuardedPath("/api/auth/callback/google")).toBe(false);
  });

  it("名前が /admin で始まるだけの別の道は守らない", () => {
    // `/administrators` を守ってしまうと、読者向けの道が黙って消える。
    // 逆に `/admin` を守り損ねると門が空振りする。境界はここ 1 文字。
    expect(isGuardedPath("/administrators")).toBe(false);
    expect(isGuardedPath("/admin-tools")).toBe(false);
  });
});

describe("通行証を見て、通すかどうか", () => {
  it("有効な通行証は通す", async () => {
    const decision = await decideEntry("good-token", readerWith("good-token"), NOW);
    expect(decision.kind).toBe("通す");
  });

  it("通行証を持っていない人は、ログインへ戻す", async () => {
    for (const token of [null, undefined, ""]) {
      const decision = await decideEntry(token, readerWith("good-token"), NOW);
      expect(decision).toEqual({ kind: "ログインへ", reason: "通行証なし" });
    }
  });

  it("偽物の通行証では通れない", async () => {
    // cookie は誰でも自分で書ける。値があることを通す理由にしない。
    const decision = await decideEntry("made-up", readerWith("good-token"), NOW);
    expect(decision).toEqual({ kind: "ログインへ", reason: "通行証が無効" });
  });

  it("保存先へ届かないときは通さない", async () => {
    // ここで通すと、保存先を落とせば門を外せることになる。
    const decision = await decideEntry("good-token", brokenReader, NOW);
    expect(decision).toEqual({ kind: "ログインへ", reason: "確認できない" });
  });

  it("確かめる相手がいないときも通さない", async () => {
    // Workers の外（接続が供給されない場所）。「無い」を「有効」にしない。
    const decision = await decideEntry("good-token", null, NOW);
    expect(decision).toEqual({ kind: "ログインへ", reason: "確認できない" });
  });

  it("断る理由を分けて持つが、通す側は 1 つしかない", async () => {
    // 理由が分かれているのは、こちらが後から読むためである。
    // 画面へ出す言葉は分けない（どのアドレスが登録済みかを外へ漏らさない）。
    const reasons = await Promise.all([
      decideEntry(null, readerWith("t"), NOW),
      decideEntry("x", readerWith("t"), NOW),
      decideEntry("t", brokenReader, NOW),
    ]);
    expect(reasons.every((r) => r.kind === "ログインへ")).toBe(true);
    expect(new Set(reasons.map((r) => (r.kind === "ログインへ" ? r.reason : "")))).toHaveProperty(
      "size",
      3,
    );
  });

  it("役は見ない", async () => {
    // 役を見始めると、同じ判定が入口と奥の 2 か所に生まれて必ず食い違う。
    // 引数に役を受け取る口が無いことが、その保証になっている。
    expect(decideEntry.length).toBe(3);
  });
});
