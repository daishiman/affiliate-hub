export const SEO_OBSERVATIONS_ID = "article-observations";

/** 対象ブログと記事を保ったまま、差分・観測値の確認へ進む。 */
export function seoReviewHref(siteSlug: string, articleSlug?: string): string {
  const params = new URLSearchParams({ site: siteSlug });
  if (articleSlug !== undefined) params.set("article", articleSlug);
  return `/admin/seo?${params.toString()}`;
}

export function seoObservationHref(siteSlug: string, articleSlug: string): string {
  return `${seoReviewHref(siteSlug, articleSlug)}#${SEO_OBSERVATIONS_ID}`;
}
