/** @tier 1 @req REQ-R11, REQ-R12, REQ-API02 @types permission-matrix */
import { describe, expect, it } from "vitest";
import type { Role } from "@/domain/shared";
import { ROLE_LABEL } from "@/application/usecases/identity/manage-workspace";
import { type Capability, can, capabilitiesOf, requireCapability } from "@/domain/identity";
import { aWriter, anAiAccount, anOwner } from "../support/actors";

/**
 * 誰が何をできるか。
 *
 * ここで見るのは表の中身の暗記ではなく、**表が壊れたときに困ること**だけ。
 *   - 役割を 1 つ増やしたら、名前も一覧も付いてくるか（付いていないと画面に出ない）
 *   - 権限を渡したくない相手に、ついでに渡っていないか
 *   - 断るときに、誰に頼めばいいかが分かるか
 *
 * 表そのものを書き写した検査は入れない。写した方も一緒に直すので、何も守らない。
 */

const HUMAN_ROLES: readonly Role[] = [
  "owner",
  "workspace_admin",
  "brand_manager",
  "researcher",
  "writer",
  "reviewer",
  "publisher",
  "analyst",
  "contributor",
  "feedback_admin",
];

function caps(role: Role): ReadonlySet<string> {
  return new Set([...capabilitiesOf([role])].map(String));
}

describe("役割の表そのもの", () => {
  it("すべての役割に日本語の名前がある", () => {
    // 名前が無い役割は、担当者の一覧で空欄になる。誰なのか分からない行が残る。
    const missing = [...HUMAN_ROLES, "ai_service_account" as Role].filter(
      (r) => (ROLE_LABEL[r] ?? "").trim() === "",
    );
    expect(missing).toEqual([]);
  });

  it("役割 1 つにつき、できることが 1 つ以上ある", () => {
    // 何もできない役割は、招待された人から見ると「入れたのに何も無い」画面になる。
    const empty = HUMAN_ROLES.filter((r) => caps(r).size === 0);
    expect(empty).toEqual([]);
  });

  it("持ち主は、他の誰かができることを全部できる", () => {
    // ここが崩れると「持ち主に頼んでください」という案内が嘘になる。
    const owner = caps("owner");
    const beyond = HUMAN_ROLES.flatMap((r) => [...caps(r)].filter((c) => !owner.has(c)));
    expect([...new Set(beyond)]).toEqual([]);
  });
});

describe("渡したくないものが、ついでに渡っていないか", () => {
  it("公開担当は、本文を書き換えられない", () => {
    // 公開だけを任せたつもりが、公開直前に中身を差し替えられては確認の意味が無い。
    expect(caps("publisher").has("content.publish")).toBe(true);
    expect(caps("publisher").has("content.write")).toBe(false);
  });

  it("数字の担当は、記事を書けない・公開できない", () => {
    const analyst = caps("analyst");
    expect(analyst.has("analytics.read")).toBe(true);
    expect([analyst.has("content.write"), analyst.has("content.publish")]).toEqual([false, false]);
  });

  it("使い勝手の担当は、改善要望まわりだけで、記事には一切触れない", () => {
    const held = caps("feedback_admin");
    for (const c of [
      "feedback.submit",
      "feedback.read",
      "feedback.status_update",
      "feedback.manage",
      "integration_key.manage",
    ]) {
      expect(held.has(c), `${c} を持っていません`).toBe(true);
    }
    // 要望を読ませたいだけの相手に、記事の権限まで渡さない。
    const content = [...held].filter((c) => c.startsWith("content.") || c.startsWith("site."));
    expect(content).toEqual([]);
  });

  it("AI は、人が決めることを役割で持っていても実行できない", () => {
    // AI の役割表に `feedback.read` はあるが、扱いの決定と鍵の発行は無い。
    // さらに人限定の上書きが二重に効いていることを見る。
    const ai = anAiAccount();
    expect(can(ai, "feedback.read")).toBe(true);
    expect(can(ai, "feedback.manage")).toBe(false);
    expect(can(ai, "content.publish")).toBe(false);
  });
});

describe("断り方", () => {
  it("足りない権限の名前と、誰に頼めばよいかを言う", () => {
    const writer = aWriter();
    const refused = requireCapability(writer, "affiliate.read_revenue", "成果の金額の閲覧");
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.code).toBe("FORBIDDEN");
    expect(refused.error.message).toContain("成果の金額の閲覧");
    // 「権限がありません」だけだと、次に何をすればいいのか分からない。
    expect(refused.error.suggestedAction ?? "").toContain("affiliate.read_revenue");
  });

  it("AI が人の操作を求めたときは、権限の名前ではなく「人が行う」と言う", () => {
    const ai = anAiAccount();
    const refused = requireCapability(ai, "content.publish", "記事の公開");
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    // 権限名を出すと「その権限を足せば AI が公開できる」と読める。足しても通らない。
    expect(refused.error.message).toContain("人が行う");
    expect(refused.error.suggestedAction ?? "").not.toContain("content.publish");
  });

  it("持っているときは通す", () => {
    const owner = anOwner();
    expect(requireCapability(owner, "content.publish" as Capability, "記事の公開").ok).toBe(true);
  });
});
