/** @tier 2 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArticleView, type ArticleViewModel } from "@/presentation/ui/templates/article-view";

/**
 * 記事の器が必ず出すもの（目次・更新履歴）。
 *
 * 公開ゲートはこの 2 つを「器が出す」と数えて通す
 * （`src/domain/authoring/article-structure.ts` の TEMPLATE_PROVIDED_SECTIONS）。
 * 実際に出ていなければ、出していない項目を出したことにして公開できてしまう。
 * だから型ではなく出力を見る。
 */

function article(over: Partial<ArticleViewModel> = {}): ArticleViewModel {
  return {
    title: "静かな加湿器の選び方",
    summary: "寝室で使うなら運転音 30dB 以下を選ぶ。",
    publishedAt: "2026-08-01",
    updatedAt: "2026-08-15",
    authorName: "山田",
    authorHref: "/s/demo/authors/yamada",
    disclosureRequired: true,
    methodologyHref: "/s/demo/methodology",
    policyHref: "/s/demo/policy",
    sections: [
      { id: "how_to_choose", heading: "選び方", paragraphs: ["運転音を先に見る。"] },
      { id: "pros", heading: "良い点", paragraphs: ["静か。"] },
      { id: "cons", heading: "気になる点", paragraphs: ["水の補充が要る。"] },
    ],
    ...over,
  };
}

describe("記事の目次", () => {
  it("節の見出しが目次に並ぶ", () => {
    const html = renderToStaticMarkup(<ArticleView article={article()} />);
    expect(html).toContain("目次");
    expect(html).toContain('href="#how_to_choose"');
    expect(html).toContain('href="#cons"');
  });

  it("節に id が付いていて、目次から飛べる", () => {
    const html = renderToStaticMarkup(<ArticleView article={article()} />);
    expect(html).toContain('id="how_to_choose"');
  });

  it("節が 2 つ以下のときは目次を出さない（かえって読みにくい）", () => {
    const html = renderToStaticMarkup(
      <ArticleView
        article={article({
          sections: [{ id: "body", heading: "本文", paragraphs: ["ひとつだけ。"] }],
        })}
      />,
    );
    expect(html).not.toContain("目次");
  });
});

describe("記事の更新履歴", () => {
  it("公開した日が履歴に出る", () => {
    const html = renderToStaticMarkup(<ArticleView article={article()} />);
    expect(html).toContain("更新履歴");
    expect(html).toContain("2026-08-01");
  });

  it("公開したあと直していれば、直した日も出る", () => {
    const html = renderToStaticMarkup(<ArticleView article={article()} />);
    expect(html).toContain("2026-08-15");
  });

  it("公開したきりのときは「まだ直していない」ことが分かる", () => {
    const html = renderToStaticMarkup(
      <ArticleView article={article({ publishedAt: "2026-08-01", updatedAt: "2026-08-01" })} />,
    );
    expect(html).toContain("公開してから直した箇所はありません");
  });
});
