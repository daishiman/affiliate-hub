import { buildRssXml } from "@/application/seo/feeds";
import {
  SEO_ARTICLE_POLICY,
  loadSeoSite,
  seoTextResponse,
} from "@/presentation/site/seo-routes";

export const dynamic = "force-dynamic";

/** RSS 2.0。新着記事を購読・AI 収集の両方へ配る（受入条件 2）。 */
export async function GET(
  request: Request,
  context: { params: Promise<{ site: string }> },
): Promise<Response> {
  const { site } = await context.params;
  const loaded = await loadSeoSite(request, site, SEO_ARTICLE_POLICY.feed);
  if (!loaded.ok) return loaded.response;
  const { origin, basePath, blueprint, items } = loaded.value;
  return seoTextResponse(
    buildRssXml(
      { siteName: blueprint.name, origin, basePath, description: blueprint.purpose },
      items,
    ),
    "application/rss+xml; charset=utf-8",
  );
}
