/**
 * @tier 2
 * @req REQ-SEO03, REQ-TM06
 * @types equivalence, boundary
 *
 * 記事の「よくある質問」。
 *
 * 読者に見えている問いと答えが、そのまま AI 検索の引用元になる。
 * ここが節（見出しと段落）に崩れると、どこが答えなのかを読み取る側が
 * 言い当てられなくなり、`FAQPage` も作れない。だから型ではなく出力を見る。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArticleView, type ArticleViewModel } from "@/presentation/ui/templates/article-view";
import { TELEMETRY_ATTR, TELEMETRY_SECTION_KINDS } from "@/presentation/ui/telemetry-attrs";

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
    sections: [{ id: "how_to_choose", heading: "選び方", paragraphs: ["運転音を先に見る。"] }],
    ...over,
  };
}

const FAQ = [
  { question: "電気代はどのくらい?", answer: "1 日 8 時間で月 200 円ほどです。" },
  { question: "手入れは何日おき?", answer: "水タンクは毎日、フィルターは 2 週間おきです。" },
];

describe("記事のよくある質問", () => {
  it("問いと答えが対で出る", () => {
    const html = renderToStaticMarkup(<ArticleView article={article({ faq: FAQ })} />);
    expect(html).toContain("電気代はどのくらい?");
    expect(html).toContain("1 日 8 時間で月 200 円ほどです。");
    expect(html).toContain("手入れは何日おき?");
  });

  /**
   * `dl`/`dt`/`dd` で組む。見出しと段落（`h3` + `p`）で組むと
   * 見た目は同じでも「どれが問いか」が機械から消える。
   */
  it("問いと答えの関係が印として残る（dt と dd）", () => {
    const html = renderToStaticMarkup(<ArticleView article={article({ faq: FAQ })} />);
    expect(html).toContain("<dl");
    expect(html).toMatch(/<dt[^>]*>電気代はどのくらい\?<\/dt>/);
    expect(html).toMatch(/<dd[^>]*>1 日 8 時間で月 200 円ほどです。<\/dd>/);
  });

  it("畳まない（開かないと読めない形にしない）", () => {
    // 畳むと、開かれていない答えは検索にも AI にも読まれにくい。
    // ここへ書く理由がそのまま消えるので、`details` は使わない。
    const html = renderToStaticMarkup(<ArticleView article={article({ faq: FAQ })} />);
    expect(html).not.toContain("<details");
  });

  it("節と同じ形で種類を名乗る（滞在時間を測れる）", () => {
    const html = renderToStaticMarkup(<ArticleView article={article({ faq: FAQ })} />);
    const kinds = [...html.matchAll(new RegExp(`${TELEMETRY_ATTR.sectionKind}="([^"]*)"`, "g"))].map(
      (m) => m[1],
    );
    expect(kinds).toContain("faq");
    for (const kind of kinds) {
      expect(TELEMETRY_SECTION_KINDS).toContain(kind);
    }
  });

  it.each([
    ["欄そのものが無いとき", undefined],
    ["空で来たとき（読み取りモデルが崩れた事故）", [] as const],
  ])("よくある質問が無い記事に、見出しだけの空欄を出さない: %s", (_name, faq) => {
    const html = renderToStaticMarkup(<ArticleView article={article({ faq })} />);
    expect(html).not.toContain("よくある質問");
    expect(html).not.toContain('id="faq"');
  });
});
