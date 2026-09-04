/**
 * @tier 2
 * @req REQ-SEO06
 * @types equivalence
 */
import { describe, expect, it } from "vitest";
import {
  ARTICLE_SPEAKABLE_SELECTORS,
  ArticleView,
  type ArticleViewModel,
} from "@/presentation/ui/templates/article-view";
import { renderDom } from "../support/render";

/**
 * 読み上げの宛先（`data-speakable`）が、狙った場所に**ひとつだけ**付いているか。
 *
 * `buildSpeakable` が JSON-LD へ出す `cssSelector` は
 * `src/application/seo/structured-data.ts` にあり、実際に属性を付けるのは
 * `src/presentation/ui/templates/article-view.tsx` にある。**別のファイルにある一対**で、
 * 片方だけ消しても型検査は何も言わない。ここが両者を突き合わせる唯一の場所になる。
 *
 * --- なぜ文字列ではなく DOM で見るのか ---
 * `renderMarkup` の返す HTML 文字列に対する `toContain('data-speakable="answer"')` は、
 * 属性が**どこかに**あることしか言わない。design-review の F3 が指摘した取り違え
 * （`MOVABLE_BLOCKS` の `"summary"` は結論ではなく目次を指す）が起きても、
 * 目次に属性が付いた状態で同じように通ってしまう。
 * だから件数と、当たった要素の**文字**まで見る。
 */

function article(over: Partial<ArticleViewModel> = {}): ArticleViewModel {
  return {
    title: "静かな加湿器の選び方",
    summary: "寝室で使うなら運転音 30dB 以下を選ぶ。",
    keyPoints: ["運転音は 30dB 以下", "水タンクは 3L 以上"],
    publishedAt: "2026-08-01",
    updatedAt: "2026-08-15",
    authorName: "山田",
    authorHref: "/s/demo/authors/yamada",
    authorBio: "生活家電を実際に使い、静音性を比べている書き手です。",
    authorCredentials: ["家電販売の実務 5 年"],
    disclosureRequired: true,
    methodologyHref: "/s/demo/methodology",
    policyHref: "/s/demo/policy",
    sections: [
      { id: "how_to_choose", heading: "選び方", paragraphs: ["運転音を先に見る。"] },
      { id: "pros", heading: "良い点", paragraphs: ["静か。"] },
    ],
    ...over,
  };
}

describe("読み上げの宛先", () => {
  it("結論の宛先はひとつで、その中身は記事の結論そのものである", async () => {
    const view = article();
    const { document, cleanup } = await renderDom(<ArticleView article={view} />);
    try {
      const hits = document.querySelectorAll(ARTICLE_SPEAKABLE_SELECTORS.answer);
      // 2 つ以上あると、読み上げ機構がどちらを読むかは記事ごとに変わる。
      expect(hits).toHaveLength(1);
      // ここが目次に付いていれば、文字は見出しの一覧になる。
      expect(hits[0]?.textContent?.trim()).toBe(view.summary);
    } finally {
      cleanup();
    }
  });

  it("要点の宛先はひとつで、その中身は要点の並びである", async () => {
    const view = article();
    const { document, cleanup } = await renderDom(<ArticleView article={view} />);
    try {
      const hits = document.querySelectorAll(ARTICLE_SPEAKABLE_SELECTORS.keyPoints);
      expect(hits).toHaveLength(1);
      const items = [...(hits[0]?.querySelectorAll("li") ?? [])].map((li) =>
        li.textContent?.trim(),
      );
      expect(items).toEqual([...(view.keyPoints ?? [])]);
    } finally {
      cleanup();
    }
  });

  it("要点の無い記事では、要点の宛先そのものが出ない", async () => {
    // 空の宛先を残すと、JSON-LD は「ここを読め」と言い続けるのに読む文字が無い。
    const { document, cleanup } = await renderDom(
      <ArticleView article={article({ keyPoints: undefined })} />,
    );
    try {
      expect(document.querySelectorAll(ARTICLE_SPEAKABLE_SELECTORS.keyPoints)).toHaveLength(0);
      expect(document.querySelectorAll(ARTICLE_SPEAKABLE_SELECTORS.answer)).toHaveLength(1);
    } finally {
      cleanup();
    }
  });
});
