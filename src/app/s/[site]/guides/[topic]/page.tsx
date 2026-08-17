import { ArticlePage } from "@/presentation/site/article-page";

export const dynamic = "force-dynamic";

/**
 * 選び方・使い方の記事。
 *
 * 中身は共通の `ArticlePage`。ここはルートの形を宣言するだけにする。
 * 画面の中身をここに書くと、記事タイプごとに表示がずれていく。
 */
export default async function GuideArticlePage({
  params,
}: {
  params: Promise<{ site: string; topic: string }>;
}) {
  const { site, topic } = await params;
  return (
    <ArticlePage
      siteSlug={site}
      slug={topic}
      pathPrefix="/guides"
      routeLabel="選び方・使い方"
    />
  );
}
