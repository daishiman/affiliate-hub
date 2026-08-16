import { readerActor, siteUseCases } from "@/presentation/composition";
import { NotFoundBody, SiteFrame } from "@/presentation/site/page-frame";
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
  const result = await siteUseCases().listByCategory.execute(readerActor(), {
    siteSlug: site,
    categorySlug: category,
  });

  const path = `/categories/${category}`;

  return (
    <SiteFrame
      siteSlug={site}
      currentPath={siteHref(site, path)}
      trail={result.ok ? [{ label: result.value.category.name }] : [{ label: "カテゴリー" }]}
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
          <NotFoundBody what="カテゴリー" siteSlug={site} />
        )
      }
    </SiteFrame>
  );
}
