import { buildSitemapXml } from "@/application/seo/feeds";
import {
  SEO_ARTICLE_POLICY,
  completeArticleSetError,
  loadSeoSite,
  seoTextResponse,
  sitemapEntries,
} from "@/presentation/site/seo-routes";

export const dynamic = "force-dynamic";

/** サイトマップ。公開記事から自動生成する（feat-blog-ui-builder 受入条件 2）。 */
export async function GET(
  request: Request,
  context: { params: Promise<{ site: string }> },
): Promise<Response> {
  const { site } = await context.params;
  const loaded = await loadSeoSite(request, site, SEO_ARTICLE_POLICY.completeIndex);
  if (!loaded.ok) return loaded.response;
  const { origin, basePath, articles } = loaded.value;
  const capacityError = completeArticleSetError(articles);
  if (capacityError !== null) return capacityError;
  return seoTextResponse(
    buildSitemapXml(origin, basePath, sitemapEntries(articles)),
    "application/xml; charset=utf-8",
  );
}
