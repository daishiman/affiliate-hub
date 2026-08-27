/**
 * @tier 1
 * @req REQ-R01, REQ-R02, REQ-R03, REQ-R04, REQ-R05
 * @req REQ-R06, REQ-R07, REQ-R08, REQ-R09, REQ-R10
 * @req REQ-R11, REQ-R12, REQ-API02
 * @types permission-matrix
 */
import { describe, expect, it } from "vitest";
import type { Role } from "@/domain/shared";
import { ROLE_LABEL } from "@/application/usecases/identity/manage-workspace";
import { type Capability, can, capabilitiesOf, requireCapability } from "@/domain/identity";
import { aWriter, anAiAccount, anOwner } from "../support/actors";
import { taggedString } from "@/domain/shared";
import type { BrandId } from "@/domain/shared";

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

/**
 * 役割 1 つずつの「持たない側」。
 *
 * `docs/product/traceability.md` の REQ-R01〜R10 は、役割ごとに
 * **持っているもの**ではなく「〜は持たない」という形で書いてある。
 * 持っている側だけを見ていると、権限を 1 つ足したときに
 * どの役割に増えたのかが分からないまま緑になる。
 *
 * 表を丸ごと書き写すのは避け（写した側も一緒に直るので何も守らない）、
 * **要件の文が「持たない」と言い切っている分だけ**を置く。
 */
const MUST_NOT_HAVE: Readonly<Record<string, { req: string; caps: readonly Capability[] }>> = {
  // REQ-R02: 持ち主から作業場所そのものの管理だけを除く
  workspace_admin: { req: "REQ-R02", caps: ["workspace.manage"] },
  // REQ-R03: ブランド配下の運営一式。会員管理と報酬管理は持たない
  brand_manager: {
    req: "REQ-R03",
    caps: ["workspace.manage", "member.manage", "affiliate.manage", "affiliate.read_revenue"],
  },
  // REQ-R04: 商品・根拠の登録まで。記事は読むだけ
  researcher: {
    req: "REQ-R04",
    caps: ["content.write", "content.generate", "content.approve", "content.publish"],
  },
  // REQ-R05: 下書きと生成。承認・公開は持たない
  writer: { req: "REQ-R05", caps: ["content.approve", "content.publish"] },
  // REQ-R06: 事実確認・表現確認。公開は持たない
  reviewer: { req: "REQ-R06", caps: ["content.approve", "content.publish"] },
  // REQ-R07: 公開のみ。本文を書き換えられない
  publisher: { req: "REQ-R07", caps: ["content.write", "content.generate", "content.approve"] },
  // REQ-R08: 数字と報酬の閲覧のみ。
  // 「閲覧のみ」なので、数字を見て**試しはじめる**側は持たない。
  // 見る権限に回す権限を相乗りさせると、読者に見えるものが数字の担当だけで変わる。
  analyst: {
    req: "REQ-R08",
    caps: [
      "content.write",
      "content.publish",
      "content.approve",
      "affiliate.manage",
      "improvement.run",
      "improvement.approve",
    ],
  },
  // REQ-R09: 記事の読み書きのみ
  contributor: {
    req: "REQ-R09",
    caps: [
      "content.approve",
      "content.publish",
      "product.write",
      "analytics.read",
      "site.draft",
      "site.manage",
    ],
  },
  // REQ-R10: 下書き・分析のみ。原則公開不可
  ai_service_account: {
    req: "REQ-R10",
    caps: ["content.approve", "content.publish", "member.manage", "feedback.manage"],
  },
};

describe("役割ごとに、持たないと決めたものを持っていないか", () => {
  for (const [role, { req, caps: forbidden }] of Object.entries(MUST_NOT_HAVE)) {
    it(`${req} ${role}: ${forbidden.join(" / ")} を持たない`, () => {
      const held = caps(role as Role);
      const leaked = forbidden.filter((c) => held.has(c));
      expect(leaked).toEqual([]);
    });
  }

  it("REQ-R02 作業場所の管理担当は、持ち主から `workspace.manage` だけを引いたもの", () => {
    /*
      要件の文は「owner から `workspace.manage` を除く」である。
      これまで当たっていたのは「`workspace.manage` を持たない」側だけで、
      **引きすぎ**は誰も見ていなかった。2026-08-21 の測定で
      `workspace_admin` から `audit.read` を落としたところ、
      domain / application / property / presentation / ui のどれも落ちなかった。
      監査ログを読めない管理担当が、要件どおりと読める状態のまま残る。
    */
    const expected = new Set([...caps("owner")].filter((c) => c !== "workspace.manage"));
    expect([...caps("workspace_admin")].sort()).toEqual([...expected].sort());
  });

  it("REQ-R01 作業場所そのものを管理できるのは持ち主だけ", () => {
    // ここが崩れると、招待した相手に作業場所ごと渡してしまう。
    const holders = [...HUMAN_ROLES, "ai_service_account" as Role].filter((r) =>
      caps(r).has("workspace.manage"),
    );
    expect(holders).toEqual(["owner"]);
  });
});

