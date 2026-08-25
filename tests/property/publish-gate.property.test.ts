/** @tier 1 @req REQ-QC12, REQ-QC09, REQ-SEC06 @types property, decision-table */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { requiredSectionsFor, type ArticleType } from "@/domain/authoring/article-structure";
import {
  type GateRequirement,
  type PublishCandidate,
  type RelationshipType,
  buildVisibleMessage,
  evaluatePublishGate,
  relAttributeFor,
  requiresDisclosure,
} from "@/domain/compliance";

/**
 * 公開ゲートの「どうやっても抜けられない線」を性質で確かめる。
 *
 * ここが抜けると、広告表記のない記事が世に出る。
 * 例のテストだと「開示なしで公開しようとすると落ちる」を 1 通り書いて終わりになりやすいが、
 * 実際に怖いのは**他の項目を全部そろえた記事**で抜けることなので、
 * 他の項目を機械にランダムに埋めさせた上で、開示だけを欠かす。
 *
 * 対応する要件: REQ-B08（公開ゲート）、REQ-B09（広告・アフィリエイト表記）
 */

const ARTICLE_TYPES: readonly ArticleType[] = ["ranking", "review", "comparison", "guide", "tool"];
const RELATIONSHIPS: readonly RelationshipType[] = [
  "affiliate",
  "sponsored",
  "supplied",
  "loaned",
  "purchased",
  "paid_partnership",
];

const triStateArb = fc.constantFrom(true, false, null);

/** 開示以外を機械に埋めさせる。良い値も悪い値も混ぜる。 */
const candidateArb = fc.constantFrom(...ARTICLE_TYPES).chain((articleType) =>
  fc.record({
    articleType: fc.constant(articleType),
    presentSections: fc.constant(requiredSectionsFor(articleType)),
    authorIds: fc.array(fc.string({ minLength: 1, maxLength: 6 }), { maxLength: 3 }),
    updateOwnerId: fc.option(fc.string({ minLength: 1, maxLength: 6 }), { nil: null }),
    claimCount: fc.integer({ min: 0, max: 5 }),
    evidenceCount: fc.integer({ min: 0, max: 5 }),
    hasAffiliateCta: fc.boolean(),
    merchantOptionCount: fc.integer({ min: 0, max: 3 }),
    imageRightsConfirmed: triStateArb,
    structuredDataValid: triStateArb,
    mobileChecked: triStateArb,
    linksChecked: triStateArb,
    aiAnswerEvalPassed: triStateArb,
    webmcpSchemaEval: fc.constantFrom(true, false, null, "not_applicable" as const),
    nextReviewAt: fc.option(fc.constant(new Date("2027-01-01T00:00:00Z")), { nil: null }),
  }),
);

const NOW = new Date("2026-08-17T00:00:00Z");

function withDisclosure(
  base: Omit<PublishCandidate, "relationshipType" | "disclosureVisibleMessage" | "now">,
  relationshipType: RelationshipType | null,
  disclosureVisibleMessage: string | null,
): PublishCandidate {
  return { ...base, relationshipType, disclosureVisibleMessage, now: NOW };
}

