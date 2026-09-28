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
  const { origin, basePath, items, routes } = loaded.value;
  /*
    上限は「配る行数」で見る。入口ぶんを数えないと、記事数が上限すれすれの
    ブログで入口だけが静かに溢れる。だから先に行を作ってから数える。
  */
  const entries = sitemapEntries(routes, items);
  const capacityError = completeArticleSetError(entries.length);
  if (capacityError !== null) return capacityError;
  return seoTextResponse(
    buildSitemapXml(origin, basePath, entries),
    "application/xml; charset=utf-8",
  );
}
