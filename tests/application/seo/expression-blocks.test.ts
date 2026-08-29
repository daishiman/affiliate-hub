/**
 * @tier 1
 * @req REQ-SEO03
 * @types equivalence, boundary, contract
 *
 * 表現ブロックの射影。
 *
 * ここで固定したいのは「画面・構造化データ・公開前監査が**同じ 1 本の射影**を
 * 読む」こと。3 か所が別々に読み取りモデルを辿り直すと、出典の重複のまとめ方や
 * 期限切れの扱いが少しずつずれ、読者に見える出典と検索エンジンへ渡す出典と
 * 合格印の根拠が食い違う。
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PublishedArticle } from "@/application/read-models/published-article";
import { auditArticleForAiSearch } from "@/application/seo/ai-search-audit";
import { expressionBlocksOf } from "@/application/seo/expression-blocks";
import { buildBlogPosting, buildFaqPage } from "@/application/seo/structured-data";
import { EXPRESSION_BLOCK_KINDS } from "@/domain/authoring/blog-template";
import { toArticleView } from "@/presentation/site/view-model";
import { ArticleView } from "@/presentation/ui/templates/article-view";

const article: PublishedArticle = {
  slug: "laptops",
  siteSlug: "gadget",
  type: "guide",
  title: "動画編集向けノートの選び方",
  summary:
    "動画編集向けノートは書き出し速度・画面の色・持ち運びの 3 点で選ぶ。実測 5 機種の結果から、用途別の結論を先に示す。",
  categorySlug: "laptop",
  publishedAt: "2026-08-01",
  updatedAt: "2026-08-20",
  author: { slug: "writer", name: "編集部", bio: "実測レビュー歴 5 年。", credentials: [] },
  disclosureRequired: true,
  keyPoints: ["書き出し速度で選ぶなら A", "色の正確さなら B"],
  sections: [
    {
      id: "s1",
      heading: "結論",
      paragraphs: ["まず 10 万円台ならこの 1 台。"],
      claims: [
        {
          id: "c1",
          statement: "書き出しが最速だった",
          kind: "fact",
          evidence: [
            { id: "e1", sourceLabel: "実測ログ", checkedAt: "2026-08-10" },
            { id: "e2", sourceLabel: "メーカー仕様", url: "https://example.com/spec", checkedAt: "2026-08-01" },
          ],
        },
      ],
    },
    {
      id: "s2",
      heading: "根拠",
      paragraphs: ["測り方はこちら。"],
      claims: [
        {
          id: "c2",
          statement: "色域が広い",
          kind: "fact",
          // 1 件目と同じ出典を、別の主張からもう一度引いている。
          evidence: [
            { id: "e3", sourceLabel: "メーカー仕様", url: "https://example.com/spec", checkedAt: "2026-08-18" },
          ],
        },
      ],
    },
  ],
  faq: [{ question: "予算はいくら見ればよい?", answer: "10 万円台から選べます。" }],
};

function kindsOf(a: PublishedArticle): readonly string[] {
  return expressionBlocksOf(a).map((b) => b.kind);
}

describe("表現ブロックの射影", () => {
  it("AI 検索が読む 5 種を、読み取りモデルの正本から取り出す", () => {
    expect(kindsOf(article)).toEqual(["answer", "key_points", "faq", "sources", "freshness"]);
  });

  it("取り出す種類は EXPRESSION_BLOCK_KINDS の語彙から外れない", () => {
    for (const kind of kindsOf(article)) {
      expect(EXPRESSION_BLOCK_KINDS).toContain(kind);
    }
  });

  it("中身の無い種類は返さない（空のブロックに合格印を付けさせない）", () => {
    const bare: PublishedArticle = {
      ...article,
      summary: "  ",
      keyPoints: [],
      faq: [],
      sections: [{ id: "s1", heading: "結論", paragraphs: ["本文。"] }],
    };
    expect(kindsOf(bare)).toEqual(["freshness"]);
  });

  it("FAQ は問いと答えを trim し、どちらかが空の対を落とす", () => {
    const faq = expressionBlocksOf({
      ...article,
      faq: [
        { question: "  何を見て選ぶ?  ", answer: "  書き出し速度です。  " },
        { question: "   ", answer: "答えだけ" },
        { question: "問いだけ", answer: "\n\t" },
      ],
    }).find((block) => block.kind === "faq");

    expect(faq).toEqual({
      kind: "faq",
      items: [{ question: "何を見て選ぶ?", answer: "書き出し速度です。" }],
    });
  });

  describe("出典のまとめ方", () => {
    const sources = expressionBlocksOf(article).find((b) => b.kind === "sources");

    it("同じ出典は 1 件にまとめ、確認日は新しい方を残す", () => {
      expect(sources?.kind).toBe("sources");
      if (sources?.kind !== "sources") return;
      expect(sources.items).toEqual([
        { label: "実測ログ", checkedAt: "2026-08-10" },
        { label: "メーカー仕様", url: "https://example.com/spec", checkedAt: "2026-08-18" },
      ]);
    });

    it("並びは記事の出現順（節の順 → 主張の順）", () => {
      if (sources?.kind !== "sources") throw new Error("sources が無い");
      expect(sources.items.map((i) => i.label)).toEqual(["実測ログ", "メーカー仕様"]);
    });

    it("期限切れの出典も落とさない（黙って消さない）", () => {
      const expired: PublishedArticle = {
        ...article,
        sections: [
          {
            id: "s1",
            heading: "結論",
            paragraphs: ["本文。"],
            claims: [
              {
                id: "c1",
                statement: "最速",
                kind: "fact",
                evidence: [
                  { id: "e1", sourceLabel: "古い実測", checkedAt: "2024-01-01", expired: true },
                ],
              },
            ],
          },
        ],
      };
      const block = expressionBlocksOf(expired).find((b) => b.kind === "sources");
      if (block?.kind !== "sources") throw new Error("sources が無い");
      expect(block.items).toEqual([{ label: "古い実測", checkedAt: "2024-01-01" }]);
    });

    it("名前も URL も無い証跡は出典に数えない", () => {
      const nameless: PublishedArticle = {
        ...article,
        sections: [
          {
            id: "s1",
            heading: "結論",
            paragraphs: ["本文。"],
            claims: [
              { id: "c1", statement: "最速", kind: "fact", evidence: [{ id: "e1", sourceLabel: " ", checkedAt: "2026-08-01" }] },
            ],
          },
        ],
      };
      expect(kindsOf(nameless)).not.toContain("sources");
    });
  });
});

describe("射影が 3 か所へ同じ形で届く", () => {
  const jsonLd = buildBlogPosting(article, {
    siteName: "ガジェット",
    origin: "https://example.test",
    basePath: "/gadget",
  });

  it("構造化データの citation は、射影した出典と 1 対 1 で対応する", () => {
    const sources = expressionBlocksOf(article).find((b) => b.kind === "sources");
    if (sources?.kind !== "sources") throw new Error("sources が無い");
    expect(jsonLd.citation).toEqual(
      sources.items.map((item) => ({
        "@type": "CreativeWork",
        name: item.label,
        ...(item.url === undefined ? {} : { url: item.url }),
      })),
    );
  });

  it("構造化データの abstract は、読者に見える要点をそのまま連ねたもの", () => {
    expect(jsonLd.abstract).toBe((article.keyPoints ?? []).join("\n"));
  });

  it("公開前監査の合否は、射影に出た種類と一致する", () => {
    const present = new Set(kindsOf(article));
    const okOf = (name: string) =>
      auditArticleForAiSearch(article).find((c) => c.check.includes(name))?.ok;

    expect(okOf("結論")).toBe(present.has("answer"));
    expect(okOf("要点")).toBe(present.has("key_points"));
    expect(okOf("よくある質問")).toBe(present.has("faq"));
    expect(okOf("出典")).toBe(present.has("sources"));
    expect(okOf("更新日")).toBe(present.has("freshness"));
  });

  it("要点を消すと、画面・構造化データ・監査が揃って落ちる", () => {
    const without: PublishedArticle = { ...article, keyPoints: undefined };
    expect(kindsOf(without)).not.toContain("key_points");
    expect(
      buildBlogPosting(without, { siteName: "ガジェット", origin: "", basePath: "" }).abstract,
    ).toBeUndefined();
    expect(
      auditArticleForAiSearch(without).find((c) => c.check.includes("要点"))?.ok,
    ).toBe(false);
  });

  it("空白と重複を含む記事でも、公開画面・JSON-LD・監査が同じ射影を読む", () => {
    const noisy: PublishedArticle = {
      ...article,
      summary: "  動画編集では書き出し速度を先に比べる。  ",
      keyPoints: ["  書き出し速度で選ぶなら A  ", "   ", "色の正確さなら B"],
      updatedAt: "  2026-08-20  ",
      faq: [
        { question: "  予算はいくら?  ", answer: "  10 万円台からです。  " },
        { question: " ", answer: "答えだけ" },
        { question: "問いだけ", answer: " " },
      ],
    };

    const view = toArticleView("gadget", noisy);
    const html = renderToStaticMarkup(createElement(ArticleView, { article: view }));
    const posting = buildBlogPosting(noisy, {
      siteName: "ガジェット",
      origin: "https://example.test",
      basePath: "/s/gadget",
    });
    const faqPage = buildFaqPage(noisy);
    const audit = auditArticleForAiSearch(noisy);

    expect(view).toMatchObject({
      summary: "動画編集では書き出し速度を先に比べる。",
      keyPoints: ["書き出し速度で選ぶなら A", "色の正確さなら B"],
      updatedAt: "2026-08-20",
      faq: [{ question: "予算はいくら?", answer: "10 万円台からです。" }],
    });
    expect(html).toContain("動画編集では書き出し速度を先に比べる。");
    expect(html).toContain("予算はいくら?");
    expect(html).not.toContain("答えだけ");
    expect(html.match(/メーカー仕様/g)).toHaveLength(2);

    expect(posting).toMatchObject({
      description: view.summary,
      abstract: view.keyPoints?.join("\n"),
      dateModified: view.updatedAt,
    });
    expect(posting.citation).toEqual([
      { "@type": "CreativeWork", name: "実測ログ" },
      { "@type": "CreativeWork", name: "メーカー仕様", url: "https://example.com/spec" },
    ]);
    expect(faqPage?.mainEntity).toEqual([
      {
        "@type": "Question",
        name: "予算はいくら?",
        acceptedAnswer: { "@type": "Answer", text: "10 万円台からです。" },
      },
    ]);
    expect(audit.find((check) => check.check === "よくある質問がある")?.ok).toBe(true);
    expect(audit.find((check) => check.check === "出典がある")?.ok).toBe(true);
  });
});
