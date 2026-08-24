/**
 * @tier 1
 * @req REQ-SEO01
 * @types equivalence, integration
 */
import { describe, expect, it, vi } from "vitest";

const metadataRequest = vi.hoisted(() => ({
  headers: new Headers({ host: "example.com", "x-forwarded-proto": "https" }),
}));

vi.mock("next/headers", () => ({
  headers: async () => metadataRequest.headers,
}));

vi.mock("@/presentation/composition", () => ({
  readerActor: () => ({ kind: "anonymous" }),
  siteUseCases: async () => ({
    getArticle: {
      execute: async (_actor: unknown, input: { readonly slug: string }) => ({
        ok: true as const,
        value: {
          slug: input.slug,
          siteSlug: "gadget",
          type: "guide",
          title: `記事: ${input.slug}`,
          summary: "要約。",
          categorySlug: "laptops",
          publishedAt: "2026-08-20",
          updatedAt: "2026-08-24",
          author: { slug: "editor", name: "編集部", bio: "紹介。", credentials: [] },
          disclosureRequired: false,
          sections: [],
        },
      }),
    },
    getSite: {
      execute: async () => ({
        ok: true as const,
        value: { blueprint: { name: "ガジェット研究室" } },
      }),
    },
  }),
}));

const { createArticlePageMetadata, siteCanonicalPath, siteMetadataUrl } = await import(
  "@/presentation/site/site-metadata"
);

describe("公開ページのmetadata共通アダプター", () => {
  it("異なる route param 名をそれぞれの記事slugへ投影する", async () => {
    const [topic, comparison, product] = await Promise.all([
      createArticlePageMetadata("topic")({
        params: Promise.resolve({ site: "gadget", topic: "guide-item" }),
      }),
      createArticlePageMetadata("comparison")({
        params: Promise.resolve({ site: "gadget", comparison: "compare-item" }),
      }),
      createArticlePageMetadata("product")({
        params: Promise.resolve({ site: "gadget", product: "review-item" }),
      }),
    ]);

    expect(topic.title).toBe("記事: guide-item");
    expect(topic.alternates?.canonical).toBe(
      "https://example.com/s/gadget/guides/guide-item",
    );
    expect(comparison.alternates?.canonical).toBe(
      "https://example.com/s/gadget/guides/compare-item",
    );
    expect(product.alternates?.canonical).toBe(
      "https://example.com/s/gadget/guides/review-item",
    );
  });

  it("サイト直下と子ページのcanonical pathを1つの規則で合成する", () => {
    expect(siteCanonicalPath("gadget")).toBe("/s/gadget");
    expect(siteCanonicalPath("gadget", "/tools/diagnosis")).toBe(
      "/s/gadget/tools/diagnosis",
    );
  });

  it("転送元のhostとprotocolからマルチホスト用の絶対URLを作る", async () => {
    metadataRequest.headers = new Headers({
      host: "internal.example",
      "x-forwarded-host": "blog.example.jp",
      "x-forwarded-proto": "https",
    });

    await expect(siteMetadataUrl("gadget", "/tools/diagnosis")).resolves.toBe(
      "https://blog.example.jp/s/gadget/tools/diagnosis",
    );
  });

  it("request hostが無い場合は誤った相対canonicalを配らない", async () => {
    metadataRequest.headers = new Headers();

    const metadata = await createArticlePageMetadata("topic")({
      params: Promise.resolve({ site: "gadget", topic: "guide-item" }),
    });

    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).not.toHaveProperty("url");
  });
});
