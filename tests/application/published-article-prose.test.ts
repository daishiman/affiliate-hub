/**
 * @tier 1
 * @req REQ-BOPS04, REQ-BOPS05
 * @types contract, regression
 *
 * BlogOps の公開 projection だけが、本文を Prose として解釈してよいことを名乗る。
 * 既存の PublishedArticle JSON にはこの印が無いので、文字通りの段落として残す。
 */
import { describe, expect, it } from "vitest";
import {
  type PublishedSection,
  projectBlogArticle,
} from "@/application/read-models/published-article";
import { toExpressionArticleBlock } from "@/application/adapters/expression-article-block";
import { serializeProse } from "@/domain/blogops";
import { toArticleView } from "@/presentation/site/view-model";

type ProjectionBlock = {
  readonly id: string;
  readonly kind: string;
  readonly heading: string;
  readonly body: string;
};

function projectedArticleFrom(blocks: readonly ProjectionBlock[]) {
  return projectBlogArticle({
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
    blocks,
  });
}

function projectedArticle(body: string) {
  return projectedArticleFrom([
    { id: "body", kind: "intro-box", heading: "選び方", body },
  ]);
}

describe("公開本文の形式を明示する projection", () => {
  it("商品用の章へ挿入した本文商品カードも、配置と参照を公開本文へ保持する", () => {
    const source = serializeProse([{ kind: "product-card", productId: "owned-product" }]);
    const article = projectedArticleFrom([
      { id: "product-section", kind: "product-card", heading: "おすすめの道具", body: source },
    ]);
    expect(article.sections[0]).toMatchObject({
      id: "product-section", heading: "おすすめの道具", formattedBody: { source },
    });
  });
  it("BlogOps の形式付き本文を、版と原文を失わず保持する", () => {
    const source = serializeProse([
      { kind: "heading", level: 3, text: "打鍵音を見る" },
      { kind: "bullet-list", items: ["静音軸", "吸音材"] },
    ]);

    expect(projectedArticle(source).sections[0]?.formattedBody).toEqual({
      format: "prose-v1",
      version: 1,
      source,
    });
  });

  it("旧形式の節は形式を推測せず、段落だけのまま扱える", () => {
    const legacy: PublishedSection = {
      id: "legacy",
      heading: "以前の記事",
      paragraphs: ["### これは見出し記法ではなく、保存された本文です。"],
    };

    expect("formattedBody" in legacy).toBe(false);
  });

  it("画面用の形にも、解釈せず opaque な形式情報を運ぶ", () => {
    const source = serializeProse([{ kind: "quote", text: "静かな場所で試しました。" }]);

    expect(toArticleView("desk", projectedArticle(source)).sections[0]?.formattedBody).toEqual({
      format: "prose-v1",
      version: 1,
      source,
    });
  });

  it.each([
    { name: "null", formattedBody: null },
    { name: "配列", formattedBody: [] },
    { name: "primitive", formattedBody: 1 },
    { name: "source欠落", formattedBody: { format: "prose-v1", version: 1 } },
  ])("永続化JSONの壊れたformattedBody（$name）は画面に運ばない", ({ formattedBody }) => {
    const article = projectedArticle("本文です。");
    const persisted = JSON.parse(
      JSON.stringify({
        ...article,
        sections: article.sections.map((section) => ({ ...section, formattedBody })),
      }),
    ) as ReturnType<typeof projectedArticle>;

    expect(toArticleView("desk", persisted).sections[0]?.formattedBody).toBeUndefined();
  });

  it("結論・要点・FAQのcarrierを、本文ではなく公開モデルの正本へ写す", () => {
    const article = projectedArticleFrom([
      toExpressionArticleBlock(
        { kind: "answer", text: "  静音性を優先するなら赤軸です。  " },
        "answer",
        0,
      ),
      toExpressionArticleBlock(
        { kind: "key_points", items: ["  打鍵音  ", "", "夜間の使いやすさ"] },
        "key-points",
        1,
      ),
      toExpressionArticleBlock(
        {
          kind: "faq",
          items: [
            { question: "  保証はありますか？ ", answer: "  1年間です。 " },
            { question: " ", answer: "公開しない不完全な回答" },
          ],
        },
        "faq",
        2,
      ),
    ]);

    expect(article.summary).toBe("静音性を優先するなら赤軸です。");
    expect(article.keyPoints).toEqual(["打鍵音", "夜間の使いやすさ"]);
    expect(article.faq).toEqual([
      { question: "保証はありますか？", answer: "1年間です。" },
    ]);
    expect(article.sections).toEqual([]);
    expect(JSON.stringify(article)).not.toContain("expression-block:v1:");
  });

  it("まとめcarrierは読者本文へ写し、通常ブロックは従来どおり保持する", () => {
    const article = projectedArticleFrom([
      { id: "intro", kind: "intro-box", heading: "選び方", body: "通常本文です。" },
      toExpressionArticleBlock(
        { kind: "summary", text: "軽さと静かさの両方を比べます。" },
        "summary",
        1,
      ),
    ]);

    expect(article.sections).toEqual([
      {
        id: "intro",
        heading: "選び方",
        paragraphs: ["通常本文です。"],
        formattedBody: { format: "prose-v1", version: 1, source: "通常本文です。" },
      },
      {
        id: "summary",
        heading: "まとめ",
        paragraphs: ["軽さと静かさの両方を比べます。"],
        formattedBody: {
          format: "prose-v1",
          version: 1,
          source: "軽さと静かさの両方を比べます。",
        },
      },
    ]);
  });

  it("構造化した出典・鮮度・CTA・仕様を本文へ写し、壊れたcarrierと未解決の旧商品は露出しない", () => {
    const article = projectedArticleFrom([
      {
        id: "malformed",
        kind: "summary-section",
        heading: "壊れたまとめ",
        body: "expression-block:v1:not-json",
      },
      toExpressionArticleBlock(
        {
          kind: "sources",
          items: [{ label: "公式仕様", checkedAt: "2026-09-02" }],
        },
        "sources",
        1,
      ),
      toExpressionArticleBlock(
        { kind: "freshness", asOf: "2026-09-02" },
        "freshness",
        2,
      ),
      toExpressionArticleBlock(
        { kind: "figure", caption: "比較図", alt: "2製品の比較" },
        "figure",
        3,
      ),
      toExpressionArticleBlock(
        { kind: "comparison", caption: "用途別の比較" },
        "comparison",
        4,
      ),
      toExpressionArticleBlock(
        { kind: "cta", label: "詳しく見る", href: "/go/offer" },
        "cta",
        5,
      ),
      toExpressionArticleBlock(
        { kind: "spec_table", rows: [{ label: "重さ", value: "900g" }] },
        "spec-table",
        6,
      ),
      { id: "toc", kind: "hierarchical-toc", heading: "目次", body: "" },
      { id: "card", kind: "product-card", heading: "商品A", body: "未解決の商品情報" },
    ]);

    expect(article.sections.map((section) => section.id)).toEqual([
      "sources", "freshness", "figure", "comparison", "cta", "spec-table",
    ]);
    expect(article.sections.find((section) => section.id === "cta")?.formattedBody?.source).toContain("/go/offer");
    expect(article.sections.find((section) => section.id === "spec-table")?.formattedBody?.source).toContain("900g");
    expect(JSON.stringify(article)).not.toContain("expression-block:v1:");
    expect(JSON.stringify(article)).not.toContain("未解決の商品情報");
  });

  it("広告表記は記事フラグへ集約し、本文の節として重複させない", () => {
    const article = projectedArticleFrom([
      {
        id: "disclosure",
        kind: "disclosure-notice",
        heading: "広告表記",
        body: "この記事には広告が含まれます。",
      },
    ]);

    expect(article.disclosureRequired).toBe(true);
    expect(article.sections).toEqual([]);
  });
});