describe("公開ゲートの性質", () => {
  it("広告との関係が未設定なら、他が完璧でも必ず落ちる", () => {
    fc.assert(
      fc.property(candidateArb, (base) => {
        const result = evaluatePublishGate(withDisclosure(base, null, "何か書いてある"));
        expect(result.ok).toBe(false);
        expect(result.failures.some((f) => f.requirement === "disclosure")).toBe(true);
      }),
    );
  });

  it("表記が要る関係なのに読者へ見せる文が無ければ、必ず落ちる", () => {
    fc.assert(
      fc.property(
        candidateArb,
        fc.constantFrom(...RELATIONSHIPS.filter(requiresDisclosure)),
        // 空・空白だけ・null のいずれも「無い」として扱われること
        fc.constantFrom<string | null>("", " ", "　", "\n\t", null),
        (base, relationshipType, message) => {
          const result = evaluatePublishGate(withDisclosure(base, relationshipType, message));
          expect(result.ok).toBe(false);
          expect(result.failures.some((f) => f.requirement === "disclosure")).toBe(true);
        },
      ),
    );
  });

  it("合格したなら、落ちた項目は 1 つも無い（ok と failures がずれない）", () => {
    fc.assert(
      fc.property(
        candidateArb,
        fc.constantFrom<RelationshipType | null>(...RELATIONSHIPS, null),
        fc.option(fc.string({ maxLength: 20 }), { nil: null }),
        (base, rel, message) => {
          const result = evaluatePublishGate(withDisclosure(base, rel, message));
          expect(result.ok).toBe(result.failures.length === 0);
        },
      ),
    );
  });

  it("同じ検査項目が「落ちた」と「検査していない」に同時に現れない", () => {
    fc.assert(
      fc.property(
        candidateArb,
        fc.constantFrom<RelationshipType | null>(...RELATIONSHIPS, null),
        (base, rel) => {
          const result = evaluatePublishGate(withDisclosure(base, rel, "広告を含みます"));
          const failed = new Set(result.failures.map((f) => f.requirement));
          for (const s of result.skipped) expect(failed.has(s.requirement)).toBe(false);
        },
      ),
    );
  });

  it("未実施（null）の検査は、黙って通らず必ず「検査していない」に残る", () => {
    // 空の合格を返さないことが、この関数の設計の要点。
    fc.assert(
      fc.property(
        candidateArb,
        fc.constantFrom<RelationshipType | null>(...RELATIONSHIPS, null),
        (base, rel) => {
          const result = evaluatePublishGate(withDisclosure(base, rel, "広告を含みます"));
          const skipped = new Set(result.skipped.map((s) => s.requirement));

          if (base.imageRightsConfirmed === null) expect(skipped.has("image_rights")).toBe(true);
          if (base.structuredDataValid === null) expect(skipped.has("structured_data")).toBe(true);
          if (base.mobileChecked === null) expect(skipped.has("mobile_check")).toBe(true);
          if (base.linksChecked === null) expect(skipped.has("link_check")).toBe(true);
          if (base.aiAnswerEvalPassed === null) expect(skipped.has("ai_answer_eval")).toBe(true);
          if (base.webmcpSchemaEval === null || base.webmcpSchemaEval === "not_applicable") {
            expect(skipped.has("webmcp_schema_eval")).toBe(true);
          }
          for (const s of result.skipped) expect(s.reason.trim()).not.toBe("");
        },
      ),
    );
  });

  it("落ちた項目の説明文は、必ず読める文になっている（識別子だけを返さない）", () => {
    fc.assert(
      fc.property(
        candidateArb,
        fc.constantFrom<RelationshipType | null>(...RELATIONSHIPS, null),
        (base, rel) => {
          const result = evaluatePublishGate(withDisclosure(base, rel, null));
          for (const f of result.failures) {
            expect(f.message.trim().length).toBeGreaterThan(10);
            expect(f.message).not.toBe(f.requirement);
          }
        },
      ),
    );
  });
});

describe("開示の性質", () => {
  it("読者へ見せる文には、必ず関係の説明が入る（空文にならない）", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...RELATIONSHIPS),
        fc.option(fc.string({ minLength: 1, maxLength: 12 }), { nil: null }),
        fc.constantFrom("none" as const, "limited" as const, "declared" as const),
        fc.boolean(),
        (relationshipType, advertiserOrSupplier, editorialInfluence, aiAssisted) => {
          const message = buildVisibleMessage({
            relationshipType,
            advertiserOrSupplier,
            editorialInfluence,
            aiAssisted,
          });
          expect(message.trim()).not.toBe("");
        },
      ),
    );
  });

  it("表記が要る関係のリンクには、必ず sponsored が付く", () => {
    fc.assert(
      fc.property(fc.constantFrom(...RELATIONSHIPS), (rel) => {
        const attr = relAttributeFor(rel);
        expect(attr).toContain("noopener");
        expect(attr.includes("sponsored")).toBe(requiresDisclosure(rel));
      }),
    );
  });
});

/**
 * 「13 項目のどれ 1 つを欠いても公開できない」を、項目ごとに 1 行ずつ確かめる。
 *
 * --- なぜ上の性質テストでは足りなかったか ---
 * 上の `candidateArb` は**開示のまわりだけ**を揺らすために作られている。
 * 2026-08-21 の実測では、公開ゲートから更新責任者の条件を丸ごと殺しても
 * （`if (false && !c.updateOwnerId)`）、このファイルは **8 件すべて緑のまま**だった。
 * 落ちたのは `tests/domain/invariants.test.ts` の例 1 件だけである。
 * 「必要な条件を 1 つ落としても通る」という集合の主張を、開示以外については
 * 何も支えていなかった（`TM04` 型）。
 *
 * --- なぜ表を手で書くか ---
 * 違反の一覧を `GATE_REQUIREMENT_LABEL` から導くと、実装から条件が消えたときに
 * 表からも同時に消えて緑のままになる。表は仕様（ブログ層 §21）を写したもので、
 * 実装から導かない。項目を増減させれば `Record<GateRequirement, …>` が
 * `tsc --noEmit` で落ちる。
 */
