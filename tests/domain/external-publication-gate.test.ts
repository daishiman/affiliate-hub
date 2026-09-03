/** @tier 1 @req REQ-A06 */
import { describe, expect, it } from "vitest";
import { requiredSectionsFor } from "@/domain/authoring/article-structure";
import {
  evaluateExternalPublicationGate,
  evaluatePublishGate,
  type PublishCandidate,
} from "@/domain/compliance";

const candidate = {
  status: "approved" as const,
  complianceStatus: "pass" as const,
  disclosure: "広告",
  authorPersonaId: "author_1" as never,
  claimIds: ["claim_1" as never],
  evidenceIds: ["evidence_1" as never],
};

const siteCandidate: PublishCandidate = {
  articleType: "review",
  presentSections: requiredSectionsFor("review"),
  authorIds: ["author_1"],
  updateOwnerId: "owner_1",
  relationshipType: "affiliate",
  disclosureVisibleMessage: "広告",
  claimCount: 1,
  evidenceCount: 1,
  hasAffiliateCta: false,
  merchantOptionCount: 0,
  imageRightsConfirmed: true,
  structuredDataValid: true,
  mobileChecked: true,
  linksChecked: true,
  aiAnswerEvalPassed: true,
  webmcpSchemaEval: "not_applicable",
  nextReviewAt: new Date("2027-01-01T00:00:00Z"),
  now: new Date("2026-08-27T00:00:00Z"),
};

function failureSemantics(
  result: ReturnType<typeof evaluatePublishGate>,
  requirement: "author" | "disclosure" | "evidence",
) {
  return result.failures
    .filter((failure) => failure.requirement === requirement)
    .map(({ requirement: failedRequirement, message }) => ({
      requirement: failedRequirement,
      message,
    }));
}

describe("外部媒体の公開前評価", () => {
  it("人の承認・表現確認・広告表記・根拠が揃った版だけを通す", () => {
    expect(evaluateExternalPublicationGate(candidate).ok).toBe(true);

    for (const changed of [
      { ...candidate, status: "review" as const },
      { ...candidate, complianceStatus: "fail" as const },
      { ...candidate, disclosure: "" },
      { ...candidate, claimIds: [] },
      { ...candidate, evidenceIds: [] },
    ]) {
      expect(evaluateExternalPublicationGate(changed).ok).toBe(false);
    }
  });

  it.each([
    {
      name: "著者がない",
      requirement: "author" as const,
      site: { authorIds: [] },
      external: { authorPersonaId: "" as never },
    },
    {
      name: "必須の広告表記がない",
      requirement: "disclosure" as const,
      site: { disclosureVisibleMessage: "" },
      external: { disclosure: "" },
    },
    {
      name: "確認済みの主張がない",
      requirement: "evidence" as const,
      site: { claimCount: 0, evidenceCount: 0 },
      external: { claimIds: [], evidenceIds: [] },
    },
    {
      name: "主張はあるが根拠がない",
      requirement: "evidence" as const,
      site: { claimCount: 1, evidenceCount: 0 },
      external: { claimIds: ["claim_1" as never], evidenceIds: [] },
    },
  ])("共通policy: $nameのとき両経路の修正案が同じ", ({ requirement, site, external }) => {
    const siteResult = evaluatePublishGate({ ...siteCandidate, ...site });
    const externalResult = evaluateExternalPublicationGate({ ...candidate, ...external });

    expect(failureSemantics(siteResult, requirement)).toEqual(
      failureSemantics(externalResult, requirement),
    );
    expect(failureSemantics(siteResult, requirement)).toHaveLength(1);
  });
});
