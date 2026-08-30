import type { ArticleSummary } from "@/application/read-models/published-article";
import type { PublicSiteBlueprint } from "@/application/usecases/site/read-site";
import {
  ArticleList,
  CategoryArticleDirectory,
  ErrorView,
  SectionHeading,
  SitePage,
  UI_COPY,
  type ArticleCardView,
  type CategoryArticleGroupView,
} from "@/presentation/ui";
import { siteHref, toArticleCards } from "./view-model";

/** ブログトップを描くために必要な、取得処理を含まない表示用の形。 */
export type SiteHomeView = {
  readonly name: string;
  readonly purpose: string;
  readonly searchHref: string;
  readonly recentArticles: readonly ArticleCardView[];
  readonly categoryGroups: readonly CategoryArticleGroupView[];
};

/** 取得失敗を表示するときの、読者向けに整形済みの文言。 */
export type SiteHomeRecentErrorView = {
  readonly title: string;
  readonly body: string;
};

/** 設計図と記事一覧を、本画面と静的 preview が共有する表示用の形へ変換する。 */
export function toSiteHomeView(
  siteSlug: string,
  blueprint: PublicSiteBlueprint,
  recent: readonly ArticleSummary[],
): SiteHomeView {
  return {
    name: blueprint.name,
    purpose: blueprint.purpose,
    searchHref: siteHref(siteSlug, "/search"),
    recentArticles: toArticleCards(siteSlug, recent),
    categoryGroups: blueprint.categories.map((category) => ({
      href: siteHref(siteSlug, `/categories/${category.slug}`),
      label: category.name,
      description: category.oneLine,
      articles: toArticleCards(
        siteSlug,
        recent.filter((article) => article.categorySlug === category.slug).slice(0, 2),
      ),
    })),
  };
}

/** 取得済みのトップページ情報だけを描く純粋な表示境界。 */
export function SiteHomeContent({
  view,
  recentError,
}: {
  readonly view: SiteHomeView;
  readonly recentError?: SiteHomeRecentErrorView;
}) {
  return (
    <SitePage title={view.name} lead={view.purpose} wide>
      <form method="get" action={view.searchHref} role="search" aria-label="ホームから記事を探す">
        <label htmlFor="site-home-search">記事を検索</label>
        <input id="site-home-search" type="search" name="q" placeholder="知りたいことを入力" />
        <button type="submit">検索</button>
      </form>

      <section aria-labelledby="recent-articles">
        <SectionHeading level={2} id="recent-articles">新着記事</SectionHeading>
        {recentError === undefined ? (
          <ArticleList
            articles={view.recentArticles}
            emptyTitle={UI_COPY.article.emptyListTitle}
            emptyBody={UI_COPY.article.emptyListBody}
          />
        ) : (
          <ErrorView title={recentError.title} body={recentError.body} />
        )}
      </section>

      <section aria-labelledby="category-articles">
        <SectionHeading level={2} id="category-articles">テーマから探す</SectionHeading>
        <CategoryArticleDirectory groups={view.categoryGroups} />
      </section>
    </SitePage>
  );
}
