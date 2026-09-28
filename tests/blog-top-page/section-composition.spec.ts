/** @tier 2 */
import { getAllByRole, getByRole, within } from "@testing-library/dom";
import { describe, expect, it } from "vitest";
import { SITE } from "../ui/route-cases";
import { renderCase } from "../ui/route-table";
import { intoDom } from "../support/render";

/**
 * トップ画面の区画構成を、**読者から見える名前**で見る。
 *
 * 見るのは「おすすめ → 記事（最新／人気の切替つき） → カテゴリーから探す →
 * 記事一覧への導線」という並び。読む人は上から順に降りるので、順番そのものが
 * 情報の優先度である。
 *
 * **升目の位置や class 名では見ない。**位置で見ると、名前を変えても緑のままになり、
 * 構造を変えただけで赤になる。ここが見るのは
 * 「その名前の区画が、その順で、辿れる形で在るか」だけ。
 */

const HOME = { file: "s/[site]/page.tsx", params: { site: SITE } } as const;

async function homeDom(searchParams: Record<string, string> = {}) {
  return intoDom(await renderCase({ ...HOME, searchParams }));
}

/** 画面の中の見出しを、上から順に文字だけで返す。 */
function headingTexts(document: Document): readonly string[] {
  return [...document.querySelectorAll("h1,h2,h3")].map((h) => (h.textContent ?? "").trim());
}

/** ある名前の区画が、何番目に現れるか。無ければ -1。 */
function orderOf(headings: readonly string[], name: string): number {
  return headings.findIndex((h) => h.includes(name));
}

describe("トップ画面の区画構成", () => {
  it("読者の降りる順に、名前の付いた区画が並んでいる", async () => {
    const { document, cleanup } = await homeDom();
    const headings = headingTexts(document);
    cleanup();

    const recommended = orderOf(headings, "おすすめ記事");
    const articles = orderOf(headings, "記事を読む");
    const categories = orderOf(headings, "カテゴリーから探す");
    const all = orderOf(headings, "記事の一覧へ");

    expect(
      recommended,
      `「おすすめ記事」の区画がありません: ${headings.join(" / ")}`,
    ).toBeGreaterThan(-1);
    expect(articles, `「記事を読む」の区画がありません: ${headings.join(" / ")}`).toBeGreaterThan(
      -1,
    );
    expect(
      categories,
      `「カテゴリーから探す」の区画がありません: ${headings.join(" / ")}`,
    ).toBeGreaterThan(-1);
    expect(all, `「記事の一覧へ」の区画がありません: ${headings.join(" / ")}`).toBeGreaterThan(-1);

    // 読む順の主張。運営者の選定から全体へ広げ、カテゴリーと一覧出口へ降りる。
    expect(recommended, "おすすめ記事が記事全体より後に来ています").toBeLessThan(articles);
    expect(articles, "記事より先にカテゴリーが来ています").toBeLessThan(categories);
    expect(categories, "カテゴリーより先に一覧への導線が来ています").toBeLessThan(all);
  });

  it("並べ替えの切替は、記事の区画の中にある", async () => {
    const { document, cleanup } = await homeDom();
    const nav = document.querySelector('nav[aria-label="記事の並べ替え"]');
    const inArticles = nav?.closest("section")?.querySelector("h2")?.textContent ?? "";
    cleanup();

    expect(nav, "並べ替えの切替が見つかりません").not.toBeNull();
    // 切替は「何を並べ替えるのか」の隣にある必要がある。画面の隅にあると対象が分からない。
    expect(inArticles, "並べ替えが記事の区画の外に置かれています").toContain("記事を読む");
  });

  it("記事の一覧へ渡す導線は、検索ではなく公開記事一覧へ行く", async () => {
    const { document, cleanup } = await homeDom();
    const allArticles = getByRole(document.body, "region", { name: "記事の一覧へ" });
    const link = within(allArticles).getByRole("link", {
      name: "公開中の記事をすべて見る",
    });
    const href = link.getAttribute("href");
    cleanup();

    expect(
      href,
      "「全記事を見る」が検索画面へ向いています",
    ).toBe(`/s/${SITE}/blog`);
  });

  it("同じ『すべて見る』導線は、本文でもフッターでも同じ公開記事一覧へ行く", async () => {
    const { document, cleanup } = await homeDom();
    const hrefs = getAllByRole(document.body, "link", {
      name: "公開中の記事をすべて見る",
    }).map((link) => link.getAttribute("href"));
    cleanup();

    expect(hrefs.length).toBeGreaterThan(1);
    expect(new Set(hrefs)).toEqual(new Set([`/s/${SITE}/blog`]));
  });

  it("後方互換の補助帯は、記事・カテゴリー・一覧出口の後に読まれる", async () => {
    const { document, cleanup } = await homeDom();
    const headings = getAllByRole(document.body, "heading");
    const names = headings.map((heading) => (heading.textContent ?? "").trim());
    const order = (name: string) =>
      headings.indexOf(getByRole(document.body, "heading", { name }));

    const articles = order("記事を読む");
    const categories = order("カテゴリーから探す");
    const all = order("記事の一覧へ");
    const sisterSites = order("姉妹サイト");
    cleanup();

    expect(articles, `記事区画がありません: ${names.join(" / ")}`).toBeGreaterThan(-1);
    expect(categories, `カテゴリー区画がありません: ${names.join(" / ")}`).toBeGreaterThan(-1);
    expect(all, `記事一覧の出口がありません: ${names.join(" / ")}`).toBeGreaterThan(-1);
    expect(sisterSites, `姉妹サイト帯がありません: ${names.join(" / ")}`).toBeGreaterThan(-1);
    expect(articles, "記事より先にカテゴリーが来ています").toBeLessThan(categories);
    expect(categories, "カテゴリーより先に一覧出口が来ています").toBeLessThan(all);
    expect(
      all,
      "補助帯が canonical な記事・カテゴリー・一覧出口より先に来ています",
    ).toBeLessThan(sisterSites);
  });

  it("記事カードは 16:9 の図版を、場所を先に確保した形で持つ", async () => {
    const { document, cleanup } = await homeDom();
    const imgs = [...document.querySelectorAll("img")];
    const sized = imgs.filter(
      (img) => img.getAttribute("width") !== null && img.getAttribute("height") !== null,
    );
    const ratios = sized.map((img) => {
      const w = Number(img.getAttribute("width"));
      const h = Number(img.getAttribute("height"));
      return h === 0 ? 0 : Math.round((w / h) * 100) / 100;
    });
    cleanup();

    expect(imgs.length, "図版が 1 枚も出ていません").toBeGreaterThan(0);
    // 幅と高さを属性で持たないと、読み込み後に本文が押し下がる（CLS）。
    expect(sized.length, "幅と高さを持たない図版があります").toBe(imgs.length);
    expect(
      ratios.filter((r) => r !== 1.78),
      `16:9 でない図版があります: ${ratios.join(", ")}`,
    ).toEqual([]);
  });

  it("図版は読み上げから外れている（すぐ下の見出しと同じ記事を指すため）", async () => {
    const { document, cleanup } = await homeDom();
    const alts = [...document.querySelectorAll("img")].map((img) => img.getAttribute("alt"));
    cleanup();

    // 題を 2 回読み上げさせない。空の alt は「無い」ではなく「読まない」の宣言。
    expect(
      alts.filter((alt) => alt !== ""),
      "図版に説明文が付いています。同じ題が 2 回読まれます",
    ).toEqual([]);
  });
});
