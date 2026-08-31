import { type ArticleSummary, articleHref } from "@/application/read-models/published-article";
import type { FeedItem } from "@/application/seo/feeds";
import type { PublicSiteBlueprint } from "@/application/usecases/site/read-site";
import { siteBasePathBySlug } from "@/domain/authoring/site";
import type { BlogArticle } from "@/domain/blogops/blog-article";
import type { DomainError } from "@/domain/shared/errors";
import {
  publicBlogEntry,
  readerActor,
  requestOriginFromWebRequest,
  siteUseCases,
} from "@/presentation/composition";

/**
 * 機械向け配信ルート（sitemap / robots / feed / llms.txt）の共通の読み取り口。
 *
 * サイトの読み方とエラー応答は同じだが、記事の選び方は同じではない。
 * RSS は新着、sitemap / llms.txt は公開記事の網羅が目的なので、
 * 用途を名前の付いた policy としてルートから必ず渡す。
 *
 * 報酬・運営情報はここを通らない（読者向け読み取りポートのみ）。
 */

const NO_STORE = { "cache-control": "no-store" } as const;

/** RSS は購読者が追う新着だけを配る。 */
export const RSS_ARTICLE_LIMIT = 20;
/** sitemap 1 本が持てる URL 数の上限。 */
export const SITEMAP_URL_LIMIT = 50_000;
/** 上限超過を黙って切らないため、1 件多く読む。 */
export const COMPLETE_ARTICLE_SCAN_LIMIT = SITEMAP_URL_LIMIT + 1;

export type SeoArticlePolicy =
  | { readonly purpose: "none" }
  | { readonly purpose: "recent-feed"; readonly limit: typeof RSS_ARTICLE_LIMIT }
  | { readonly purpose: "complete-index"; readonly limit: typeof COMPLETE_ARTICLE_SCAN_LIMIT };

export const SEO_ARTICLE_POLICY = {
  none: { purpose: "none" },
  feed: { purpose: "recent-feed", limit: RSS_ARTICLE_LIMIT },
  completeIndex: { purpose: "complete-index", limit: COMPLETE_ARTICLE_SCAN_LIMIT },
} as const satisfies Record<string, SeoArticlePolicy>;

export function seoTextResponse(body: string, contentType: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { ...NO_STORE, "content-type": contentType },
  });
}

/** 無いブログは 404、読めない事故は 503。同じ 404 にすると壊れと不在の区別が消える。 */
export function seoErrorResponse(error: DomainError): Response {
  const status = error.code === "NOT_FOUND" ? 404 : 503;
  return new Response(error.message, {
    status,
    headers: { ...NO_STORE, "content-type": "text/plain; charset=utf-8" },
  });
}

export type SeoSiteContext = {
  readonly origin: string;
  readonly basePath: string;
  readonly blueprint: PublicSiteBlueprint;
  /**
   * 配信物に載せる記事。**2 系統を合流させたもの**（新しい順）。
   *
   * 公開面の記事には入口が 2 つある。編集済みの読み取りモデル
   * （`/best` `/guides` `/reviews` `/compare` `/tools`）と、
   * ブログ運用で書いた記事（`/blog/<slug>`）である。
   * ここで合流させないと、機械向け配信からは後者が存在しないことになる。
   */
  readonly items: readonly FeedItem[];
};

/** 編集済み読み取りモデルを配信物の行へ。道は `articleHref` が正本。 */
function toFeedItem(article: ArticleSummary): FeedItem {
  return {
    path: articleHref(article),
    title: article.title,
    summary: article.summary,
    updatedAt: article.updatedAt,
  };
}

/**
 * ブログ運用で書いた記事を配信物の行へ。
 *
 * 要約は導入文（`lead`）を使う。運用側の記事は `summary` を持たないので、
 * **空文字を出さない**——空の説明が並ぶ llms.txt は、AI から見て
 * 「説明の無い記事が 7 本ある」に読めてしまう。
 */
function blogToFeedItem(article: BlogArticle): FeedItem {
  return {
    path: `/blog/${article.slug}`,
    title: article.title,
    summary: article.lead,
    // 配信物の日付は `YYYY-MM-DD`。時刻は sitemap でも RSS でも要らない。
    updatedAt: article.updatedAt.toISOString().slice(0, 10),
  };
}

