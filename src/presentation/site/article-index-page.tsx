import type { Metadata } from "next";
import { PUBLIC_ARTICLE_PAGE_SIZE } from "@/application/read-models/article-discovery";
import { buildBreadcrumbList, buildArticleItemList } from "@/application/seo/structured-data";
import { articleIndexRoute, type ArticleType } from "@/domain/authoring";
import { siteBasePathBySlug } from "@/domain/authoring/site";
import { readerActor, siteUseCases } from "@/presentation/composition";
import { requestOriginFromNextHeaders } from "@/presentation/http/request-origin";
import { ArticleList, SeeAlso, SitePage, TextLink, UI_COPY } from "@/presentation/ui";
import { ArticlePagination, articlePageHref } from "./article-pagination";
import { JsonLdScript } from "./json-ld-script";
import { ReadFailureBody, SiteFrame } from "./page-frame";
import { siteListingMetadata } from "./site-metadata";
import { siteHref, thumbnailContextOf, toArticleCards } from "./view-model";

function indexRoute(type?: ArticleType) {
  return type === undefined ? { path: "/blog", label: "記事一覧" } : articleIndexRoute(type);
}

export function articleIndexMetadata(siteSlug: string, type?: ArticleType, page = 1): Promise<Metadata> {
  const route = indexRoute(type);
  return siteListingMetadata(siteSlug, articlePageHref(route.path, page), route.label);
}

/** 全記事と種類別索引は、絞り込み条件だけを変えて同じ読み取り・カード・ページ送りを使う。 */
export async function ArticleIndexPage({ siteSlug, type, page = 1 }: {
  readonly siteSlug: string;
  readonly type?: ArticleType;
  readonly page?: number;
}) {
  const route = indexRoute(type);
  const path = route.path;
  const origin = await requestOriginFromNextHeaders();
  const basePath = siteBasePathBySlug(siteSlug);
  return (
    <SiteFrame siteSlug={siteSlug} currentPath={siteHref(siteSlug, path)}
      trail={[{ label: route.label }]} pageKind="article" sidebar>
      {async ({ blueprint }) => {
        const result = await (await siteUseCases()).browse.execute(readerActor(), {
          siteSlug, type, limit: PUBLIC_ARTICLE_PAGE_SIZE, offset: (page - 1) * PUBLIC_ARTICLE_PAGE_SIZE,
        });
        if (!result.ok) return <ReadFailureBody what={route.label} siteSlug={siteSlug} />;
        const cards = toArticleCards(siteSlug, result.value.articles, thumbnailContextOf(blueprint));
        const itemList = buildArticleItemList(cards.map((card) => ({ title: card.title, url: `${origin}${card.href}` })));
        return (
          <>
            {origin !== null && <>
              <JsonLdScript value={buildBreadcrumbList([
                { name: blueprint.name, url: `${origin}${basePath}` },
                { name: route.label, url: `${origin}${basePath}${articlePageHref(path, page)}` },
              ])} />
              {itemList !== null && <JsonLdScript value={itemList} />}
            </>}
            <SitePage title={route.label} lead={blueprint.purpose} wide>
              <ArticleList telemetryPlacement="記事一覧" articles={cards}
                emptyTitle={page === 1 ? UI_COPY.article.emptyListTitle : "このページには記事がありません"}
                emptyBody={page === 1 ? UI_COPY.article.emptyListBody : "記事の公開状況が変わった可能性があります。前のページからお探しください。"} />
              <ArticlePagination page={page} hasMore={result.value.hasMore}
                hrefForPage={(next) => articlePageHref(siteHref(siteSlug, path), next)} />
              <SeeAlso><TextLink href={siteHref(siteSlug, "/")}>トップへ戻る</TextLink></SeeAlso>
            </SitePage>
          </>
        );
      }}
    </SiteFrame>
  );
}
