/** @tier 1 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { requiredSectionsFor, type ArticleType } from "@/domain/authoring/article-structure";
import {
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
