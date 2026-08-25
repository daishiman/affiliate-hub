import { ArticlePage } from "@/presentation/site/article-page";
import { createArticlePageMetadata } from "@/presentation/site/site-metadata";

export const dynamic = "force-dynamic";

/** 検索結果・SNS・AI 検索へ渡す題名と要約。画面と同じ読み取りモデルから作る。 */
export const generateMetadata = createArticlePageMetadata("topic");

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
