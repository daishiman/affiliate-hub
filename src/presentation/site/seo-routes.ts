import { type ArticleSummary, articleHref } from "@/application/read-models/published-article";
import type { FeedItem } from "@/application/seo/feeds";
import type { PublicSiteBlueprint } from "@/application/usecases/site/read-site";
import { siteBasePathBySlug } from "@/domain/authoring/site";
import type { DomainError } from "@/domain/shared/errors";
import {
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
   * 配信物に載せる記事（新しい順）。
   *
   * **2026-09-02 まで、ここは 2 系統を合流させていた。**編集済みの読み取り
   * モデル（`/best` `/guides` `/reviews` `/compare` `/tools`）と、ブログ運用で
   * 書いた記事（`/blog/<slug>`）を別の入口として読み、`mergeByRecency` で
   * 束ねていた。P07 の実測で「4 種とも 200 なのに公開記事 7 本が 1 本も
   * 載っていない」が出たときの手当てである。
   *
   * いま合流は要らない。`published_articles` が**唯一の公開 projection** に
   * なり（`drizzle/0043_canonical_public_articles.sql`）、ブログ運用側の
   * `listPublished` は編集側と**同じ `listRecent` を呼ぶ**ようになった。
   * 2 系統として読むと、同じ記事が 2 行ずつ並ぶ sitemap になる。
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

  return {
    ok: true,
    value: {
      // metadata / JSON-LD / IndexNow と同じ厳格な request-origin 規則を通す。
      origin,
      basePath: siteBasePathBySlug(siteSlug),
      blueprint: site.value.blueprint,
      /*
        `listRecent` は `published_articles`（唯一の公開 projection）を
        新しい順で返す。並べ替えも再度の上限切りもここでは要らない。
        ブログ運用の記事もこの表に載るので、別の口から読んで足すと二重になる。
      */
      items: articles.value.map(toFeedItem),
    },
  };
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