/**
 * REQ-R10「人の承認が要る操作は、AI には必ず拒否する」。
 *
 * ここを実装の `HUMAN_ONLY_CAPABILITIES` から回すと**何も守らない。**
 * 一覧を回す検査は、一覧が縮むと検査も一緒に縮むためである
 * （唯一の広い検査だった `tests/property/tenancy.property.test.ts` の
 * `fc.constantFrom(...HUMAN_ONLY_CAPABILITIES)` がその形だった）。
 *
 * 2026-08-21 に 10 件を 1 つずつ抜いて測った結果:
 *   赤になった  … content.approve / content.publish / member.manage /
 *                 improvement.approve / improvement.run
 *   緑のままだった… workspace.manage / affiliate.manage / export.perform /
 *                 feedback.manage / integration_key.manage
 * つまり REQ-R10 が名指ししている「報酬管理」「書き出し」は、
 * 黙って外しても誰も気づかない状態だった。
 *
 * だから一覧は**要件の文の側**に置く。実装の一覧を直しても、こちらは追随しない。
 */
const HUMAN_ONLY_BY_REQUIREMENT: readonly (readonly [Capability, string])[] = [
  ["content.approve", "REQ-R10「承認」"],
  ["content.publish", "REQ-R10「公開」"],
  ["member.manage", "REQ-R10「会員管理」"],
  ["affiliate.manage", "REQ-R10「報酬管理」"],
  ["export.perform", "REQ-R10「書き出し」"],
  ["workspace.manage", "REQ-R01 作業場所そのものの管理"],
  ["feedback.manage", "REQ-FB05 要望の扱いを決める・取り消す"],
  ["integration_key.manage", "REQ-FB06 鍵の発行・失効"],
  ["improvement.approve", "§14.5 試作の承認"],
  ["improvement.run", "§14.5 比較を始める"],
];

describe("AI に必ず断るもの（REQ-R10）", () => {
  /*
    役で配っていないから届かない、では守れていない。**配り方**が変わった日に崩れる。
    そこで「役はすべて持っている AI」で当てる。役の側で通っている状態にして、
    上書きの側だけが断っていることを見る。
  */
  const omnipotentAi = anAiAccount({
    roles: [...HUMAN_ROLES, "ai_service_account" as Role],
  });

  it.each(HUMAN_ONLY_BY_REQUIREMENT)("%s は AI では通らない（%s）", (capability, _なぜ) => {
    // 人が同じ役を持っていれば通ることを先に見る。
    // これが false だと「役が無いから断られた」を「人限定だから断られた」と読み違える。
    expect(can(anOwner({ roles: [...HUMAN_ROLES] }), capability), `${capability} は人でも通らない`).toBe(true);

    expect(can(omnipotentAi, capability)).toBe(false);
    const refused = requireCapability(omnipotentAi, capability, "この操作");
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    // 断り文が「権限がありません」だと、鍵を配り直せば通ると読める。
    expect(refused.error.message).toContain("人が行う必要があります");
  });
});

describe("断り方", () => {
  it("ブランド限定担当者は、ブランド対応を持たないサイト資源を操作できない", () => {
    const scoped = anOwner({
      scopedBrandIds: [taggedString<"BrandId">("brand-a") as BrandId],
    });

    for (const capability of ["site.manage", "site.draft"] as const) {
      const refused = requireCapability(scoped, capability, "ブログ");
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.error.code).toBe("TENANT_MISMATCH");
    }
    expect(requireCapability(scoped, "content.read", "記事").ok).toBe(true);
  });

  it.each([
    "product.read",
    "product.write",
    "evidence.write",
    "ranking_model.manage",
    "analytics.read",
    "improvement.run",
    "improvement.approve",
  ] as const)("ブランド限定担当者は、対応ブランドを特定できない %s を扱えない", (capability) => {
    const scoped = anOwner({
      scopedBrandIds: [taggedString<"BrandId">("brand-a") as BrandId],
    });

    const refused = requireCapability(scoped, capability, "ブランド対応のない資源");

    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("TENANT_MISMATCH");
  });

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
