/**
 * @tier 1
 * @req REQ-SEO02
 * @types scenario, boundary, property
 */
import { describe, expect, it } from "vitest";
import type { FeedItem } from "@/application/seo/feeds";
import { entrySitemapEntries, sitemapEntriesFor } from "@/application/seo/sitemap";
import {
  ARTICLE_TYPES,
  STANDARD_PAGES,
  articleIndexRoute,
  isCrawlableRoute,
  routesFor,
} from "@/domain/authoring";

/** 全ページを出すブログ。ルート表を最大限に開いた状態で見張る。 */
const ALL_PAGES = routesFor({ pages: [...STANDARD_PAGES] });

function item(path: string, updatedAt: string): FeedItem {
  return { path, title: `題名 ${path}`, summary: `要約 ${path}`, updatedAt };
}

/** 記事タイプ 1 種につき 1 本ずつ。索引が全部埋まる最小の入力。 */
const ONE_PER_TYPE: readonly FeedItem[] = ARTICLE_TYPES.map((type, index) =>
  item(`${articleIndexRoute(type).path}/item-${index}`, `2026-08-${10 + index}`),
);

function paths(entries: readonly { readonly path: string }[]): readonly string[] {
  return entries.map((entry) => entry.path);
}

describe("sitemap に載せる入口", () => {
  /**
   * これが ah-5b2p の本体。2026-09-06 まで sitemap には記事しか無く、
   * 索引・トップ・記事一覧・固定ページが 1 行も出ていなかった。
   *
   * **1 本ずつ名前で確かめるのではなく、ルート表と突き合わせる。**
   * 名前で並べると、表にルートを 1 本足した日にこの検査は緑のまま通り、
   * 新しい画面だけが誰にも宣伝されないまま残る。
   */
  it("出すと決めた画面のうち、機械へ渡せるものは全部載る", () => {
    const listed = new Set(paths(entrySitemapEntries(ALL_PAGES, ONE_PER_TYPE)));

    const missing = ALL_PAGES.filter(isCrawlableRoute)
      .map((route) => (route.path === "/" ? "" : route.path))
      .filter((path) => !listed.has(path));

    expect(missing, `sitemap に出ていない入口: ${missing.join(", ")}`).toEqual([]);
  });

  it("トップは末尾スラッシュ無しの住所で載る（同じ画面を2つの住所で宣伝しない）", () => {
    const listed = paths(entrySitemapEntries(ALL_PAGES, ONE_PER_TYPE));

    expect(listed).toContain("");
    expect(listed).not.toContain("/");
  });

  /**
   * 空の一覧を「これが私のページです」と差し出すと、検索側は中身の無い
   * URL を 1 つ抱えることになる。索引は記事があるときだけ載せる。
   */
  it("記事が 1 本も無い記事タイプの索引は載せない", () => {
    const rankingOnly = [item(`${articleIndexRoute("ranking").path}/laptops`, "2026-08-10")];
    const listed = paths(entrySitemapEntries(ALL_PAGES, rankingOnly));

    expect(listed).toContain(articleIndexRoute("ranking").path);
    expect(listed).not.toContain(articleIndexRoute("review").path);
    expect(listed).not.toContain(articleIndexRoute("comparison").path);
  });

  /**
   * トップと記事一覧は `page: null`（設定で消せない）ブログの骨格である。
   * 記事が 0 本の日に消えると、開設直後のブログが検索側から
   * 「1 つも URL の無いサイト」に見える。
   */
  it("記事が 0 本でも、トップと記事一覧は載る", () => {
    const listed = paths(entrySitemapEntries(ALL_PAGES, []));

    expect(listed).toContain("");
    expect(listed).toContain("/blog");
  });

  it("そのブログで出さないと決めた画面は載らない", () => {
    const noTools = routesFor({ pages: STANDARD_PAGES.filter((page) => page !== "tools") });
    const listed = paths(entrySitemapEntries(noTools, ONE_PER_TYPE));

    expect(listed).not.toContain(articleIndexRoute("tool").path);
  });

  /**
   * `/search` は入力欄だけ、`/shortlist` はその端末に保存した商品だけ。
   * クローラーが開くと中身が空になる。`/contact` も同じ `interactive` だが、
   * こちらは誰が開いても同じ案内が出るので載せる——分けているのは
   * 操作の有無ではなく「中身が閲覧者に依るか」である。
   */
  it("閲覧者ごとに中身が違う画面は載せず、固定の問い合わせは載せる", () => {
    const listed = paths(entrySitemapEntries(ALL_PAGES, ONE_PER_TYPE));

    expect(listed).not.toContain("/search");
    expect(listed).not.toContain("/shortlist");
    expect(listed).toContain("/contact");
  });

  it("旧 URL の転送ルートも、値の要る型も載せない", () => {
    const listed = paths(entrySitemapEntries(ALL_PAGES, ONE_PER_TYPE));

    for (const path of listed) {
      expect(path, `${path} に差し込み位置が残っています`).not.toContain("{");
    }
    // `/{fixedPage}` は 308 転送。canonical でない住所を宣伝しない。
    expect(listed).not.toContain("/{fixedPage}");
  });
});

describe("sitemap の更新日", () => {
  it("一覧の更新日は、その一覧に出る記事のいちばん新しい日になる", () => {
    const entries = entrySitemapEntries(ALL_PAGES, [
      item(`${articleIndexRoute("ranking").path}/a`, "2026-08-10"),
      item(`${articleIndexRoute("ranking").path}/b`, "2026-09-01"),
    ]);
    const rankingIndex = entries.find(
      (entry) => entry.path === articleIndexRoute("ranking").path,
    );

    expect(rankingIndex?.updatedAt).toBe("2026-09-01");
  });

  /**
   * 知らない更新日を今日で埋めると、1 年動いていない方針ページが
   * 毎日更新されたことになり、`lastmod` そのものが信用されなくなる。
   */
  it("更新日を持たない入口は、今日で埋めず null のままにする", () => {
    const entries = entrySitemapEntries(ALL_PAGES, ONE_PER_TYPE);
    const privacy = entries.find((entry) => entry.path === "/privacy");

    expect(privacy).toBeDefined();
    expect(privacy?.updatedAt).toBeNull();
  });
});

describe("sitemap の全行", () => {
  it("入口が先、記事が後に並び、記事の道は写しのまま変わらない", () => {
    const all = sitemapEntriesFor(ALL_PAGES, ONE_PER_TYPE);
    const articlePaths = ONE_PER_TYPE.map((feedItem) => feedItem.path);

    expect(paths(all).slice(-articlePaths.length)).toEqual(articlePaths);
    for (const feedItem of ONE_PER_TYPE) {
      expect(all).toContainEqual({ path: feedItem.path, updatedAt: feedItem.updatedAt });
    }
  });
});
