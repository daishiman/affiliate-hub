/**
 * @tier 1
 * @req REQ-P02, REQ-A07
 * @types equivalence, boundary, ssrf
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canDisplayAffiliatePreviewImage,
  extractAffiliatePreview,
  resolveAffiliatePreviewProvider,
  type AffiliatePreviewProviderPolicy,
} from "@/domain/monetization";

const FIXTURE_POLICY: AffiliatePreviewProviderPolicy = {
  id: "fixture-provider",
  label: "Fixture provider",
  fetchHosts: ["shop.provider.test"],
  imageHosts: ["images.provider.test"],
  imageDisplayAllowed: true,
};

describe("affiliate URL preview", () => {
  it("extracts JSON-LD before Open Graph and preserves unknowns as null", () => {
    const html = readFileSync(
      "tests/fixtures/reference-blog-admin-ux/product-preview.html",
      "utf8",
    );
    const preview = extractAffiliatePreview({
      rawUrl: "https://shop.provider.test/a?id=1",
      finalUrl: "https://shop.provider.test/products/diagram-kit",
      html,
      retrievedAt: new Date("2026-08-29T12:00:00Z"),
      policy: FIXTURE_POLICY,
    });

    expect(preview.status).toBe("ready");
    expect(preview.productName).toBe("図解キット");
    expect(preview.merchantName).toBe("Example Works");
    expect(preview.price).toBe("4980");
    expect(preview.currency).toBe("JPY");
    expect(preview.method).toBe("json-ld");
    expect(preview.imageUrl).toBe("https://images.provider.test/diagram-kit.png");
    expect(preview.oneLine).toBeNull();
  });

  it("falls back to Open Graph without inventing price or merchant", () => {
    const preview = extractAffiliatePreview({
      rawUrl: "https://shop.provider.test/a",
      finalUrl: "https://shop.provider.test/a",
      html: '<meta property="og:title" content="なめらかペン"><meta property="og:description" content="書き心地を確かめるためのペン。">',
      retrievedAt: new Date("2026-08-29T12:00:00Z"),
      policy: FIXTURE_POLICY,
    });

    expect(preview.status).toBe("partial");
    expect(preview.productName).toBe("なめらかペン");
    expect(preview.oneLine).toBe("書き心地を確かめるためのペン。");
    expect(preview.method).toBe("open-graph");
    expect(preview.price).toBeNull();
    expect(preview.currency).toBeNull();
    expect(preview.merchantName).toBeNull();
  });

  it("uses a default-deny provider policy", () => {
    expect(resolveAffiliatePreviewProvider("https://unknown.example/item", [FIXTURE_POLICY])).toEqual({
      ok: false,
      reason: "この提携先は自動取得に未対応です。",
    });
    expect(
      resolveAffiliatePreviewProvider("https://shop.provider.test/item", [FIXTURE_POLICY]),
    ).toEqual({ ok: true, policy: FIXTURE_POLICY });
  });

  it("only exposes a remote image when protocol, public host and rights policy all pass", () => {
    expect(
      canDisplayAffiliatePreviewImage(
        "https://images.provider.test/item.png",
        FIXTURE_POLICY,
      ),
    ).toBe(true);
    expect(
      canDisplayAffiliatePreviewImage("http://images.provider.test/item.png", FIXTURE_POLICY),
    ).toBe(false);
    expect(
      canDisplayAffiliatePreviewImage("https://127.0.0.1/item.png", FIXTURE_POLICY),
    ).toBe(false);
    expect(
      canDisplayAffiliatePreviewImage("https://images.provider.test/item.png", {
        ...FIXTURE_POLICY,
        imageDisplayAllowed: false,
      }),
    ).toBe(false);
  });
});