const VALID_CANDIDATE: PublishCandidate = {
  articleType: "review",
  presentSections: requiredSectionsFor("review"),
  authorIds: ["author_1"],
  updateOwnerId: "owner_1",
  relationshipType: "affiliate",
  disclosureVisibleMessage: "この記事は広告を含みます。",
  claimCount: 3,
  evidenceCount: 3,
  hasAffiliateCta: true,
  merchantOptionCount: 2,
  imageRightsConfirmed: true,
  structuredDataValid: true,
  mobileChecked: true,
  linksChecked: true,
  aiAnswerEvalPassed: true,
  webmcpSchemaEval: true,
  nextReviewAt: new Date("2027-01-01T00:00:00Z"),
  now: NOW,
};

/** 項目ごとの「これ 1 つだけを欠いた記事」。1 項目に複数の欠け方がある場合は並べる。 */
const SINGLE_VIOLATIONS: Readonly<
  Record<GateRequirement, readonly (readonly [string, Partial<PublishCandidate>])[]>
> = {
  author: [["著者がいない", { authorIds: [] }]],
  disclosure: [
    ["広告との関係が未設定", { relationshipType: null }],
    ["表記が要るのに読者へ見せる文が空", { disclosureVisibleMessage: "   " }],
  ],
  evidence: [
    ["主張はあるが根拠が 0", { evidenceCount: 0 }],
    ["確認済みの主張が 0", { claimCount: 0 }],
  ],
  update_owner: [["更新責任者がいない", { updateOwnerId: null }]],
  cta_merchant_info: [["CTA はあるが販売店の選択肢が 0", { merchantOptionCount: 0 }]],
  image_rights: [["画像の利用許諾が未確認", { imageRightsConfirmed: false }]],
  structured_data: [["構造化データの検証に失敗", { structuredDataValid: false }]],
  mobile_check: [["スマートフォン表示の確認が未完了", { mobileChecked: false }]],
  link_check: [["リンク切れが見つかっている", { linksChecked: false }]],
  ai_answer_eval: [["AI 回答の評価が基準未満", { aiAnswerEvalPassed: false }]],
  webmcp_schema_eval: [["WebMCP のツール定義が検証を通っていない", { webmcpSchemaEval: false }]],
  required_sections: [["必須セクションが 1 つも無い", { presentSections: [] }]],
  next_review_date: [
    ["次回確認日が未設定", { nextReviewAt: null }],
    ["次回確認日が過去", { nextReviewAt: new Date("2026-01-01T00:00:00Z") }],
  ],
};

describe("公開ゲートの 13 項目（どれ 1 つ欠けても公開できない）", () => {
  it("すべてそろっていれば公開できる（この試験の前提が壊れていないこと）", () => {
    const result = evaluatePublishGate(VALID_CANDIDATE);
    expect(
      result.ok,
      result.failures.map((f) => f.message).join(" / "),
    ).toBe(true);
    expect(result.skipped).toHaveLength(0);
  });

  const rows = Object.entries(SINGLE_VIOLATIONS).flatMap(([requirement, cases]) =>
    cases.map(([name, patch]) => ({ requirement: requirement as GateRequirement, name, patch })),
  );

  it.each(rows)("$requirement: $name だけで公開できなくなる", ({ requirement, patch }) => {
    const result = evaluatePublishGate({ ...VALID_CANDIDATE, ...patch });

    expect(result.ok).toBe(false);
    // 「落ちた項目がその 1 つだけ」まで見る。別の項目が巻き添えで落ちているなら、
    // この行はその項目を測っていない。
    expect(result.failures.map((f) => f.requirement)).toEqual([requirement]);
    // 検査していないものを「検査した」と数えないこと。
    expect(result.skipped.map((s) => s.requirement)).not.toContain(requirement);
  });

  it("13 項目すべてに、少なくとも 1 つの欠け方が書かれている", () => {
    for (const [requirement, cases] of Object.entries(SINGLE_VIOLATIONS)) {
      expect(cases.length, `${requirement} の欠け方が書かれていません`).toBeGreaterThan(0);
    }
    expect(Object.keys(SINGLE_VIOLATIONS)).toHaveLength(13);
  });
});