export async function loadSeoSite(
  request: Request,
  siteSlug: string,
  articlePolicy: SeoArticlePolicy,
): Promise<{ ok: true; value: SeoSiteContext } | { ok: false; response: Response }> {
  const origin = requestOriginFromWebRequest(request);
  if (origin === null) {
    return {
      ok: false,
      response: seoTextResponse(
        "リクエストの公開元を安全に読み取れませんでした。",
        "text/plain; charset=utf-8",
        400,
      ),
    };
  }

  const useCases = await siteUseCases();
  const site = await useCases.getSite.execute(readerActor(), { siteSlug });
  if (!site.ok) return { ok: false, response: seoErrorResponse(site.error) };
  const articles =
    articlePolicy.purpose === "none"
      ? { ok: true as const, value: [] as readonly ArticleSummary[] }
      : await useCases.listRecent.execute(readerActor(), {
          siteSlug,
          limit: articlePolicy.limit,
        });
  if (!articles.ok) return { ok: false, response: seoErrorResponse(articles.error) };

  /*
    ブログ運用で書いた記事。読者向けの口（公開状態のものしか返さない）を通す。
    ここを作成者向けの口にすると、下書きが sitemap から漏れる。

    読めなかったときは**配信を止める**。片方だけ載った sitemap を 200 で配ると、
    検索エンジンには「載っていない記事は消えた」と読める。
  */
  const blogItems =
    articlePolicy.purpose === "none"
      ? { ok: true as const, value: [] as readonly FeedItem[] }
      : await readPublishedBlogArticles(siteSlug, articlePolicy.limit);
  if (!blogItems.ok) return { ok: false, response: blogItems.response };

  return {
    ok: true,
    value: {
      // metadata / JSON-LD / IndexNow と同じ厳格な request-origin 規則を通す。
      origin,
      basePath: siteBasePathBySlug(siteSlug),
      blueprint: site.value.blueprint,
      items: mergeByRecency(articles.value.map(toFeedItem), blogItems.value, articlePolicy),
    },
  };
}

/**
 * 公開済みのブログ運用記事を読む。ブログ自体が無いときは空（404 にしない）。
 *
 * `openSite` が `null` を返すのは「公開サイトが無い」ときだが、そこは
 * 手前の `getSite` が既に判定している。ここまで来て `null` なら
 * 運用側の記事が 1 本も無いだけなので、空として扱う。
 */
async function readPublishedBlogArticles(
  siteSlug: string,
  limit: number,
): Promise<
  { ok: true; value: readonly FeedItem[] } | { ok: false; response: Response }
> {
  const entry = await publicBlogEntry();
  const opened = await entry.port.openSite(siteSlug);
  if (!opened.ok) return { ok: false, response: seoErrorResponse(opened.error) };
  if (opened.value === null) return { ok: true, value: [] };
  const published = await opened.value.listPublished(limit);
  if (!published.ok) return { ok: false, response: seoErrorResponse(published.error) };
  return { ok: true, value: published.value.map(blogToFeedItem) };
}

/**
 * 2 系統を新しい順にひとつへ。
 *
 * **新着配信（RSS）では合流後にもう一度上限で切る。** 切らないと、
 * 片方から 20 本・もう片方から 20 本で 40 本の「新着 20 件」ができる。
 * 網羅が目的の sitemap / llms.txt では切らない——そこで切ると、
 * 落ちた記事が「公開されていない」と読まれてしまう。
 */
function mergeByRecency(
  left: readonly FeedItem[],
  right: readonly FeedItem[],
  policy: SeoArticlePolicy,
): readonly FeedItem[] {
  const merged = [...left, ...right].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return policy.purpose === "recent-feed" ? merged.slice(0, policy.limit) : merged;
}

/**
 * 50,000 件を超えたら「全件」と偽らない。
 * 分割 sitemap を実装するまでは、一部だけの200より明示的な503が安全。
 */
export function completeArticleSetError(items: readonly FeedItem[]): Response | null {
  if (items.length <= SITEMAP_URL_LIMIT) return null;
  return seoTextResponse(
    `公開記事が ${SITEMAP_URL_LIMIT.toLocaleString("en-US")} 件を超えているため、分割 sitemap が必要です。`,
    "text/plain; charset=utf-8",
    503,
  );
}

/**
 * サイトマップの行。
 *
 * 道は既に `FeedItem.path` として引き終わっている（`toFeedItem` /
 * `blogToFeedItem` が正本）。ここで組み立て直すと、記事の種類が
 * 増えた日にこの関数だけ古い写し方のまま残る。
 */
export function sitemapEntries(
  items: readonly FeedItem[],
): readonly { readonly path: string; readonly updatedAt: string }[] {
  return items.map((item) => ({ path: item.path, updatedAt: item.updatedAt }));
}
