/**
 * @tier 1
 * @req REQ-SEO02
 * @types equivalence, boundary
 */
import { describe, expect, it } from "vitest";
import type { ArticleSummary } from "@/application/read-models/published-article";
import {
  AI_CRAWLERS,
  buildLlmsTxt,
  buildRobotsTxt,
  buildRssXml,
  buildSitemapXml,
} from "@/application/seo/feeds";

const items: readonly ArticleSummary[] = [
  {
    slug: "laptops",
    siteSlug: "gadget",
    type: "ranking",
    title: "10 万円台 & <おすすめ> ノート",
    summary: "実測で比べた \"結論\" を先に。",
    categorySlug: "laptop",
    updatedAt: "2026-08-20",
    authorName: "編集部",
  },
];

describe("robots.txt", () => {
  const robots = buildRobotsTxt("https://example.com", "/s/gadget", { emitLlmsTxt: true });

  it("AI クローラー 4 種を明示的に Allow する", () => {
    for (const crawler of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
      expect(robots).toContain(`User-agent: ${crawler}\nAllow: /`);
    }
    expect(AI_CRAWLERS).toHaveLength(4);
  });

  it("遮断（Disallow）を 1 行も書かない", () => {
    expect(robots).not.toContain("Disallow");
  });

  it("Sitemap の行がある", () => {
    expect(robots).toContain("Sitemap: https://example.com/s/gadget/sitemap.xml");
  });

  it("llms.txt を出すブログでは在り処の注記が付き、出さないブログでは付かない", () => {
    expect(robots).toContain("/s/gadget/llms.txt");
    const without = buildRobotsTxt("https://example.com", "/s/gadget", { emitLlmsTxt: false });
    expect(without).not.toContain("llms.txt");
  });
});

describe("sitemap.xml", () => {
  it("loc と lastmod が入り、URL の & が逃がされる", () => {
    const xml = buildSitemapXml("https://example.com", "/s/gadget", [
      { path: "/best/laptops?a=1&b=2", updatedAt: "2026-08-20" },
    ]);
    expect(xml).toContain("<loc>https://example.com/s/gadget/best/laptops?a=1&amp;b=2</loc>");
    expect(xml).toContain("<lastmod>2026-08-20</lastmod>");
    expect(xml).toContain(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);
  });
});

describe("RSS", () => {
  const xml = buildRssXml(
    {
      siteName: "ガジェット研究室 <公式>",
      origin: "https://example.com",
      basePath: "/s/gadget",
      description: "実測で比べるブログ。",
    },
    items,
  );

  it("題名・説明の < > \" & が逃がされる（記事の題は利用者が書ける文字列）", () => {
    expect(xml).toContain("10 万円台 &amp; &lt;おすすめ&gt; ノート");
    expect(xml).toContain("実測で比べた &quot;結論&quot; を先に。");
    expect(xml).toContain("ガジェット研究室 &lt;公式&gt;");
  });

  it("リンクは articleHref の道と一致する", () => {
    expect(xml).toContain("<link>https://example.com/s/gadget/best/laptops</link>");
  });
});

describe("llms.txt", () => {
  it("# サイト名・> 説明・## 記事一覧のリンク列の形になる", () => {
    const text = buildLlmsTxt(
      {
        siteName: "ガジェット研究室",
        purpose: "実測で比べる。",
        origin: "https://example.com",
        basePath: "/s/gadget",
      },
      items,
    );
    expect(text).toContain("# ガジェット研究室");
    expect(text).toContain("> 実測で比べる。");
    expect(text).toContain("## 記事一覧");
    expect(text).toContain(
      '- [10 万円台 & <おすすめ> ノート](https://example.com/s/gadget/best/laptops): 実測で比べた "結論" を先に。',
    );
  });
});
