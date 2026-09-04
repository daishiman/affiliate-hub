/**
 * @tier 1
 * @req REQ-SEC01, REQ-SEC09
 * @types equivalence, permission-matrix
 *
 * `tenancy.ts` の**断り方**を固定する。
 *
 * 既存の検査は「他所のものは取れない」「権限が無ければ断る」という
 * 通る／通らないの側を見ている。それは通るが、
 * **断ったときに何を言うか**は 1 つも押さえていない。
 *
 * ここが効くのは 2 つの場面である。
 *   1. 越境の断りが「見つかりません」の語調でなくなると、**他所に在ることが読めてしまう**。
 *   2. 「必要な権限」の並びが消えると、断られた人が次に何をすればよいか分からない。
 * どちらも画面は動いたままなので、振る舞いの検査では気づけない。
 */
import { describe, expect, it } from "vitest";
import {
  type ActorContext,
  type Role,
  assertSameTenant,
  hasRole,
  requireRole,
} from "@/domain/shared/tenancy";
import { OTHER_WORKSPACE, WORKSPACE, anAnalyst, anOwner } from "../support/actors";

const 主体 = (roles: readonly Role[]): ActorContext => ({ ...anAnalyst(), roles });

describe("他所のものを断るとき (assertSameTenant)", () => {
  it("自分のものはそのまま返る。包み直さない", () => {
    const もの = { workspaceId: WORKSPACE, id: "a-1" };
    const got = assertSameTenant(anAnalyst(), もの, "記事");
    expect(got.ok).toBe(true);
    if (got.ok) expect(got.value).toBe(もの);
  });

  it("他所のものは TENANT_MISMATCH で断る", () => {
    const got = assertSameTenant(anAnalyst(), { workspaceId: OTHER_WORKSPACE, id: "a-1" }, "記事");
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.code).toBe("TENANT_MISMATCH");
  });

  it("断り文は「見つかりません」の語調で、在ることを読ませない", () => {
    const got = assertSameTenant(anAnalyst(), { workspaceId: OTHER_WORKSPACE, id: "a-1" }, "記事");
    if (got.ok) throw new Error("前提が崩れている: 他所のものが取れている");
    expect(got.error.message).toBe("記事 が見つかりません。");
    // 名指しした語が、断り文にも助言にも漏れていないこと。
    expect(got.error.message).not.toContain(String(OTHER_WORKSPACE));
    expect(got.error.suggestedAction ?? "").not.toContain(String(OTHER_WORKSPACE));
    expect(got.error.suggestedAction).toBe(
      "ワークスペースを切り替えているか確認してください。",
    );
    expect(got.error.retryable).toBe(false);
  });

  it("何が見つからなかったかは、渡した語がそのまま入る", () => {
    const got = assertSameTenant(anAnalyst(), { workspaceId: OTHER_WORKSPACE, id: "x" }, "改善要望");
    if (got.ok) throw new Error("前提が崩れている");
    expect(got.error.message).toBe("改善要望 が見つかりません。");
  });
});

describe("役を持っているか (hasRole)", () => {
  it("挙げたうちの 1 つでも持っていれば true（全部持っている必要はない）", () => {
    const a = 主体(["analyst"]);
    expect(hasRole(a, "analyst", "publisher")).toBe(true);
    expect(hasRole(a, "publisher", "analyst")).toBe(true);
  });

  it("1 つも持っていなければ false", () => {
    expect(hasRole(主体(["analyst"]), "publisher", "writer")).toBe(false);
  });

  it("何も挙げなければ false（空の問いを true にしない）", () => {
    expect(hasRole(主体(["analyst"]))).toBe(false);
  });

  it("役を 1 つも持たない人は、何を挙げても false", () => {
    expect(hasRole(主体([]), "analyst")).toBe(false);
  });
});

describe("役を要求するとき (requireRole)", () => {
  it("挙げた役を持っていれば通る", () => {
    expect(requireRole(主体(["publisher"]), "記事の公開", "publisher").ok).toBe(true);
  });

  it("持ち主は、挙がっていなくても通る（持ち主の抜け道は残す）", () => {
    const got = requireRole(anOwner(), "記事の公開", "publisher");
    expect(got.ok).toBe(true);
    if (got.ok) expect(got.value).toBe(true);
  });

  it("持ち主でも、挙げた役でもなければ断る", () => {
    const got = requireRole(主体(["analyst"]), "記事の公開", "publisher");
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.code).toBe("FORBIDDEN");
  });

  it("断り文には、何をしようとしたかが入る", () => {
    const got = requireRole(主体(["analyst"]), "記事の公開", "publisher");
    if (got.ok) throw new Error("前提が崩れている: 通っている");
    expect(got.error.message).toBe("記事の公開 を行う権限がありません。");
    expect(got.error.retryable).toBe(false);
  });

  it("助言には、要る役が全部・区切って並ぶ（次に何をすればよいかが読めること）", () => {
    const got = requireRole(主体(["analyst"]), "記事の公開", "publisher", "workspace_admin");
    if (got.ok) throw new Error("前提が崩れている: 通っている");
    expect(got.error.suggestedAction).toBe("必要な権限: publisher / workspace_admin");
  });

  it("要る役が 1 つなら、区切りは現れない", () => {
    const got = requireRole(主体(["analyst"]), "記事の公開", "publisher");
    if (got.ok) throw new Error("前提が崩れている: 通っている");
    expect(got.error.suggestedAction).toBe("必要な権限: publisher");
  });
});
