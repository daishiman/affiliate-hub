import { buildLlmsTxt } from "@/application/seo/feeds";
import {
  SEO_ARTICLE_POLICY,
  completeArticleSetError,
  loadSeoSite,
  seoTextResponse,
} from "@/presentation/site/seo-routes";

export const dynamic = "force-dynamic";

/**
 * llms.txt（AI 向けサイト要約）。正式標準ではないため設計図の任意項目
 * （`emitLlmsTxt`）で出し分ける。出さない設定なら 404（黙って空を配らない）。
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ site: string }> },
): Promise<Response> {
  const { site } = await context.params;
  const loaded = await loadSeoSite(request, site, SEO_ARTICLE_POLICY.completeIndex);
  if (!loaded.ok) return loaded.response;
  const { origin, basePath, blueprint, articles } = loaded.value;
  if (!blueprint.emitLlmsTxt) {
    return new Response("このブログは llms.txt を出さない設定です。", {
      status: 404,
      headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" },
    });
  }
  const capacityError = completeArticleSetError(articles);
  if (capacityError !== null) return capacityError;
  return seoTextResponse(
    buildLlmsTxt(
      { siteName: blueprint.name, purpose: blueprint.purpose, origin, basePath },
      articles,
    ),
    "text/plain; charset=utf-8",
  );
}
