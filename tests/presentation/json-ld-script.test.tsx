/**
 * @tier 1
 * @req REQ-SEO01
 * @types contract, injection
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PublishedArticle } from "@/application/read-models/published-article";
import { ArticleStructuredData } from "@/presentation/site/article-structured-data";
import { JsonLdScript, JsonLdScripts } from "@/presentation/site/json-ld-script";
import { ARTICLE_SPEAKABLE_SELECTORS } from "@/presentation/ui/templates/article-view";

function jsonLdDocuments(html: string): readonly Record<string, unknown>[] {
  return [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(
    (match) => JSON.parse(match[1] ?? "{}") as Record<string, unknown>,
  );
}

describe("JSON-LD native script", () => {
  it("実行用Scriptではなくapplication/ld+jsonのnative scriptを描く", () => {
    const html = renderToStaticMarkup(<JsonLdScript value={{ "@type": "Article" }} />);

    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('"@type":"Article"');
  });

  it("script終端を含む値をHTMLとして実行できない形へ逃がす", () => {
    const html = renderToStaticMarkup(
      <JsonLdScript value={{ headline: "</script><script>alert(1)</script>" }} />,
    );

    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).toContain("\\u003c/script>");
  });

  it("nullable 配列から null を除き、残る文書を同じ順序で描く", () => {
    const html = renderToStaticMarkup(
      <JsonLdScripts
        values={[
          { "@type": "BlogPosting", headline: "最初" },
          null,
          { "@type": "HowTo", name: "最後 </script>" },
        ]}
      />,
    );

    expect(jsonLdDocuments(html).map((document) => document["@type"])).toEqual([
      "BlogPosting",
      "HowTo",
    ]);
    expect(html).not.toContain("最後 </script>");
    expect(html).toContain("最後 \\u003c/script>");
  });
});

describe("公開記事の JSON-LD 配線", () => {
  const guide: PublishedArticle = {
    slug: "desk-setup",
    siteSlug: "gadget",
    type: "guide",
    title: "在宅机の作り方",
    summary: "机を置く前に寸法を測る。",
    categorySlug: "desk",
    publishedAt: "2026-08-01",
    updatedAt: "2026-08-20",
    author: { slug: "writer", name: "編集部", bio: "実測担当。", credentials: [] },
    disclosureRequired: false,
    keyPoints: ["通路を確保する"],
    sections: [
      { id: "steps", heading: "手順", paragraphs: ["奥行きを測る。", "机を置く。"] },
    ],
  };

  it("HowTo と Speakable を含む公開記事の文書を native script として描く", () => {
    const html = renderToStaticMarkup(
      <ArticleStructuredData
        article={guide}
        siteName="ガジェット研究室"
        origin="https://example.com"
        basePath="/s/gadget"
        speakableSelectors={ARTICLE_SPEAKABLE_SELECTORS}
      />,
    );
    const documents = jsonLdDocuments(html);

    expect(documents.map((document) => document["@type"])).toEqual([
      "BlogPosting",
      "BreadcrumbList",
      "HowTo",
      "WebPage",
    ]);
    expect(documents.find((document) => document["@type"] === "HowTo")?.step).toEqual([
      { "@type": "HowToStep", text: "奥行きを測る。" },
      { "@type": "HowToStep", text: "机を置く。" },
    ]);
    expect(documents.find((document) => document["@type"] === "WebPage")?.speakable).toEqual({
      "@type": "SpeakableSpecification",
      cssSelector: [ARTICLE_SPEAKABLE_SELECTORS.answer, ARTICLE_SPEAKABLE_SELECTORS.keyPoints],
    });
  });
});
