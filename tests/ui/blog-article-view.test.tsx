/**
 * @tier 2
 * @req REQ-BLOG03
 * 受入条件 A5（`docs/spec/feat-blog-ops-crud/requirements-baseline.md`）に対応する。
 * `@req` は要件表の ID しか拾わないので、受入 ID はここに文章で残す。
 * @types equivalence
 *
 * **当てるのは「表が正しいこと」ではなく「画面が表どおりに描くこと」。**
 * `PRODUCT_CARD_PLACEMENTS` の中身をここへ書き写すと、表を直した日に
 * 画面の検査が古い表を守り続ける。期待値には表そのものを使う。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ArticleTemplate, BlogArticleBlock } from "@/domain/blogops";
import { PRODUCT_CARD_PLACEMENTS } from "@/domain/blogops";
import { toExpressionArticleBlock } from "@/application/adapters/expression-article-block";
import { BlogArticleView } from "@/presentation/site/blog-article-view";

/**
 * 受入条文 A5 —「部品列の順序・product-card の 3 箇所再掲・階層目次」を、
 * **画面の出力そのもの**で見る。
 *
 * ここを足した理由。再掲の場所 (`PRODUCT_CARD_PLACEMENTS`) と目次の段
 * (`ARTICLE_BLOCK_TOC_LEVEL`) は `tests/domain/article-outline.test.ts` が見ているが、
 * **表が正しいことと、画面がその表どおりに描くことは別**である。
 * 画面側で `placements` を参照するのをやめても、domain の検査は緑のまま通る。
 *
 * 数え方は**可視の文字列の出現回数**にする。DOM の入れ子や class 名を当てると、
 * 見た目を直しただけで赤くなり、そのうち誰も直さなくなる（保守性制約）。
 */

const CARD_HEADING = "見本堂スタンド A1";

function block(
  over: Partial<BlogArticleBlock> & Pick<BlogArticleBlock, "kind" | "position">,
): BlogArticleBlock {
  return {
    id: `blk_${over.kind}_${over.position}`,
    heading: "",
    body: "",
    ...over,
  };
}

/** T1 の一本。順序は `TEMPLATE_BLOCK_ORDER.T1` どおりに並べてある。 */
function t1Blocks(): readonly BlogArticleBlock[] {
  return [
    block({ kind: "disclosure-notice", position: 0 }),
    block({ kind: "intro-box", position: 1, heading: "はじめに", body: "机の上を静かにする話。" }),
    block({ kind: "hierarchical-toc", position: 2, heading: "目次" }),
    block({ kind: "spec-section", position: 3, heading: "必要な条件", body: "高さが変えられること。" }),
    block({ kind: "criterion-section", position: 4, heading: "高さ", body: "目の高さに来るか。" }),
    block({ kind: "criterion-section", position: 5, heading: "ぐらつき", body: "肘を置いても揺れないか。" }),
    block({ kind: "pick-section", position: 6, heading: "選んだもの", body: "これを使っている。" }),
    block({ kind: "product-card", position: 7, heading: CARD_HEADING, body: "架空の作り手の見本。" }),
    block({ kind: "summary-section", position: 8, heading: "まとめ", body: "高さが変わるものを選ぶ。" }),
  ];
}

function render(template: ArticleTemplate, blocks: readonly BlogArticleBlock[]): string {
  return renderToStaticMarkup(
    <BlogArticleView
      template={template}
      lead="机の上を静かにする道具の話。"
      authorName="編集部"
      updatedAt={new Date("2026-08-01T00:00:00Z")}
      now={new Date("2026-08-10T00:00:00Z")}
      blocks={blocks}
    />,
  );
}

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("商品カードの再掲 (A5)", () => {
  it("T1 では、運営者が入れた 1 枚が 3 箇所に再掲される", () => {
    const html = render("T1", t1Blocks());

    // 表が 3 箇所と言っているなら、画面も 3 回でなければならない。
    // 数字を直に書かないのは、表を変えた日に**画面と検査が同時に**動くようにするため。
    expect(PRODUCT_CARD_PLACEMENTS.T1).toHaveLength(3);
    expect(countOf(html, CARD_HEADING)).toBe(PRODUCT_CARD_PLACEMENTS.T1.length);
  });

  it("同じ種類の節が 2 つあっても、再掲は 1 回で止まる", () => {
    // 判断軸は n 回出る。もし再掲が「その種類が出るたび」なら、
    // 判断軸を 1 つ足しただけでカードが 1 枚増える。
    const withExtraCriterion = [
      ...t1Blocks(),
      block({ kind: "criterion-section", position: 9, heading: "重さ", body: "持ち運ぶか。" }),
    ];
    expect(countOf(render("T1", withExtraCriterion), CARD_HEADING)).toBe(3);
  });

  it("T4 (ハブ) には商品が 1 度も出ない", () => {
    // 表が空配列なので、カードを入れても画面には出ない。
    // 「入れたのに出ない」が正しい形である（ハブは商品を売る場所ではない）。
    expect(PRODUCT_CARD_PLACEMENTS.T4).toHaveLength(0);
    const html = render("T4", [
      block({ kind: "intro-box", position: 0, heading: "この場所について", body: "入口です。" }),
      block({ kind: "product-card", position: 1, heading: CARD_HEADING, body: "見本。" }),
    ]);
    expect(countOf(html, CARD_HEADING)).toBe(0);
  });
});

