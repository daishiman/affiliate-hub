import { ArticlePage } from "@/presentation/site/article-page";

export const dynamic = "force-dynamic";

/**
 * 個別レビューの記事。
 *
 * 中身は共通の `ArticlePage`。ここはルートの形を宣言するだけにする。
 * 画面の中身をここに書くと、記事タイプごとに表示がずれていく。
 */
export default async function ReviewArticlePage({
  params,
}: {
  params: Promise<{ site: string; product: string }>;
}) {
  const { site, product } = await params;
  return (
    <ArticlePage
      siteSlug={site}
      slug={product}
      pathPrefix="/reviews"
      routeLabel="個別レビュー"
    />
  );
}
