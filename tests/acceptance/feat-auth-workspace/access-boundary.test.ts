/**
 * @tier 1
 * @req REQ-S10, REQ-SEC01, REQ-P01, REQ-API02, REQ-R07, REQ-R11
 * @types equivalence, boundary, permission-matrix
 */
import { describe, expect, it } from "vitest";
import { decideEntry, isGuardedPath } from "@/infrastructure/identity/entry-gate";
import type { SessionReaderPort } from "@/infrastructure/identity/session-repository";
import { assertSameTenant } from "@/domain/shared/tenancy";
import { requireCapability } from "@/domain/identity";
import { asUserId, asWorkspaceId, notFound, ok } from "@/domain/shared";
import { errorResponse } from "@/presentation/http/error-response";
import { anAnalyst } from "../../support/actors";
import type { WorkspaceId } from "@/domain/shared/ids";

/**
 * AWS-ACC-01 / 02 / 04 の受け入れ確認。
 *
 * 個々の部品は `tests/infrastructure/entry-gate.test.ts` などが既に見ている。
 * **ここが足すのは 1 つだけ**——「断る側と通す側を、同じテストの中で見る」。
 *
 * 断る側だけを並べたテストは、**全部を断る壊れ方に対して緑になる**。
 * 入口を丸ごと閉じても、権限判定を全部 `false` にしても、
 * 「拒否されること」を見ているテストは全部通ってしまう。
 * だから通る側を必ず隣に置く。
 */

const NOW = new Date("2026-08-24T09:00:00.000Z");
const VALID = "有効な通行証";

const reader: SessionReaderPort = {
  async findValid(token) {
    if (token !== VALID) return ok(null);
    return ok({
      userId: asUserId("user-1"),
      workspaceId: asWorkspaceId("ws-1"),
      expiresAt: new Date(NOW.getTime() + 60_000),
    });
  },
};

describe("AWS-ACC-01 未ログインは入れない／ログイン済みは入れる", () => {
  it("守る道と守らない道が、どちらも意図どおり", () => {
    expect(isGuardedPath("/admin/sites")).toBe(true);
    expect(isGuardedPath("/signin")).toBe(false);
  });

  it("通行証が無ければ戻し、有効なら通す（通す側が消えていないこと）", async () => {
    const 無し = await decideEntry(null, reader, NOW);
    const 有効 = await decideEntry(VALID, reader, NOW);
    expect(無し.kind).toBe("ログインへ");
    expect(有効.kind).toBe("通す");
  });
});

describe("AWS-ACC-02 他所のものは見えない／自分のものは見える", () => {
  const 自分 = { workspaceId: "ws-test-main" as WorkspaceId, id: "obj-1" };
  const 他所 = { workspaceId: "ws-test-other" as WorkspaceId, id: "obj-2" };
  const actor = anAnalyst();

  it("自分のものは取れる（全部 404 に倒していないこと）", () => {
    expect(assertSameTenant(actor, 自分, "記事").ok).toBe(true);
  });

  it("他所のものは断られる", () => {
    const got = assertSameTenant(actor, 他所, "記事");
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.code).toBe("TENANT_MISMATCH");
  });

  /**
   * ここが本命。番号が揃っていても**本文が違えば存在は漏れる**。
   *
   * 攻撃側は ID を 1 つずつ試し、返ってきた本文の違いだけを見る。
   * 「(id: xxx) が付いているほうは存在しない」と読めた時点で、
   * 他所の Workspace に何があるかが列挙できてしまう。
   * だから**バイト単位で同じものを返す**ことを固定する。
   */
  it("他所の ID と、そもそも無い ID が、応答も本文も区別できない", async () => {
    const 断り = assertSameTenant(actor, 他所, "記事");
    if (断り.ok) throw new Error("前提が崩れている: 他所のものが通っている");

    const 他所の応答 = errorResponse(断り.error);
    const 無い応答 = errorResponse(notFound("記事", "obj-9999"));

    expect(他所の応答.status).toBe(無い応答.status);
    expect(await 他所の応答.text()).toBe(await 無い応答.text());
  });
});

describe("AWS-ACC-04 権限の無い役は公開できない／許された操作はできる", () => {
  const analyst = anAnalyst();

  it("分析だけの役は公開を断られる", () => {
    const got = requireCapability(analyst, "content.publish", "記事の公開");
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.code).toBe("FORBIDDEN");
  });

  it("同じ役でも、許された操作は通る（全部 403 に倒していないこと）", () => {
    expect(requireCapability(analyst, "analytics.read", "数字の閲覧").ok).toBe(true);
  });

  it("断られた本人が次に何をすればよいか分かる", () => {
    const got = requireCapability(analyst, "content.publish", "記事の公開");
    if (!got.ok) expect(got.error.suggestedAction ?? "").not.toBe("");
  });
});
