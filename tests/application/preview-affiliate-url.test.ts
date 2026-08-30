/** @tier 2 @req REQ-P02, REQ-A07 @types permission-matrix, idempotency */
import { describe, expect, it, vi } from "vitest";
import type { AffiliatePreviewFetcherPort } from "@/application/ports/monetization";
import { createPreviewAffiliateUrlUseCase } from "@/application/usecases/monetization/preview-affiliate-url";
import type { AffiliatePreview } from "@/domain/monetization";
import { createSampleAffiliateLinkRepository } from "@/infrastructure/persistence/sample/affiliate-sample-repository";
import { createSampleLinkIngestionRepository } from "@/infrastructure/persistence/sample/link-inbox-sample-repository";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { aNobody, anOwner } from "../support/actors";

const RAW = "https://example.invalid/asp/amazon/p_alpha_15";
const PREVIEW: AffiliatePreview = {
  rawUrl: RAW,
  canonicalUrl: RAW,
  productName: "Alpha Studio 15",
  merchantName: "Alpha",
  oneLine: null,
  imageUrl: null,
  price: null,
  currency: null,
  retrievedAt: "2026-08-29T12:00:00.000Z",
  sourceHost: "example.invalid",
  method: "open-graph",
  status: "partial",
  reason: null,
  duplicateCandidates: [],
  providerId: "fixture",
  providerLabel: "Fixture",
};

function subject(fetcher: AffiliatePreviewFetcherPort) {
  return createPreviewAffiliateUrlUseCase({
    fetcher,
    inbox: createSampleLinkIngestionRepository(),
    links: createSampleAffiliateLinkRepository(),
  });
}

describe("preview affiliate URL", () => {
  it("checks capability before external fetch", async () => {
    const retrieve = vi.fn(async () => ({ kind: "ok" as const, preview: PREVIEW }));
    const result = await subject({ retrieve }).execute(aNobody({ workspaceId: SAMPLE_WORKSPACE_ID }), {
      rawUrl: RAW,
    });
    expect(result.ok).toBe(false);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("marks existing original/canonical/product candidates without writing", async () => {
    const result = await subject({ retrieve: async () => ({ kind: "ok", preview: PREVIEW }) }).execute(
      anOwner({ workspaceId: SAMPLE_WORKSPACE_ID }),
      { rawUrl: RAW },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.preview.status).toBe("duplicate");
    expect(result.value.preview.duplicateCandidates.length).toBeGreaterThan(0);
  });
});
