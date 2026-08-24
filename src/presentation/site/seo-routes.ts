import { type ArticleSummary, articleHref } from "@/application/read-models/published-article";
import type { PublicSiteBlueprint } from "@/application/usecases/site/read-site";
import { siteBasePathBySlug } from "@/domain/authoring/site";
import type { DomainError } from "@/domain/shared/errors";
import { readerActor, siteUseCases } from "@/presentation/composition";

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
  readonly articles: readonly ArticleSummary[];
};

export async function loadSeoSite(
  request: Request,
  siteSlug: string,
  articlePolicy: SeoArticlePolicy,
): Promise<{ ok: true; value: SeoSiteContext } | { ok: false; response: Response }> {
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
      // 配信 URL は届いたリクエストの origin から作る。環境変数に持つと
      // 開発・本番で URL がずれたまま配られる。
      origin: new URL(request.url).origin,
      basePath: siteBasePathBySlug(siteSlug),
      blueprint: site.value.blueprint,
      articles: articles.value,
    },
  };
}

/**
 * 50,000 件を超えたら「全件」と偽らない。
 * 分割 sitemap を実装するまでは、一部だけの200より明示的な503が安全。
 */
export function completeArticleSetError(articles: readonly ArticleSummary[]): Response | null {
  if (articles.length <= SITEMAP_URL_LIMIT) return null;
  return seoTextResponse(
    `公開記事が ${SITEMAP_URL_LIMIT.toLocaleString("en-US")} 件を超えているため、分割 sitemap が必要です。`,
    "text/plain; charset=utf-8",
    503,
  );
}

/** サイトマップの行。記事の道は articleHref から引く（組み立て直さない）。 */
export function sitemapEntries(
  articles: readonly ArticleSummary[],
): readonly { readonly path: string; readonly updatedAt: string }[] {
  return articles.map((a) => ({ path: articleHref(a), updatedAt: a.updatedAt }));
}
