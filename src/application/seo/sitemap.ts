import { type SiteRoute, isCrawlableRoute, listedArticleScope } from "@/domain/authoring";
import type { FeedItem } from "./feeds";

/**
 * sitemap に何を載せるかを決める唯一の場所。
 *
 * ==========================================================================
 * なぜ要るのか
 * ==========================================================================
 *
 * 2026-09-06 まで、sitemap の行は公開記事の写しだけだった
 * （`sitemapEntries(items)` が `items.map` するだけ）。つまり:
 *
 * - トップ `/`           — 載っていない
 * - 記事一覧 `/blog`     — 載っていない
 * - 記事タイプの索引 5 本 — 載っていない
 * - 固定ページ 8 種       — 載っていない
 *
 * 索引は記事へ渡すハブである。ハブを 1 つも載せないと、検索側から見た
 * このブログは「親のいない記事が n 本ある」だけの形になる。記事の
 * `BreadcrumbList` が親 URL を主張しても、その親自身はどの sitemap にも
 * 出てこない URL のままになる（残課題 ah-5b2p）。
 *
 * ==========================================================================
 * 載せない 3 つ
 * ==========================================================================
 *
 * 1. `{name}` を含む型・転送ルート・閲覧者ごとに中身が違うルート
 *    → `isCrawlableRoute`（判断はルート表のそば）
 * 2. **記事が 1 本も無い記事タイプの索引**
 *    → 空の一覧を「これが私のページです」と差し出さない
 * 3. カテゴリー・書き手・監修者の個別ページ
 *    → 値を知らないとURLにならない。ここでは扱わない（後述）
 *
 * トップと記事一覧は記事 0 本でも載せる。どちらも `page: null` で設定から
 * 消せない、ブログの骨格そのものだからである。記事タイプの索引は逆に、
 * 設定でその種類を出さなければ `routesFor` の時点で消える。
 *
 * ==========================================================================
 * まだ載っていないもの
 * ==========================================================================
 *
 * `/categories/{category}`・`/authors/{author}`・`/experts/{expert}` は
 * 値の一覧をここでは持っていないので出せない。**「無い」と決めたのではなく
 * 「この関数の入力に無い」だけ**である。渡す側が値を持った日に、記事と
 * 同じく `items` 側の入口として足せる形にしてある。
 */

/**
 * sitemap の 1 行。
 *
 * `updatedAt` が `null` なのは「更新日を知らない」であって「今日」ではない。
 * 知らない日を今日で埋めると、1 年動いていない方針ページが毎日更新された
 * ことになり、`lastmod` そのものが信用されなくなる。
 */
export type SitemapEntry = {
  readonly path: string;
  readonly updatedAt: string | null;
};

/** `YYYY-MM-DD` は辞書順が日付順。整形済みの文字列をそのまま比べる。 */
function latestUpdatedAt(items: readonly FeedItem[]): string | null {
  return items.reduce<string | null>(
    (latest, item) => (latest === null || item.updatedAt > latest ? item.updatedAt : latest),
    null,
  );
}

/**
 * トップの道。
 *
 * `canonicalSiteUrl` は `origin + basePath + path` を繋ぐので、
 * ルート表の `"/"` をそのまま渡すと `/s/gadget/` になる。ブログのトップの
 * canonical は末尾スラッシュ無しの `/s/gadget` なので、空文字へ写す。
 * ここを間違えると、同じトップが 2 つの住所で宣伝される。
 */
const HOME_PATH = "";

/**
 * ブログの静的な入口を sitemap の行にする。
 *
 * 記事の行は含まない（呼ぶ側が繋ぐ）。分けてあるのは、入口の選び方と
 * 記事の選び方が別の理由で変わるからである。
 */
export function entrySitemapEntries(
  routes: readonly SiteRoute[],
  items: readonly FeedItem[],
): readonly SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  for (const route of routes) {
    if (!isCrawlableRoute(route)) continue;
    const scope = listedArticleScope(route);
    if (scope === "none") {
      entries.push({ path: route.path, updatedAt: null });
      continue;
    }
    const listed =
      scope === "all"
        ? items
        : items.filter((item) => item.path.startsWith(`${route.path}/`));
    // 空の索引は渡さない。トップ・記事一覧（`all`）は 0 本でも骨格として載せる。
    if (scope === "under-path" && listed.length === 0) continue;
    entries.push({
      path: route.path === "/" ? HOME_PATH : route.path,
      updatedAt: latestUpdatedAt(listed),
    });
  }
  return entries;
}

/**
 * sitemap の全行。**入口を先に、記事を後に置く。**
 *
 * 順序に決まりは無いが、上から読む相手に骨格を先に見せるほうが、
 * どの記事がどの入口の下にあるかを掴みやすい。
 */
export function sitemapEntriesFor(
  routes: readonly SiteRoute[],
  items: readonly FeedItem[],
): readonly SitemapEntry[] {
  return [
    ...entrySitemapEntries(routes, items),
    ...items.map((item) => ({ path: item.path, updatedAt: item.updatedAt })),
  ];
}
