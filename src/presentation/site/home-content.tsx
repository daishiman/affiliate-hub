import type { ArticleSummary } from "@/application/read-models/published-article";
import type { PublicSiteBlueprint } from "@/application/usecases/site/read-site";
import {
  ArticleList,
  CategoryArticleGroups,
  ErrorView,
  SiteHomeHero,
  SiteSection,
  UI_COPY,
  type ArticleCardView,
  type CategoryArticleGroupView,
} from "@/presentation/ui";
import { siteHref, toArticleCards, toChrome } from "./view-model";

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

/**
 * 設計図と記事一覧を、ブログトップがそのまま描ける形へ変える。
 *
 * 本画面も静的 preview もこの変換だけを通す。取得元や外枠は共有しないため、
 * preview の都合が本番のエラー処理や認証境界へ入り込まない。
 */
export function toSiteHomeView(
  siteSlug: string,
  blueprint: PublicSiteBlueprint,
  recent: readonly ArticleSummary[],
): SiteHomeView {
  const chrome = toChrome(siteSlug, blueprint);
  return {
    name: blueprint.name,
    purpose: blueprint.purpose,
    searchHref: chrome.searchHref,
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

/**
 * ブログトップの本文だけを描く純粋な部品。
 *
 * データ取得、`SiteFrame` / `SiteShell`、CSS、ファイル出力は持たない。
 * 取得失敗の判断も呼び出し側で済ませ、ここには表示用文言だけを渡す。
 */
export function SiteHomeContent({
  view,
  recentError,
}: {
  readonly view: SiteHomeView;
  readonly recentError?: SiteHomeRecentErrorView;
}) {
  return (
    <div>
      <SiteHomeHero name={view.name} purpose={view.purpose} searchHref={view.searchHref} />
      <SiteSection
        id="recent-articles"
        eyebrow="新着"
        title="新着記事"
        lead="公開・更新された記事から順に紹介します。"
      >
        {recentError === undefined ? (
          <ArticleList
            articles={view.recentArticles}
            emptyTitle={UI_COPY.article.emptyListTitle}
            emptyBody={UI_COPY.article.emptyListBody}
            headingLevel="h3"
          />
        ) : (
          <ErrorView title={recentError.title} body={recentError.body} />
        )}
      </SiteSection>

      <SiteSection
        id="category-articles"
        eyebrow="カテゴリー"
        title="テーマから探す"
        lead="知りたいテーマを選び、関連記事をまとめて探せます。"
      >
        <CategoryArticleGroups groups={view.categoryGroups} />
      </SiteSection>
    </div>
  );
}
