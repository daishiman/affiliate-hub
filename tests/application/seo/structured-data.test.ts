/**
 * @tier 1
 * @req REQ-SEO01
 * @types equivalence, boundary
 */
import { describe, expect, it } from "vitest";
import type { PublishedArticle } from "@/application/read-models/published-article";
import {
  buildBlogPosting,
  buildBreadcrumbList,
  buildFaqPage,
  buildItemList,
  serializeJsonLd,
} from "@/application/seo/structured-data";

/** テスト用の最小の記事。必須欄だけ埋める。 */
const article: PublishedArticle = {
  slug: "laptops",
  siteSlug: "gadget",
  type: "ranking",
  title: "動画編集向けノートの選び方",
  summary: "実測で比べた結論を先に出す。",
  categorySlug: "laptop",
  publishedAt: "2026-08-01",
  updatedAt: "2026-08-20",
  author: { slug: "writer", name: "編集部", bio: "実測レビュー歴 5 年。", credentials: [] },
  disclosureRequired: true,
  sections: [{ id: "s1", heading: "結論", paragraphs: ["まずこれ。"] }],
};

const site = { siteName: "ガジェット研究室", origin: "https://example.com", basePath: "/s/gadget" };

describe("BlogPosting", () => {
  it("必須キーが揃い、URL は articleHref から引く", () => {
    const posting = buildBlogPosting(article, site);
    expect(posting["@type"]).toBe("BlogPosting");
    expect(posting.headline).toBe(article.title);
    expect(posting.description).toBe(article.summary);
    expect(posting.datePublished).toBe("2026-08-01");
    expect(posting.dateModified).toBe("2026-08-20");
    expect(posting.author).toMatchObject({ "@type": "Person", name: "編集部" });
    expect(posting.publisher).toMatchObject({ "@type": "Organization", name: site.siteName });
    // ranking 記事は /best 配下。画面のリンクと同じ道になる。
    expect(posting.mainEntityOfPage).toEqual({
      "@type": "WebPage",
      "@id": "https://example.com/s/gadget/best/laptops",
    });
    // 言語とカテゴリー。多言語の検索・AI 抽出に「日本語の記事」だと明示する。
    expect(posting.inLanguage).toBe("ja");
    expect(posting.articleSection).toBe("laptop");
  });

  it("著者は実在する著者ページの URL を持ち、資格 0 件なら hasCredential を出さない", () => {
    const posting = buildBlogPosting(article, site);
    expect(posting.author).toMatchObject({
      url: "https://example.com/s/gadget/authors/writer",
    });
    // 境界: 空配列の資格一覧は「資格の無い資格持ち」という嘘の構造。キーごと省く。
    expect(posting.author).not.toHaveProperty("hasCredential");
  });

  it("資格があるときだけ hasCredential に写る", () => {
    const posting = buildBlogPosting(
      {
        ...article,
        author: { ...article.author, credentials: ["家電製品アドバイザー"] },
      },
      site,
    );
    expect(posting.author).toMatchObject({
      hasCredential: [
        { "@type": "EducationalOccupationalCredential", name: "家電製品アドバイザー" },
      ],
    });
  });

  it("監修者が付いていないなら contributor を出さず、付いていれば Person で出す", () => {
    // 同値: 無い記事にキー自体を出さない（空の監修者は「監修されている風」の嘘）。
    expect(buildBlogPosting(article, site)).not.toHaveProperty("contributor");
    const reviewed = buildBlogPosting(
      {
        ...article,
        reviewedBy: { slug: "expert", name: "監修 太郎", bio: "整備士 10 年。", credentials: [] },
      },
      site,
    );
    expect(reviewed.contributor).toMatchObject({
      "@type": "Person",
      name: "監修 太郎",
      url: "https://example.com/s/gadget/authors/expert",
    });
  });
});

describe("ItemList（順位記事）", () => {
  it("ranking が無い・順位 0 件なら null（順位の無い順位表を出さない）", () => {
    // 境界: undefined と空配列の両方が「出さない」に写る。
    expect(buildItemList(article, site)).toBeNull();
    expect(
      buildItemList(
        {
          ...article,
          ranking: { caption: "空", updatedAt: "2026-08-20", criteria: [], entries: [], excluded: [] },
        },
        site,
      ),
    ).toBeNull();
  });

  it("順位・商品名が写り、reviewSlug がある商品だけ URL を持つ", () => {
    const list = buildItemList(
      {
        ...article,
        ranking: {
          caption: "動画編集ノート TOP2",
          updatedAt: "2026-08-20",
          criteria: [],
          entries: [
            {
              productId: "p1",
              rank: 1,
              productName: "ノート A",
              totalScore: 92,
              criterionScores: [],
              reviewSlug: "note-a",
              oneLine: "書き出しが最速。",
            },
            {
              productId: "p2",
              rank: 2,
              productName: "ノート B",
              totalScore: 88,
              criterionScores: [],
              oneLine: "軽さで選ぶなら。",
            },
          ],
          excluded: [],
        },
      },
      site,
    );
    expect(list).toMatchObject({ "@type": "ItemList", numberOfItems: 2 });
    expect(list?.itemListElement).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "ノート A",
        url: "https://example.com/s/gadget/reviews/note-a",
      },
      // レビュー未執筆の商品は URL を出さない（存在しないページへ送らない）。
      { "@type": "ListItem", position: 2, name: "ノート B" },
    ]);
  });
});

describe("パンくず", () => {
  it("position が 1 始まりで並ぶ", () => {
    const list = buildBreadcrumbList([
      { name: "ホーム", url: "https://example.com/s/gadget" },
      { name: "記事", url: "https://example.com/s/gadget/best/laptops" },
    ]);
    expect(list.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "ホーム", item: "https://example.com/s/gadget" },
      {
        "@type": "ListItem",
        position: 2,
        name: "記事",
        item: "https://example.com/s/gadget/best/laptops",
      },
    ]);
  });
});

describe("FAQ", () => {
  it("0 件なら null（質問の無い FAQ という嘘の構造を出さない）", () => {
    expect(buildFaqPage([])).toBeNull();
  });

  it("質問と答えが Question / Answer に写る", () => {
    const faq = buildFaqPage([{ question: "何を見て選ぶ?", answer: "まず書き出し速度。" }]);
    expect(faq?.mainEntity).toEqual([
      {
        "@type": "Question",
        name: "何を見て選ぶ?",
        acceptedAnswer: { "@type": "Answer", text: "まず書き出し速度。" },
      },
    ]);
  });
});

describe("HTML への埋め込み", () => {
  it("値の中の < を \\u003c に逃がす（</script> でタグを閉じさせない）", () => {
    const json = serializeJsonLd({ headline: "</script><script>alert(1)</script>" });
    expect(json).not.toContain("<");
    expect(json).toContain("\\u003c/script>");
    // JSON としての意味は変わらない。読み戻すと元の文字列に戻る。
    expect(JSON.parse(json)).toEqual({ headline: "</script><script>alert(1)</script>" });
  });
});
