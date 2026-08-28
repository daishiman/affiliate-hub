import { readerActor, siteUseCases } from "@/presentation/composition";
import { SiteFrame } from "@/presentation/site/page-frame";
import { siteHref, toArticleCards } from "@/presentation/site/view-model";
import {
  ArticleList,
  CategoryArticleGroups,
  ErrorView,
  SiteHomeHero,
  SiteSection,
  UI_COPY,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * ブログのトップ。
 *
 * ブログ 1 本ごとにこのファイルを作らない。`[site]` で受けて、
 * 設計図の設定値だけで見た目と中身が変わる（要求 C の複数ブログ対応）。
 */
export default async function SiteHome({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const recent = await (await siteUseCases()).listRecent.execute(readerActor(), { siteSlug: site });

  return (
    <SiteFrame siteSlug={site} currentPath={siteHref(site, "/")} pageKind="site_home">
      {({ blueprint, chrome }) => (
        <div>
          <SiteHomeHero
            name={blueprint.name}
            purpose={blueprint.purpose}
            searchHref={chrome.searchHref}
          />
          <SiteSection
            id="recent-articles"
            eyebrow="新着"
            title="新着記事"
            lead="公開・更新された記事から順に紹介します。"
          >
            {recent.ok ? (
              <ArticleList
                articles={toArticleCards(site, recent.value)}
                emptyTitle={UI_COPY.article.emptyListTitle}
                emptyBody={UI_COPY.article.emptyListBody}
                headingLevel="h3"
              />
            ) : (
              <ErrorView
                title="記事を読み込めませんでした"
                body={recent.error.suggestedAction ?? recent.error.message}
              />
            )}
          </SiteSection>

          <SiteSection
            id="category-articles"
            eyebrow="カテゴリー"
            title="テーマから探す"
            lead="知りたいテーマを選び、関連記事をまとめて探せます。"
          >
            <CategoryArticleGroups
              groups={blueprint.categories.map((category) => ({
                href: siteHref(site, `/categories/${category.slug}`),
                label: category.name,
                description: category.oneLine,
                articles: recent.ok
                  ? toArticleCards(
                      site,
                      recent.value
                        .filter((article) => article.categorySlug === category.slug)
                        .slice(0, 2),
                    )
                  : [],
              }))}
            />
          </SiteSection>
        </div>
      )}
    </SiteFrame>
  );
}