describe("階層のある目次 (A5)", () => {
  it("判断軸は条件の節の下にぶら下がり、番号が 2-1 の形になる", () => {
    const html = render("T1", t1Blocks());

    // 2 段目は「必要な条件」「選んだもの」「まとめ」の 3 つ、3 段目は判断軸 2 つ。
    expect(html).toContain("1. 必要な条件");
    expect(html).toContain("1-1. 高さ");
    expect(html).toContain("1-2. ぐらつき");
    expect(html).toContain("2. 選んだもの");
    expect(html).toContain("3. まとめ");
  });

  it("目次に載せない部品と、見出しの空な部品は 1 行も作らない", () => {
    const html = render("T1", t1Blocks());
    // 目次の行数は 2 段目 3 + 3 段目 2 = 5。広告表記・導入・目次そのものは載らない。
    const tocStart = html.indexOf('aria-label="目次"');
    const toc = html.slice(tocStart, html.indexOf("</nav>", tocStart));
    expect(countOf(toc, "<li>")).toBe(5);
    expect(toc).not.toContain("はじめに");
  });

  it("見出しが 1 つも無ければ、空の目次ではなくその旨を書く", () => {
    const html = render("T4", [
      block({ kind: "hierarchical-toc", position: 0, heading: "目次" }),
      block({ kind: "intro-box", position: 1, heading: "", body: "本文だけ。" }),
    ]);
    expect(html).toContain("この記事にはまだ見出しがありません。");
  });
});

describe("表現ブロックの公開 composition (A5/A12)", () => {
  it("壊れたcarrierは本文へfallbackせず、読者から見えない", () => {
    const html = render("T4", [
      block({ kind: "intro-box", position: 0, heading: "通常本文", body: "これは残ります。" }),
      block({
        kind: "summary-section",
        position: 1,
        heading: "壊れた運搬データ",
        body: "expression-block:v1:not-json",
      }),
    ]);

    expect(html).toContain("これは残ります。");
    expect(html).not.toContain("壊れた運搬データ");
    expect(html).not.toContain("expression-block:v1:not-json");
  });

  it("編集画面から入る10種すべてを公開表示へ反映し、carrier文字列は漏らさない", () => {
    const expressions = [
      { kind: "answer", text: "先に答えます。" },
      { kind: "key_points", items: ["速い", "軽い"] },
      { kind: "faq", items: [{ question: "保証は？", answer: "1年です。" }] },
      { kind: "sources", items: [{ label: "公式仕様", checkedAt: "2026-08-31", url: "https://example.com/spec" }] },
      { kind: "freshness", asOf: "2026-08-31", note: "確認済み" },
      { kind: "figure", caption: "内部構造", alt: "製品内部の図" },
      { kind: "comparison", caption: "用途別に比較" },
      { kind: "cta", label: "公式サイトを見る", href: "/go/offer-1" },
      { kind: "summary", text: "軽さを優先します。" },
      { kind: "spec_table", rows: [{ label: "重さ", value: "900g" }] },
    ] as const;
    const html = render(
      "T4",
      expressions.map((expression, index) =>
        toExpressionArticleBlock(expression, `expression_${index}`, index),
      ),
    );

    for (const visible of [
      "先に答えます。",
      "速い",
      "保証は？",
      "1年です。",
      "公式仕様",
      "2026-08-31",
      "確認済み",
      "内部構造",
      "製品内部の図",
      "用途別に比較",
      "公式サイトを見る",
      "軽さを優先します。",
      "900g",
    ]) {
      expect(html).toContain(visible);
    }
    expect(html).toContain('href="https://example.com/spec"');
    expect(html).toContain('href="/go/offer-1"');
    expect(html).not.toContain("expression-block:v1");
  });

  it("永続 carrier を内部文字列のまま漏らさず、CTA と FAQ として描く", () => {
    const html = render("T4", [
      block({ kind: "intro-box", position: 0, heading: "導入", body: "本文" }),
      toExpressionArticleBlock(
        { kind: "cta", label: "公式サイトを見る", href: "/go/offer-1" },
        "expression_cta",
        1,
      ),
      toExpressionArticleBlock(
        { kind: "faq", items: [{ question: "保証は？", answer: "1 年です。" }] },
        "expression_faq",
        2,
      ),
    ]);

    expect(html).toContain('href="/go/offer-1"');
    expect(html).toContain("公式サイトを見る");
    expect(html).toContain("保証は？");
    expect(html).toContain("1 年です。");
    expect(html).not.toContain("expression-block:v1");
  });

  it("商品カードを再掲する型でも CTA carrier を商品カードとして二重表示しない", () => {
    const html = render("T1", [
      ...t1Blocks(),
      toExpressionArticleBlock(
        { kind: "cta", label: "公式サイトを見る", href: "/go/offer-1" },
        "expression_cta",
        9,
      ),
    ]);

    expect(countOf(html, "公式サイトを見る")).toBe(1);
    expect(html).not.toContain("expression-block:v1");
  });
});
