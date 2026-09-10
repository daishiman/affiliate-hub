/** @tier 2 */
import { describe, expect, it } from "vitest";
import { parseHomeSort } from "@/domain/blogops";
import { SITE } from "../ui/route-cases";
import { renderCase } from "../ui/route-table";
import { intoDom } from "../support/render";

/**
 * 並べ替えが、**JavaScript が動かなくても届く**ことを見る。
 *
 * ==========================================================================
 * なぜ「形」を見るのか
 * ==========================================================================
 *
 * 並べ替えを `<button>` で作ると、押した後に何が起きるかは JavaScript 次第になる。
 * 通信が細い回線、スクリプトが落ちた読み込み、読み上げ環境の一部では、
 * 押しても何も起きないボタンが残る。`<a href>` なら、押しどころが住所そのものなので、
 * ブラウザだけで並びが変わる。
 *
 * **だからここは「動くか」ではなく「リンクであるか」を見る。**
 * 動作を見る検査は JavaScript を動かして測るので、JavaScript 無効時の到達性を
 * その検査では証明できない。形が保証で、形を固定するのがこの検査の仕事である。
 *
 * ==========================================================================
 * 既定の並びに `?sort=` を付けない
 * ==========================================================================
 *
 * `/s/x` と `/s/x?sort=latest` は中身が同じで住所が違う。検索側からは別ページに見え、
 * どちらを出すかの判断を外へ委ねることになる。既定は問い合わせを持たない。
 */

const HOME = { file: "s/[site]/page.tsx", params: { site: SITE } } as const;

async function sortLinks(searchParams: Record<string, string> = {}) {
  const { document, cleanup } = intoDom(await renderCase({ ...HOME, searchParams }));
  const nav = document.querySelector('nav[aria-label="記事の並べ替え"]');
  const links = [...(nav?.querySelectorAll("a[href]") ?? [])].map((a) => ({
    text: (a.textContent ?? "").trim(),
    href: a.getAttribute("href") ?? "",
    current: a.getAttribute("aria-current"),
  }));
  const buttons = [...(nav?.querySelectorAll("button") ?? [])].length;
  cleanup();
  return { nav, links, buttons };
}

describe("並べ替えの JavaScript 無効到達性", () => {
  it("切り替えは押しボタンではなく、住所を持つリンクである", async () => {
    const { nav, links, buttons } = await sortLinks();

    expect(nav, "並べ替えの区画がありません").not.toBeNull();
    // 押しボタンが 1 つでもあると、そこは JavaScript 無しでは動かない。
    expect(buttons, "並べ替えに押しボタンが混ざっています").toBe(0);
    expect(links.length, "並べ替えの選択肢が 2 本ありません").toBe(2);
    expect(
      links.filter((l) => l.href === ""),
      "行き先を持たない切り替えがあります",
    ).toEqual([]);
  });

  it("既定の並びの行き先に `?sort=` が付かない", async () => {
    const { links } = await sortLinks();
    const latest = links.find((l) => !l.href.includes("sort="));

    expect(latest, `既定の並びの行き先が見つかりません: ${links.map((l) => l.href).join(" / ")}`)
      .toBeDefined();
    // 同じ内容のトップが 2 つの住所を持たない。
    expect(latest?.href, "既定の行き先が問い合わせを持っています").not.toMatch(/\?sort=/);
    // 飛んだ先が記事の区画であること。上まで戻されると押した意味が伝わらない。
    expect(latest?.href, "並べ替えの着地点が記事の区画ではありません").toContain("#home-articles");
  });

  it("もう一方の並びは `?sort=popular` として住所に出る", async () => {
    const { links } = await sortLinks();
    const popular = links.find((l) => l.href.includes("sort="));

    expect(popular, "人気順への行き先がありません").toBeDefined();
    expect(popular?.href).toContain("?sort=popular");
    expect(popular?.href).toContain("#home-articles");
  });

  it("いま選ばれている並びが、住所に応じて読み上げから辿れる", async () => {
    const initial = await sortLinks();
    const switched = await sortLinks({ sort: "popular" });

    const currentOf = (links: readonly { href: string; current: string | null }[]) =>
      links.find((l) => l.current === "true")?.href ?? null;

    // 既定では `?sort=` の無い方、`?sort=popular` ではもう一方へ印が移る。
    expect(currentOf(initial.links), "既定でいま選ばれている並びが分かりません").not.toBeNull();
    expect(currentOf(initial.links)).not.toMatch(/\?sort=/);
    expect(currentOf(switched.links), "住所を変えても印が移りません").toContain("?sort=popular");
  });

  it("知らない `?sort=` の値でも、既定へ落として画面を出す", async () => {
    // 住所は読者以外も作る（古いリンク、貼り間違い、機械の巡回）。
    // 知らない値で 404 にすると、押した人には「壊れている」としか見えない。
    expect(parseHomeSort("oldest")).toBe("latest");
    expect(parseHomeSort("")).toBe("latest");
    expect(parseHomeSort(null)).toBe("latest");
    expect(parseHomeSort(undefined)).toBe("latest");
    expect(parseHomeSort("popular")).toBe("popular");

    const { links } = await sortLinks({ sort: "oldest" });
    expect(links.length, "知らない並びで画面が壊れています").toBe(2);
    expect(
      links.find((l) => l.current === "true")?.href,
      "知らない並びが既定へ落ちていません",
    ).not.toMatch(/\?sort=/);
  });
});
