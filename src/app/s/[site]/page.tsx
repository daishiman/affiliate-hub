import type { Metadata } from "next";
import { readerActor, siteUseCases } from "@/presentation/composition";
import { siteHomeMetadata } from "@/presentation/site/site-metadata";
import { SiteFrame } from "@/presentation/site/page-frame";
import { siteHref, toArticleCards } from "@/presentation/site/view-model";
import { ArticleList, ErrorView, ListView, Section, SitePage, UI_COPY } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/** ブログ名と目的を検索結果・SNS・AI 検索へ渡す。設計図が正本。 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ site: string }>;
}): Promise<Metadata> {
  const { site } = await params;
  return siteHomeMetadata(site);
}

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
      {({ blueprint }) => (
        <SitePage title={blueprint.name} lead={blueprint.purpose} wide>
          <Section title="カテゴリー">
            <ListView
              rows={blueprint.categories.map((c) => ({
                key: c.slug,
                label: c.name,
                href: siteHref(site, `/categories/${c.slug}`),
                note: c.oneLine,
              }))}
            />
          </Section>

          <Section title="新着">
            {recent.ok ? (
              <ArticleList
                articles={toArticleCards(site, recent.value)}
                emptyTitle={UI_COPY.article.emptyListTitle}
                emptyBody={UI_COPY.article.emptyListBody}
              />
            ) : (
              <ErrorView
                title="記事を読み込めませんでした"
                body={recent.error.suggestedAction ?? recent.error.message}
              />
            )}
          </Section>
        </SitePage>
      )}
    </SiteFrame>
  );
}
