/**
 * @tier 1
 * @req REQ-BOPS09
 * @types equivalence, boundary, decision-table, property
 *
 * トップの記事一覧の並べ方。
 *
 * --- なぜここを見るのか ---
 *
 * 実測（2026-09-08）で分岐 35.7%。「人気順」は式が 1 つしか無いので
 * 素通りしやすいが、**その式だけが「人気」の定義**であり、
 * ここが緩むと読者は無い人気を見せられる。
 *
 * 見るのは 3 つ。
 *
 * 1. **少ない票を割り引く。**1 票の満点が 50 票の平均 4.6 を追い越さない。
 * 2. **票が無いとき「人気順」は黙って「最新順」になる。**これは正しい
 *    振る舞いなので、意図として固定する。
 * 3. **住所を手で書き換えても壊れない。**知らない値は既定へ落ちる。
 */
import { describe, expect, it } from "vitest";
import type { RatingSummary } from "@/domain/blogops";
import {
  DEFAULT_HOME_SORT,
  HOME_SORTS,
  HOME_SORT_LABEL,
  parseHomeSort,
  popularityScore,
  sortArticles,
} from "@/domain/blogops/article-sort";

function rating(count: number, average: number | null): RatingSummary {
  return { count, average };
}

function article(slug: string, updatedAt: string) {
  return { slug, updatedAt };
}

describe("住所の ?sort= を並びに変える", () => {
  it.each([...HOME_SORTS])("知っている値 %s はそのまま通す", (sort) => {
    expect(parseHomeSort(sort)).toBe(sort);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["空文字", ""],
    ["知らない値", "oldest"],
    ["大文字", "LATEST"],
  ])("%s は既定へ落ちる（404 にすると、リンクを貼った人の側が壊れる）", (_label, raw) => {
    expect(parseHomeSort(raw)).toBe(DEFAULT_HOME_SORT);
  });

  it("並びの名前は全ての並びに用意する（読み上げがこれを使う）", () => {
    for (const sort of HOME_SORTS) expect(HOME_SORT_LABEL[sort]).not.toBe("");
  });
});

describe("人気の点数", () => {
  it.each([
    ["評価そのものが無い", undefined],
    ["票が 0", rating(0, null)],
    ["票はあるが平均が無い", rating(4, null)],
  ])("%s なら 0 点（根拠が無いのに順位を作らない）", (_label, summary) => {
    expect(popularityScore(summary)).toBe(0);
  });

  it("1 票の満点は、50 票の平均 4.6 を追い越さない", () => {
    expect(popularityScore(rating(1, 5))).toBeLessThan(popularityScore(rating(50, 4.6)));
  });

  it("同じ平均なら、票が多いほど高い（割引が薄まる）", () => {
    expect(popularityScore(rating(20, 4))).toBeGreaterThan(popularityScore(rating(3, 4)));
  });

  it("票が増えても平均そのものは越えない（上限は平均点）", () => {
    expect(popularityScore(rating(10_000, 4.2))).toBeLessThan(4.2);
  });
});

describe("記事を並べる", () => {
  const articles = [
    article("new", "2026-09-08T00:00:00.000Z"),
    article("mid", "2026-09-05T00:00:00.000Z"),
    article("old", "2026-09-01T00:00:00.000Z"),
  ];

  it("最新順は渡された順をそのまま返す（読み取り側の規則と二重にしない）", () => {
    const sorted = sortArticles(articles, "latest", { old: rating(50, 5) });
    expect(sorted).toBe(articles);
  });

  it("人気順は元の配列を変えない", () => {
    const before = [...articles];
    sortArticles(articles, "popular", { old: rating(50, 5) });
    expect(articles).toEqual(before);
  });

  it("人気順は点数の高い順に並べ替える", () => {
    const sorted = sortArticles(articles, "popular", {
      old: rating(50, 4.8),
      mid: rating(10, 4.0),
      new: rating(1, 5),
    });
    expect(sorted.map((one) => one.slug)).toEqual(["old", "mid", "new"]);
  });

  it("票が 1 つも無ければ、人気順は最新順と同じ並びになる", () => {
    expect(sortArticles(articles, "popular").map((one) => one.slug))
      .toEqual(["new", "mid", "old"]);
  });

  it("同点は新しい方を上にする（読み込むたび並びが揺れないように）", () => {
    const same = { new: rating(10, 4), mid: rating(10, 4), old: rating(10, 4) };
    const first = sortArticles(articles, "popular", same).map((one) => one.slug);
    const second = sortArticles([...articles].reverse(), "popular", same).map((one) => one.slug);
    expect(first).toEqual(["new", "mid", "old"]);
    expect(second).toEqual(first);
  });

  it("評価のある記事だけが上がり、無い記事は後ろへ回る", () => {
    const sorted = sortArticles(articles, "popular", { old: rating(30, 4.5) });
    expect(sorted[0]?.slug).toBe("old");
    expect(sorted.slice(1).map((one) => one.slug)).toEqual(["new", "mid"]);
  });

  it("空の一覧はどちらの並びでも空", () => {
    for (const sort of HOME_SORTS) expect(sortArticles([], sort)).toEqual([]);
  });
});
