/**
 * @tier 2
 * @req REQ-BOPS04, REQ-BOPS05
 * @types contract, regression, boundary
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { projectBlogArticle } from "@/application/read-models/published-article";
import { serializeProse } from "@/domain/blogops";
import { renderCanonicalSectionBody } from "@/presentation/site/article-page";
import { toArticleView } from "@/presentation/site/view-model";
import { ArticleView, type ArticleViewModel } from "@/presentation/ui/templates/article-view";

function article(over: Partial<ArticleViewModel> = {}): ArticleViewModel {
  return {
    title: "静かなキーボードの選び方",
    summary: "音を比べて選びます。",
    publishedAt: "2026-09-01",
    updatedAt: "2026-09-02",
    authorName: "編集部",
    authorHref: "/s/desk/authors/editorial",
    disclosureRequired: false,
    methodologyHref: "/s/desk/methodology",
    policyHref: "/s/desk/advertising-policy",
    sections: [
      {
        id: "legacy",
        heading: "以前の記事",
        paragraphs: ["### これは文字通りの段落です。"],
      },
    ],
    ...over,
  };
}

function richArticle(source: string): ArticleViewModel {
  return toArticleView(
    "desk",
    projectBlogArticle({
      id: "article-1",
      siteSlug: "desk",
      slug: "quiet-keyboard",
      type: "guide",
      title: "静かなキーボードの選び方",
      lead: "音を比べて選びます。",
      authorName: "編集部",
      publishedAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-02T00:00:00.000Z"),
      categorySlug: "keyboards",
      blocks: [{ id: "body", kind: "intro-box", heading: "選び方", body: source }],
    }),
  );
}

describe("共通の記事の器", () => {
  it("本文rendererを渡さなければ、旧記事のDOMを完全に維持する", () => {
    const html = renderToStaticMarkup(<ArticleView article={article()} />);

    expect(html).toContain("<p>### これは文字通りの段落です。</p>");
    expect(html).not.toContain("<h3>これは文字通りの段落です。</h3>");
  });

  it("本文rendererを渡したときだけ、その描画結果を節の中に置く", () => {
    const source = serializeProse([
      { kind: "heading", level: 3, text: "打鍵音を見る" },
      { kind: "bullet-list", items: ["静音軸", "吸音材"] },
    ]);
    const view = richArticle(source);
    const html = renderToStaticMarkup(
      <ArticleView article={view} renderSectionBody={renderCanonicalSectionBody} />,
    );

    expect(html).toContain("<h3");
    expect(html).toContain("打鍵音を見る");
    expect(html).toContain("<ul>");
    expect(html).toContain("静音軸");
  });
});

describe("canonical公開記事の本文合成", () => {
  it("本文中の商品を既存の商品カードでその位置に一度だけ描く", () => {
    const view = richArticle(serializeProse([
      { kind: "paragraph", text: "ここで紹介します。" },
      { kind: "product-card", productId: "product-1" },
      { kind: "paragraph", text: "続いて使い方です。" },
    ]));
    const output = renderToStaticMarkup(
      <ArticleView
        article={{ ...view, inlineProductCards: [{
          productId: "product-1", name: "静音キーボード", brand: "机の道具",
          oneLine: "自宅で使う道具", specs: [],
        }] }}
        renderSectionBody={renderCanonicalSectionBody}
      />,
    );
    expect(output).toContain('aria-label="机の道具 静音キーボード"');
    expect(output.indexOf("ここで紹介します。")).toBeLessThan(output.indexOf("静音キーボード"));
    expect(output.indexOf("静音キーボード")).toBeLessThan(output.indexOf("続いて使い方です。"));
    expect(output.match(/aria-label="机の道具 静音キーボード"/g)).toHaveLength(1);
    expect(output).not.toContain("この位置の商品情報は現在表示できません");
  });

  it("形式の印が無い旧記事は、Proseとして推測せず文字通り表示する", () => {
    const view = article();
    const section = view.sections[0]!;
    const fallback = <p>{section.paragraphs[0]}</p>;

    expect(renderToStaticMarkup(<>{renderCanonicalSectionBody(section, fallback)}</>)).toBe(
      "<p>### これは文字通りの段落です。</p>",
    );
  });

  it("未知の版は無理に解釈せず、既存段落へ戻す", () => {
    const section = {
      ...article().sections[0]!,
      formattedBody: { format: "prose-v2", version: 2, source: "### 新版" },
    };
    const fallback = <p>安全な旧表示</p>;

    expect(renderToStaticMarkup(<>{renderCanonicalSectionBody(section, fallback)}</>)).toBe(
      "<p>安全な旧表示</p>",
    );
  });

  it.each([
    { name: "source欠落", formattedBody: { format: "prose-v1", version: 1 } },
    {
      name: "source非文字列",
      formattedBody: { format: "prose-v1", version: 1, source: { raw: "### 壊れた本文" } },
    },
  ])("壊れた形式情報（$name）はthrowせず、既存段落へ戻す", ({ formattedBody }) => {
    const section = JSON.parse(
      JSON.stringify({
        ...article().sections[0]!,
        formattedBody,
      }),
    ) as ArticleViewModel["sections"][number];
    const fallback = <p>安全な旧表示</p>;

    expect(() =>
      renderToStaticMarkup(<>{renderCanonicalSectionBody(section, fallback)}</>),
    ).not.toThrow();
    expect(renderToStaticMarkup(<>{renderCanonicalSectionBody(section, fallback)}</>)).toBe(
      "<p>安全な旧表示</p>",
    );
  });

  it("商品情報の取得方法が未確定でも、本文中の位置を黙って消さない", () => {
    const source = serializeProse([{ kind: "product-card", productId: "product-1" }]);
    const section = richArticle(source).sections[0]!;

    const html = renderToStaticMarkup(
      <>{renderCanonicalSectionBody(section, <p>{section.paragraphs[0]}</p>)}</>,
    );

    expect(html).toContain("この位置の商品情報は現在表示できません");
  });
});
