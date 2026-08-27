import { readerActor, siteUseCases } from "@/presentation/composition";
import { ReadFailureBody, SiteFrame, stopIfMissing } from "@/presentation/site/page-frame";
import { siteHref, toArticleCards } from "@/presentation/site/view-model";
import { ArticleList, SitePage, UI_COPY } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/** カテゴリーの記事一覧。カテゴリー名と 1 文説明はユースケースが返す。 */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ site: string; category: string }>;
}) {
  const { site, category } = await params;
  const result = await (await siteUseCases()).listByCategory.execute(readerActor(), {
    siteSlug: site,
    categorySlug: category,
  });

  // 無いカテゴリーは 404 として打ち切る。**JSX を組み立てる前に。**（項目 36）
  if (!result.ok) stopIfMissing(result.error);

  const path = `/categories/${category}`;

  return (
    <SiteFrame
      siteSlug={site}
      currentPath={siteHref(site, path)}
      trail={result.ok ? [{ label: result.value.category.name }] : [{ label: "カテゴリー" }]}
      pageKind="category"
      sidebar
    >
      {() =>
        result.ok ? (
          <SitePage title={result.value.category.name} lead={result.value.category.oneLine} wide>
            <ArticleList
              articles={toArticleCards(site, result.value.articles)}
              emptyTitle={UI_COPY.article.emptyListTitle}
              emptyBody={UI_COPY.article.emptyListBody}
            />
          </SitePage>
        ) : (
          <ReadFailureBody what="カテゴリー" siteSlug={site} />
        )
      }
    </SiteFrame>
  );
}
