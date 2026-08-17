import { ArticlePage } from "@/presentation/site/article-page";

export const dynamic = "force-dynamic";

/**
 * おすすめ順位の記事。
 *
 * 中身は共通の `ArticlePage`。ここはルートの形を宣言するだけにする。
 * 画面の中身をここに書くと、記事タイプごとに表示がずれていく。
 */
export default async function RankingArticlePage({
  params,
}: {
  params: Promise<{ site: string; topic: string }>;
}) {
  const { site, topic } = await params;
  return (
    <ArticlePage
      siteSlug={site}
      slug={topic}
      pathPrefix="/best"
      routeLabel="おすすめ順位"
    />
  );
}
