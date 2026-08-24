/**
 * @tier 1
 * @req REQ-SEO02
 * @types equivalence, boundary
 *
 * --- なぜ `describe` の直下で組み立てないのか（2026-08-24 に直した） ---
 *
 * もとは `describe("robots.txt", () => { const robots = buildRobotsTxt(...) })` と
 * 書いてあった。**テストは緑だが、変異は 1 つも死んでいなかった。**
 *
 * Stryker の `perTest` は「どのテストの実行中に、その行が通ったか」で
 * 変異とテストを結ぶ。`describe` の本体はテストの**収集時**に走るので、
 * そこで組み立てた文字列を後から `expect` しても、通った行はどのテストにも
 * 結ばれない。報告には `covered 0` と出る——**測れていない、という意味**であって
 * 「変異が無い」ではない。robots.txt の 3 件と RSS の 2 件が、まるごとこれだった。
 *
 * だから組み立てはすべて `it` の中で行う。緑であることと、
 * 壊したときに赤くなることは別物で、後者はこの置き方でしか測れない。
 */
import { describe, expect, it } from "vitest";
import type { ArticleSummary } from "@/application/read-models/published-article";
import {
  AI_CRAWLERS,
  buildLlmsTxt,
  buildRobotsTxt,
  buildRssXml,
  buildSitemapXml,
  canonicalSiteUrl,
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

const rssSite = {
  siteName: "ガジェット研究室 <公式>",
  origin: "https://example.com",
  basePath: "/s/gadget",
  description: "実測で比べる、'あて推量ではない' ブログ。",
};

describe("公開 URL の組み立て", () => {
  it("ホスト・ブログ基底パス・サイト内の道を、この順でつなぐ", () => {
    expect(canonicalSiteUrl({ origin: "https://example.com", basePath: "/s/gadget" }, "/best/x")).toBe(
      "https://example.com/s/gadget/best/x",
    );
  });

  it("道を渡さなければブログのトップになる（末尾に余計な / を足さない）", () => {
    expect(canonicalSiteUrl({ origin: "https://example.com", basePath: "/s/gadget" })).toBe(
      "https://example.com/s/gadget",
    );
  });
});

describe("robots.txt", () => {
  it("AI クローラー 4 種を明示的に Allow する", () => {
    const robots = buildRobotsTxt("https://example.com", "/s/gadget", { emitLlmsTxt: true });
    for (const crawler of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
      expect(robots).toContain(`User-agent: ${crawler}\nAllow: /`);
    }
    expect(AI_CRAWLERS).toHaveLength(4);
    expect([...AI_CRAWLERS]).toEqual(["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]);
  });

  it("既定の User-agent: * が Allow: / で始まる（4 種の前に、全部への許可がある）", () => {
    const robots = buildRobotsTxt("https://example.com", "/s/gadget", { emitLlmsTxt: false });
    expect(robots.startsWith("User-agent: *\nAllow: /\n")).toBe(true);
  });

  it("遮断（Disallow）を 1 行も書かない", () => {
    const robots = buildRobotsTxt("https://example.com", "/s/gadget", { emitLlmsTxt: true });
    expect(robots).not.toContain("Disallow");
  });

  it("Sitemap の行がある", () => {
    const robots = buildRobotsTxt("https://example.com", "/s/gadget", { emitLlmsTxt: true });
    expect(robots).toContain("Sitemap: https://example.com/s/gadget/sitemap.xml");
  });

  it("Sitemap の行は最後に来る（注記の中に埋もれない）", () => {
    const robots = buildRobotsTxt("https://example.com", "/s/gadget", { emitLlmsTxt: true });
    const lines = robots.split("\n").filter((l) => l !== "");
    expect(lines[lines.length - 1]).toBe("Sitemap: https://example.com/s/gadget/sitemap.xml");
  });

  it("llms.txt を出すブログでは在り処の注記が付き、出さないブログでは付かない", () => {
    const robots = buildRobotsTxt("https://example.com", "/s/gadget", { emitLlmsTxt: true });
    expect(robots).toContain("# llms.txt: https://example.com/s/gadget/llms.txt");
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
    expect(xml.startsWith(`<?xml version="1.0" encoding="UTF-8"?>\n`)).toBe(true);
    expect(xml).toContain("</urlset>");
  });

  it("複数件が改行で並び、1 件ごとに url の対が立つ", () => {
    const xml = buildSitemapXml("https://example.com", "/s/gadget", [
      { path: "/a", updatedAt: "2026-08-01" },
      { path: "/b", updatedAt: "2026-08-02" },
    ]);
    expect(xml.match(/<url>/g)).toHaveLength(2);
    expect(xml).toContain("<loc>https://example.com/s/gadget/a</loc>");
    expect(xml).toContain("<loc>https://example.com/s/gadget/b</loc>");
  });

  it("1 件も無ければ、空の urlset を返す（壊れた XML にしない）", () => {
    const xml = buildSitemapXml("https://example.com", "/s/gadget", []);
    expect(xml).toContain("<urlset");
    expect(xml).toContain("</urlset>");
    expect(xml).not.toContain("<url>");
  });
});

describe("RSS", () => {
  it("題名・説明の < > \" & ' が逃がされる（記事の題は利用者が書ける文字列）", () => {
    const xml = buildRssXml(rssSite, items);
    expect(xml).toContain("10 万円台 &amp; &lt;おすすめ&gt; ノート");
    expect(xml).toContain("実測で比べた &quot;結論&quot; を先に。");
    expect(xml).toContain("ガジェット研究室 &lt;公式&gt;");
    expect(xml).toContain("&apos;あて推量ではない&apos;");
  });

  it("リンクは articleHref の道と一致する", () => {
    const xml = buildRssXml(rssSite, items);
    expect(xml).toContain("<link>https://example.com/s/gadget/best/laptops</link>");
  });

  it("guid は link と同じ値を isPermaLink=true で持つ", () => {
    const xml = buildRssXml(rssSite, items);
    expect(xml).toContain(
      '<guid isPermaLink="true">https://example.com/s/gadget/best/laptops</guid>',
    );
  });

  it("channel の link はブログのトップ（記事の URL ではない）", () => {
    const xml = buildRssXml(rssSite, items);
    expect(xml).toContain("<link>https://example.com/s/gadget</link>");
    expect(xml).toContain(`<rss version="2.0">`);
    expect(xml).toContain("<channel>");
  });

  it("pubDate は YYYY-MM-DD を UTC 0 時として RFC 822 で出す", () => {
    const xml = buildRssXml(rssSite, items);
    expect(xml).toContain("<pubDate>Thu, 20 Aug 2026 00:00:00 GMT</pubDate>");
  });

  it("読めない日付の記事は、pubDate の行そのものを出さない（壊れた日付を配らない）", () => {
    const xml = buildRssXml(rssSite, [{ ...items[0], updatedAt: "不明" }]);
    expect(xml).not.toContain("<pubDate>");
    // 日付が読めないだけで item ごと消してはいけない。
    expect(xml).toContain("<title>10 万円台 &amp; &lt;おすすめ&gt; ノート</title>");
  });

  it("1 件も無ければ item を出さず、channel は閉じる", () => {
    const xml = buildRssXml(rssSite, []);
    expect(xml).not.toContain("<item>");
    expect(xml).toContain("</channel>");
    expect(xml).toContain("</rss>");
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

  it("Markdown なので、題の < > をエスケープしない（XML の逃がしを持ち込まない）", () => {
    const text = buildLlmsTxt(
      { siteName: "研究室 <公式>", purpose: "実測。", origin: "https://example.com", basePath: "/s/g" },
      [],
    );
    expect(text).toContain("# 研究室 <公式>");
    expect(text).not.toContain("&lt;");
  });

  it("記事が 1 件も無くても、見出しの骨組みは残る", () => {
    const text = buildLlmsTxt(
      { siteName: "研究室", purpose: "実測。", origin: "https://example.com", basePath: "/s/g" },
      [],
    );
    expect(text).toContain("# 研究室");
    expect(text).toContain("## 記事一覧");
    expect(text).not.toContain("- [");
  });
});
