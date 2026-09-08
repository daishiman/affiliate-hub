/** @tier 1 @req REQ-SEO08, REQ-SEO11 @types equivalence, boundary */
import { publicPageInventory } from "@/application/seo/static-audit-inventory";
import type { PublishedArticle } from "@/application/read-models/published-article";
import { describe, expect, it } from "vitest";

function site() {
  return {
    pages: [
      "home", "category", "ranking", "review", "comparison", "how_to_choose",
      "tools", "authors", "experts", "methodology", "editorial_policy",
      "advertising_policy", "ai_policy", "privacy", "terms", "contact",
    ] as const,
    categories: [
      { slug: "desk", name: "デスク", oneLine: "机まわり" },
      { slug: "audio", name: "音響", oneLine: "音の道具" },
      { slug: "empty", name: "準備中", oneLine: "記事を準備しています" },
    ],
    emitLlmsTxt: true,
  };
}

const publishedDocuments = [
  { key: "privacy" as const, updatedAt: "2026-09-03T00:00:00.000Z" },
  { key: "methodology" as const, updatedAt: "2026-09-02T00:00:00.000Z" },
  // blueprint.pages に無くても、公開readerが返す文書は対象に含める。
  { key: "operator" as const, updatedAt: "2026-09-01T00:00:00.000Z" },
];

function article(index: number, over: Partial<PublishedArticle> = {}): PublishedArticle {
  return {
    siteSlug: "tools", slug: `guide-${index}`, type: "guide", title: `記事${index}`,
    summary: "選び方を説明します。", categorySlug: index % 2 ? "desk" : "audio",
    publishedAt: "2026-09-01", updatedAt: `2026-09-${String((index % 7) + 1).padStart(2, "0")}`,
    author: { slug: index % 2 ? "writer-a" : "writer-b", name: "書き手", bio: "", credentials: [] },
    reviewedBy: index === 0 ? { slug: "expert-a", name: "監修者", bio: "", credentials: [] } : undefined,
    disclosureRequired: false, sections: [], ...over,
  };
}

describe("サイト横断静的監査の公開ページ集合", () => {
  it("静的入口・全記事・category・author・expert・実在paginationを重複なく列挙する", () => {
    const result = publicPageInventory({
      siteSlug: "tools", origin: "https://example.com", basePath: "/s/tools",
      site: site(), articles: Array.from({ length: 31 }, (_, index) => article(index)), publishedDocuments,
    });
    const urls = result.targets.map((target) => target.url);

    expect(result.complete).toBe(true);
    expect(urls).toContain("https://example.com/s/tools");
    expect(urls).toContain("https://example.com/s/tools/guides/guide-30");
    expect(urls).toContain("https://example.com/s/tools/categories/desk");
    expect(urls).toContain("https://example.com/s/tools/categories/empty");
    expect(urls).toContain("https://example.com/s/tools/authors/writer-a");
    expect(urls).toContain("https://example.com/s/tools/experts/expert-a");
    expect(urls).toContain("https://example.com/s/tools/blog?page=2");
    expect(urls).toContain("https://example.com/s/tools/guides?page=2");
    expect(urls).toContain("https://example.com/s/tools/privacy");
    expect(urls).toContain("https://example.com/s/tools/operator");
    expect(urls).not.toContain("https://example.com/s/tools/advertising-policy");
    expect(result.targets.find((target) => target.url.endsWith("/privacy"))?.updatedAt)
      .toBe("2026-09-03T00:00:00.000Z");
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("別siteの記事を混ぜず、上限超過を全体完了にしない", () => {
    const result = publicPageInventory({
      siteSlug: "tools", origin: "https://example.com", basePath: "/s/tools",
      site: site(), articles: [article(1), article(2, { siteSlug: "other" })], publishedDocuments, limit: 1,
    });

    expect(result.targets).toHaveLength(1);
    expect(result.total).toBeGreaterThan(1);
    expect(result.complete).toBe(false);
    expect(result.targets.every((target) => !target.url.includes("other"))).toBe(true);
  });

  it("page=2だけを独立PageKeyにし、page=1と追跡queryは正規URLへ畳む", () => {
    const base = "https://example.com/s/tools/blog";
    const result = publicPageInventory({ siteSlug: "tools", origin: "https://example.com",
      basePath: "/s/tools", site: site(), articles: Array.from({ length: 31 }, (_, i) => article(i)), publishedDocuments });
    const first = result.targets.find((target) => target.url === base);
    const second = result.targets.find((target) => target.url === `${base}?page=2`);
    expect(first?.pageKey).toBe("example.com/s/tools/blog");
    expect(second?.pageKey).toBe("example.com/s/tools/blog?page=2");
  });
});
