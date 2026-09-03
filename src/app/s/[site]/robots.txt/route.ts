import { buildRobotsTxt } from "@/application/seo/feeds";
import {
  SEO_ARTICLE_POLICY,
  loadSeoSite,
  seoTextResponse,
} from "@/presentation/site/seo-routes";

export const dynamic = "force-dynamic";

/**
 * クローラー方針。AI クローラー（GPTBot / ClaudeBot / PerplexityBot /
 * Google-Extended）を明示許可し、sitemap の場所を知らせる（受入条件 2）。
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ site: string }> },
): Promise<Response> {
  const { site } = await context.params;
  const loaded = await loadSeoSite(request, site, SEO_ARTICLE_POLICY.none);
  if (!loaded.ok) return loaded.response;
  const { origin, basePath, blueprint } = loaded.value;
  return seoTextResponse(
    buildRobotsTxt(origin, basePath, { emitLlmsTxt: blueprint.emitLlmsTxt }),
    "text/plain; charset=utf-8",
  );
}
