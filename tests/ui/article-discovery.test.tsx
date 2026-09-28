/** @tier 2 */
import { renderToStaticMarkup } from "react-dom/server";
import { ArticlePagination, articlePageHref } from "@/presentation/site/article-pagination";
import { getByRole } from "@testing-library/dom";
import { describe, expect, it } from "vitest";
import { intoDom } from "../support/render";
import { renderCase } from "./route-table";
import { SITE } from "./route-cases";

describe("読者の記事探索の出口", () => {
  it("検索0件でもカテゴリーへ移って探し直せる", async () => {
    const { document, cleanup } = intoDom(await renderCase({ file: "s/[site]/search/page.tsx", params: { site: SITE }, searchParams: { q: "確実に該当しないことばXYZ" } }));
    expect(getByRole(document.body, "region", { name: "カテゴリーから探す" }).querySelector('a[href*="/categories/"]')).not.toBeNull();
    cleanup();
  });
  it("タグURLを開くと未入力の案内に戻さずタグで絞った結果を示す", async () => {
    const { document, cleanup } = intoDom(await renderCase({ file: "s/[site]/search/page.tsx", params: { site: SITE }, searchParams: { tag: "north" } }));
    expect(getByRole(document.body, "link", { name: "タグの絞り込みを解除" })).toBeTruthy();
    expect(document.body.textContent).toContain("0件");
    cleanup();
  });
  it("全記事一覧にも他の一覧と同じ図版がある", async () => {
    const { document, cleanup } = intoDom(await renderCase({ file: "s/[site]/blog/page.tsx", params: { site: SITE } }));
    expect(document.querySelectorAll('img[width="640"][height="360"]').length).toBeGreaterThan(0);
    cleanup();
  });
});


it("2ページ目から前後に進んでも検索語とタグ条件を保つ", () => {
  const { document, cleanup } = intoDom(renderToStaticMarkup(
    <ArticlePagination page={2} hasMore hrefForPage={(page) => articlePageHref("/s/blog/search", page, { q: "静かな 椅子", tag: "north" })} />,
  ));
  const previous = getByRole(document.body, "link", { name: "前のページ" }).getAttribute("href");
  const next = getByRole(document.body, "link", { name: "次のページ" }).getAttribute("href");
  const before = new URL(previous!, "https://example.com");
  const after = new URL(next!, "https://example.com");
  expect(before.searchParams.has("page")).toBe(false);
  expect(after.searchParams.get("page")).toBe("3");
  for (const url of [before, after]) {
    expect(url.searchParams.get("q")).toBe("静かな 椅子");
    expect(url.searchParams.get("tag")).toBe("north");
  }
  cleanup();
});


it("短い検索語は題名・要約から探す範囲を伝える", async () => {
  const { document, cleanup } = intoDom(await renderCase({ file: "s/[site]/search/page.tsx", params: { site: SITE }, searchParams: { q: "AI" } }));
  expect(document.body.textContent).toContain("短い言葉は記事の題名・要約から探しています");
  cleanup();
});
