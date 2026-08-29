/**
 * @tier 1
 * @req REQ-BLOG04, REQ-BOPS08
 * 受入条件 A9（`docs/spec/feat-blog-ops-crud/requirements-baseline.md`）に対応する。
 * @types boundary, equivalence
 *
 * 配信物の点検そのもの。
 *
 * **点検が「9 種すべてを見る」ことを最初に当てる。**
 * 見られなかった部品を配列から落とす実装にすると、一覧の「欠落 0 件」が
 * 「見た範囲では 0 件」に化ける。落ちないことは件数でしか確かめられない。
 */
import { describe, expect, it } from "vitest";
import {
  type DeliveryCheckResult,
  checkDeliveryParts,
} from "@/application/usecases/blog-ops";
import { DELIVERY_PARTS, type DeliveryPart } from "@/domain/blogops";

const SITE = {
  siteName: "見本の道具帳",
  purpose: "置き場所から道具を選ぶための案内。",
  origin: "https://example.test",
  basePath: "/s/sample",
  emitLlmsTxt: true,
} as const;

function article(slug: string, over: Partial<{ title: string; authorName: string }> = {}) {
  return {
    slug,
    title: over.title ?? `${slug} の記事`,
    authorName: over.authorName ?? "編集部",
    updatedAt: new Date("2026-08-20T00:00:00Z"),
  };
}

function resultFor(results: readonly DeliveryCheckResult[], part: DeliveryPart) {
  return results.find((r) => r.part === part);
}

describe("配信物の点検 (A9)", () => {
  it("公開記事が揃っていれば 9 種すべてが通る", () => {
    const results = checkDeliveryParts({
      ...SITE,
      articles: [article("stand-a1"), article("stand-b2")],
    });

    expect(results).toHaveLength(DELIVERY_PARTS.length);
    expect(results.filter((r) => !r.ok)).toStrictEqual([]);
  });

  it("見られなかった部品を落とさず、必ず 9 件返す", () => {
    // 材料が何も無い最悪の入力でも件数は変わらない。
    const results = checkDeliveryParts({
      siteName: "",
      purpose: "",
      origin: "",
      basePath: "",
      emitLlmsTxt: true,
      articles: [],
    });

    expect(results).toHaveLength(DELIVERY_PARTS.length);
    expect(results.map((r) => r.part)).toStrictEqual([...DELIVERY_PARTS]);
  });

  it("sitemap は本当に組み立てて、住所の件数を公開記事の本数と突き合わせる", () => {
    const results = checkDeliveryParts({
      ...SITE,
      articles: [article("a"), article("b"), article("c")],
    });

    const sitemap = resultFor(results, "sitemap_index");
    expect(sitemap?.ok).toBe(true);
    // 数字を直書きせず、入力の本数を使う。本数の作り方が変わった日に落ちるのが正しい。
    expect(sitemap?.detail).toContain("3 件");
  });

  it("公開記事が 0 本なら sitemap は通らない（空の一覧を「出せた」と言わない）", () => {
    const results = checkDeliveryParts({ ...SITE, articles: [] });
    expect(resultFor(results, "sitemap_index")?.ok).toBe(false);
  });

  it("同じ合言葉の記事が重なっていると、正規 URL の指定は通らない", () => {
    const results = checkDeliveryParts({
      ...SITE,
      articles: [article("same"), article("same")],
    });
    expect(resultFor(results, "canonical")?.ok).toBe(false);
  });

  it("書き手の名前が無い記事があると、記事の構造化データは通らない", () => {
    const results = checkDeliveryParts({
      ...SITE,
      articles: [article("a"), article("b", { authorName: "  " })],
    });

    expect(resultFor(results, "jsonld_article")?.ok).toBe(false);
    // 巻き添えにしない。名前が無いことは一覧の構造化データの可否とは別。
    expect(resultFor(results, "jsonld_collection")?.ok).toBe(true);
  });

  it("案内文を出さない設計図では、案内文の点検は通ったことにする", () => {
    const results = checkDeliveryParts({
      ...SITE,
      emitLlmsTxt: false,
      purpose: "",
      articles: [],
    });

    const llms = resultFor(results, "llms_txt");
    expect(llms?.ok).toBe(true);
    // 「出さない設定だから通した」ことが読めなければ、緑の意味が分からない。
    expect(llms?.detail).toContain("出さない設定");
  });

  it("robots は組み立てた結果に Sitemap の行があることまで見る", () => {
    const results = checkDeliveryParts({ ...SITE, articles: [article("a")] });
    const robots = resultFor(results, "robots");
    expect(robots?.ok).toBe(true);
    expect(robots?.detail).toContain("Sitemap");
  });

  it("どの結果にも、何を見たかの 1 文が付く", () => {
    const results = checkDeliveryParts({ ...SITE, articles: [] });
    expect(results.filter((r) => r.detail.trim() === "")).toStrictEqual([]);
  });
});
