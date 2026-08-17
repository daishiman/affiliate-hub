import { ArticlePage } from "@/presentation/site/article-page";

export const dynamic = "force-dynamic";

/**
 * 比較の記事。
 *
 * 中身は共通の `ArticlePage`。ここはルートの形を宣言するだけにする。
 * 画面の中身をここに書くと、記事タイプごとに表示がずれていく。
 */
export default async function ComparisonArticlePage({
  params,
}: {
  params: Promise<{ site: string; comparison: string }>;
}) {
  const { site, comparison } = await params;
  return (
    <ArticlePage
      siteSlug={site}
      slug={comparison}
      pathPrefix="/compare"
      routeLabel="比較"
    />
  );
}
