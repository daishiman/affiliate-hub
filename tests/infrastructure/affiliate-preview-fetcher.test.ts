/** @tier 1 @req REQ-P02 @types ssrf, boundary */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { AffiliatePreviewProviderPolicy } from "@/domain/monetization";
import { createAffiliatePreviewFetcher } from "@/infrastructure/http/affiliate-preview-fetcher";

const policy: AffiliatePreviewProviderPolicy = {
  id: "fixture",
  label: "Fixture",
  fetchHosts: ["shop.provider.test"],
  imageHosts: ["images.provider.test"],
  imageDisplayAllowed: true,
};

describe("affiliate preview fetcher", () => {
  it("never calls fetch for a host outside the default-deny provider list", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await createAffiliatePreviewFetcher({ fetchImpl, policies: [policy] }).retrieve(
      "https://unknown.example/item",
    );
    expect(result.kind).toBe("rejected");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("parses bounded HTML and returns metadata rather than the body", async () => {
    const html = readFileSync("tests/fixtures/reference-blog-admin-ux/product-preview.html", "utf8");
    const result = await createAffiliatePreviewFetcher({
      policies: [policy],
      now: () => new Date("2026-08-29T12:00:00Z"),
      fetchImpl: async () => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }),
    }).retrieve("https://shop.provider.test/item");
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.preview.productName).toBe("図解キット");
    expect(result.preview).not.toHaveProperty("body");
  });

  it("does not parse non-HTML content", async () => {
    const getReader = vi.fn(() => {
      throw new Error("本文を読んではいけない");
    });
    const cancel = vi.fn(async () => undefined);
    const response = new Response(null, { headers: { "content-type": "image/png" } });
    Object.defineProperty(response, "body", { value: { getReader, cancel } });
    const result = await createAffiliatePreviewFetcher({
      policies: [policy],
      fetchImpl: async () => response,
    }).retrieve("https://shop.provider.test/item");
    expect(result).toEqual({ kind: "failed", reason: "HTML以外の内容は自動解析しません。" });
    expect(getReader).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("re-applies the provider policy before every redirect fetch", async () => {
    const calls: string[] = [];
    const result = await createAffiliatePreviewFetcher({
      policies: [policy],
      fetchImpl: async (input) => {
        const url = String(input);
        calls.push(url);
        return new Response(null, {
          status: 302,
          headers: { location: "https://unknown.example/final" },
        });
      },
    }).retrieve("https://shop.provider.test/start");
    expect(result.kind).toBe("rejected");
    expect(calls).toEqual(["https://shop.provider.test/start"]);
  });
});
