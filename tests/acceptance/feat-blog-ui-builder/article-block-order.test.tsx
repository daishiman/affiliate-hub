/**
 * @tier 2
 * @req REQ-BLOG01, REQ-BLOG03, A1, A5
 * @types equivalence, regression
 *
 * 受入 **A1**（見せ方を差し替えても既存記事が壊れない）と
 * **A5**（記事の中の塊がその並びで出る）の、**画面側**の確認。
 *
 * `template-and-theme.test.ts` はドメインの `orderBlocksForTemplate` が
 * 並べ替えても集合を保つことを見ている。こちらが見るのは
 * **記事画面がその並びへ実際につながっているか**である。
 * 並べ替えの規則が正しくても、画面が固定の順で描いていれば
 * 見せ方を選んでも読者には何も起こらない（2026-08-30 まではそうだった）。
 *
 * 当てるのは**可視の文字列の出現位置**にする。class 名や入れ子を当てると、
 * 見た目を直しただけで赤くなる。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BLOG_TEMPLATES, findBlogTemplate } from "@/domain/authoring/blog-template";
import { ArticleView, type ArticleViewModel } from "@/presentation/ui";

const SECTION_HEADING = "選び方の三つの軸";
const COMPARISON_CAPTION = "候補 3 機種の比較";
const CTA_HEADING = "この記事で取り上げた商品";
const FAQ_QUESTION = "電池はどのくらい持ちますか";
const KEY_POINT = "静かさを最優先に選ぶ";

/**
 * 6 種の塊がすべて中身を持つ記事。落ちた塊は出現位置 -1 で表に出る。
 *
 * **`as ArticleViewModel` で押し込まない。**押し込むと、画面が受け取る形が
 * 変わった日にこの検査だけが古い形のまま緑になり、
 * 「並びは正しいが中身が描けない」を見逃す。
 */
function anArticle(blockOrder?: readonly string[]): ArticleViewModel {
  return {
    title: "静かなキーボードの選び方",
    summary: "打鍵音を気にする人には B が良い。",
    publishedAt: "2026-08-01",
    updatedAt: "2026-08-20",
    authorName: "見本 太郎",
    authorHref: "/s/demo/authors/taro",
    disclosureRequired: false,
    methodologyHref: "/s/demo/methodology",
    policyHref: "/s/demo/advertising-policy",
    sections: [{ id: "how-to-choose", heading: SECTION_HEADING, paragraphs: ["本文。"] }],
    keyPoints: [KEY_POINT],
    faq: [{ question: FAQ_QUESTION, answer: "約 10 時間です。" }],
    productCards: [
      {
        productId: "p_b",
        name: "見本キーボード B",
        brand: "見本堂",
        oneLine: "静かな打鍵音。",
        specs: [],
        affiliateHref: "/out/b",
      },
    ],
    comparison: {
      caption: COMPARISON_CAPTION,
      columns: [{ key: "noise", label: "静かさ" }],
      rows: [{ id: "b", label: "見本キーボード B", cells: { noise: { value: "静か" } } }],
    },
    blockOrder,
  };
}

function positions(blockOrder?: readonly string[]): Record<string, number> {
  const html = renderToStaticMarkup(<ArticleView article={anArticle(blockOrder)} />);
  return {
    key_points: html.indexOf(KEY_POINT),
    summary: html.indexOf(SECTION_HEADING),
    comparison: html.indexOf(COMPARISON_CAPTION),
    cta: html.indexOf(CTA_HEADING),
    faq: html.indexOf(FAQ_QUESTION),
  };
}

describe("A5 記事の中の塊は、選んだ見せ方の並びで出る", () => {
  it("見せ方を選ばなければ、これまでの並びで出る", () => {
    const at = positions();

    expect(at.key_points).toBeLessThan(at.summary);
    expect(at.summary).toBeLessThan(at.comparison);
    expect(at.comparison).toBeLessThan(at.cta);
    expect(at.cta).toBeLessThan(at.faq);
  });

  /**
   * 「ガジェット寄り」は比較と買う導線を本文より前に置く並びを持つ。
   * **並びの中身をここへ書き写さない。** 写すと、定義を直した日に
   * 検査だけが古い並びを守り続ける。期待値には定義そのものを使う。
   */
  it("見せ方を選ぶと並びが変わる（比較と買う導線が本文より前へ）", () => {
    const gadget = findBlogTemplate("gadget");
    if (gadget === null) throw new Error("見せ方『ガジェット寄り』の定義がありません。");
    const order = gadget.articleBlockOrder;
    const at = positions(order);

    expect(order.indexOf("comparison")).toBeLessThan(order.indexOf("summary"));
    expect(at.comparison).toBeLessThan(at.summary);
    expect(at.cta).toBeLessThan(at.summary);
  });

  /**
   * **A1 の本体。** 並べ替えても塊は 1 つも落ちない。
   * 落ちる形にすると、見せ方を差し替えた日に、書いてある文章が読者から消える。
   */
  it("どの見せ方でも、中身のある塊はすべて出る", () => {
    for (const template of BLOG_TEMPLATES) {
      const at = positions(template.articleBlockOrder);
      for (const [kind, index] of Object.entries(at)) {
        expect(index, `${template.label} で ${kind} が消えました`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("知らない名前が並びに混ざっても、塊は落ちず末尾へ回るだけ", () => {
    const at = positions(["そんな塊はない", "faq", "key_points"]);

    // 並びに現れた 2 つが先。残りは元の順のまま後ろへ付く。
    expect(at.faq).toBeLessThan(at.key_points);
    expect(at.key_points).toBeLessThan(at.summary);
    expect(at.comparison).toBeGreaterThanOrEqual(0);
    expect(at.cta).toBeGreaterThanOrEqual(0);
  });
});
