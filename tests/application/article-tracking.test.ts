/** @tier 1 @req REQ-E13, REQ-P09 @types equivalence, boundary */
import { describe, expect, it } from "vitest";
import {
  applyTrackingCodes,
  collectOutboundLinks,
  countTrackingCoverage,
} from "@/application/read-models/article-tracking";
import type { PublishedArticle } from "@/application/read-models/published-article";

/**
 * 記事から外向きリンクを集め、合言葉を埋め戻す計算。
 *
 * ここで固定したいのは 3 つ。
 *   1. 順位表と商品カードの**両方**を歩くこと（片方だけだとクリックが 2 系統に割れる）
 *   2. `affiliateUrl` を 1 文字も変えないこと（変えると ASP の規約違反になる）
 *   3. 埋まらなかったものが**数えられる形で残る**こと（空文字で発行済みに見せない）
 */

const AUTHOR = {
  slug: "author-a",
  name: "書き手",
  bio: "紹介文。",
  credentials: [],
};

function anArticle(over: Partial<PublishedArticle> = {}): PublishedArticle {
  return {
    slug: "best-laptops",
    siteSlug: "gadget",
    type: "ranking",
    title: "おすすめノートパソコン",
    summary: "まとめ。",
    categorySlug: "laptops",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    author: AUTHOR,
    disclosureRequired: true,
    sections: [],
    ...over,
  };
}

function ranking(
  entries: readonly { productId: string; affiliateUrl?: string; trackingCode?: string }[],
): PublishedArticle["ranking"] {
  return {
    caption: "順位",
    updatedAt: "2026-08-18",
    criteria: [],
    excluded: [],
    entries: entries.map((e, i) => ({
      productId: e.productId,
      rank: i + 1,
      productName: `商品 ${e.productId}`,
      totalScore: 80,
      criterionScores: [],
      oneLine: "一言。",
      ...(e.affiliateUrl === undefined ? {} : { affiliateUrl: e.affiliateUrl }),
      ...(e.trackingCode === undefined ? {} : { trackingCode: e.trackingCode }),
    })),
  };
}

function card(productId: string, affiliateUrl?: string) {
  return {
    productId,
    name: `商品 ${productId}`,
    brand: "ブランド",
    oneLine: "一言。",
    specs: [],
    ...(affiliateUrl === undefined ? {} : { affiliateUrl }),
  };
}

describe("記事から外向きリンクを集める", () => {
  it("順位表と商品カードの両方を集める", () => {
    const article = anArticle({
      ranking: ranking([{ productId: "p1", affiliateUrl: "https://asp.example/p1" }]),
      productCards: [card("p2", "https://asp.example/p2")],
    });
    const links = collectOutboundLinks(article);
    expect(links.map((l) => l.placement).sort()).toEqual(["product_card", "ranking"]);
    expect(links.map((l) => l.destinationUrl).sort()).toEqual([
      "https://asp.example/p1",
      "https://asp.example/p2",
    ]);
  });

  it("成果リンクが無い商品は集めない（転送先が空の写しを作らないため）", () => {
    const article = anArticle({
      ranking: ranking([{ productId: "p1" }, { productId: "p2", affiliateUrl: "https://a/2" }]),
    });
    expect(collectOutboundLinks(article).map((l) => l.productId)).toEqual(["p2"]);
  });

  it("記事の道は articleHref と同じものを使う（記事ごとの集計がずれないため）", () => {
    const article = anArticle({
      type: "review",
      slug: "quiet-laptop",
      productCards: [card("p1", "https://a/1")],
    });
    expect(collectOutboundLinks(article)[0]?.articlePath).toBe("/reviews/quiet-laptop");
  });

  it("すでに合言葉が入っているものは、入っていることが分かる形で出る", () => {
    const article = anArticle({
      ranking: ranking([
        { productId: "p1", affiliateUrl: "https://a/1", trackingCode: "abc123" },
        { productId: "p2", affiliateUrl: "https://a/2" },
      ]),
    });
    const links = collectOutboundLinks(article);
    expect(links.find((l) => l.productId === "p1")?.trackingCode).toBe("abc123");
    expect(links.find((l) => l.productId === "p2")?.trackingCode).toBeNull();
  });
});

describe("合言葉を記事へ埋め戻す", () => {
  it("順位表と商品カードの両方に入る", () => {
    const article = anArticle({
      ranking: ranking([{ productId: "p1", affiliateUrl: "https://a/1" }]),
      productCards: [card("p1", "https://a/1")],
    });
    const links = collectOutboundLinks(article);
    const codes = new Map(links.map((l) => [l.slotKey, `code-${l.placement}`]));
    const applied = applyTrackingCodes(article, codes);
    expect(applied.ranking?.entries[0]?.trackingCode).toBe("code-ranking");
    expect(applied.productCards?.[0]?.trackingCode).toBe("code-product_card");
  });

  it("ASP が発行した URL を 1 文字も変えない", () => {
    const url = "https://asp.example/click?a=1&b=2";
    const article = anArticle({ ranking: ranking([{ productId: "p1", affiliateUrl: url }]) });
    const links = collectOutboundLinks(article);
    const applied = applyTrackingCodes(article, new Map([[links[0]!.slotKey, "xyz789"]]));
    expect(applied.ranking?.entries[0]?.affiliateUrl).toBe(url);
  });

  it("発行されなかったものは、合言葉が無いまま残る（空文字を入れない）", () => {
    const article = anArticle({
      ranking: ranking([
        { productId: "p1", affiliateUrl: "https://a/1" },
        { productId: "p2", affiliateUrl: "https://a/2" },
      ]),
    });
    const links = collectOutboundLinks(article);
    const only = links.find((l) => l.productId === "p1")!;
    const applied = applyTrackingCodes(article, new Map([[only.slotKey, "code1"]]));
    expect(applied.ranking?.entries[0]?.trackingCode).toBe("code1");
    expect(applied.ranking?.entries[1]?.trackingCode).toBeUndefined();
  });

  it("順位表も商品カードも無い記事を壊さない", () => {
    const article = anArticle();
    expect(applyTrackingCodes(article, new Map())).toEqual(article);
  });
});

describe("突合できるようになっている割合", () => {
  it("0 本のときは総数も 0（「1 本もない」と「全部そろっている」を混ぜない）", () => {
    expect(countTrackingCoverage([])).toEqual({
      total: 0,
      tracked: 0,
      untracked: 0,
      untrackedArticles: [],
    });
  });

  it("合言葉の無いリンクを抱えている記事が分かる", () => {
    const a = anArticle({
      slug: "a",
      ranking: ranking([
        { productId: "p1", affiliateUrl: "https://a/1", trackingCode: "c1" },
        { productId: "p2", affiliateUrl: "https://a/2" },
      ]),
    });
    const b = anArticle({
      slug: "b",
      ranking: ranking([{ productId: "p3", affiliateUrl: "https://a/3", trackingCode: "c3" }]),
    });
    const coverage = countTrackingCoverage([a, b]);
    expect(coverage).toMatchObject({ total: 3, tracked: 2, untracked: 1 });
    // 全部そろっている記事は挙げない（挙げると直す先が読み取れなくなる）。
    expect(coverage.untrackedArticles).toEqual(["gadget/a"]);
  });

  it("全部に合言葉が入っていれば未発行は 0 件", () => {
    const a = anArticle({
      ranking: ranking([{ productId: "p1", affiliateUrl: "https://a/1", trackingCode: "c1" }]),
    });
    expect(countTrackingCoverage([a])).toMatchObject({ untracked: 0, untrackedArticles: [] });
  });
});
