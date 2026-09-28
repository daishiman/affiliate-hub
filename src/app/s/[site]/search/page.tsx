import { TRIGRAM_MIN_LENGTH } from "@/application/read-models/searchable-text";
import { DEFAULT_LIST_LIMIT } from "@/application/usecases/site/read-site";
import { readerActor, siteUseCases } from "@/presentation/composition";
import { ArticlePagination, articlePageHref, articlePageNumber } from "@/presentation/site/article-pagination";
import { SiteFrame } from "@/presentation/site/page-frame";
import { SearchBox } from "@/presentation/site/search-box";
import { siteHref, thumbnailContextOf, toArticleCards } from "@/presentation/site/view-model";
import { ArticleList, CategoryDirectory, EmptyView, ErrorView, Note, Section, SeeAlso, SitePage, SiteSection, TextLink, UI_COPY } from "@/presentation/ui";

export const dynamic = "force-dynamic";

export default async function SearchPage({ params, searchParams }: {
  params: Promise<{ site: string }>;
  searchParams: Promise<{ q?: string | string[]; tag?: string | string[]; page?: string | string[] }>;
}) {
  const [{ site }, raw] = await Promise.all([params, searchParams]);
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const query = first(raw.q)?.trim() ?? "";
  const tag = first(raw.tag)?.trim() || undefined;
  const page = articlePageNumber(raw.page);
  const result = query === "" && tag === undefined ? null : await (await siteUseCases()).search.execute(readerActor(), {
    siteSlug: site, query, tag, offset: (page - 1) * DEFAULT_LIST_LIMIT,
  });
  const path = siteHref(site, "/search");
  return (
    <SiteFrame siteSlug={site} currentPath={path} trail={[{ label: UI_COPY.reader.searchSubmit }]}
      searchResult={query !== "" && page === 1 && result?.ok ? {
        resultCount: result.value.hits.length, resultId: JSON.stringify([query, tag, page]),
      } : undefined}>
      {({ blueprint, projection }) => {
        const tagName = projection.tags.find((item) => item.slug === tag)?.name ?? "指定されたタグ";
        const title = result?.ok
          ? `${query === "" ? tagName : `「${query}」`}${tag && query !== "" ? `・${tagName}` : ""}：${result.value.hits.length}件${result.value.nextOffset !== null ? "（続きがあります）" : ""}${page > 1 ? `・${page}ページ目` : ""}`
          : "";
        return (
          <SitePage title={UI_COPY.reader.searchSubmit} wide>
            <SearchBox action={path} initialQuery={query} tag={tag} />
            {tag !== undefined && <SeeAlso><TextLink href={articlePageHref(path, 1, { q: query })}>タグの絞り込みを解除</TextLink></SeeAlso>}
            {result === null ? <EmptyView title={UI_COPY.reader.searchSubmit} body={UI_COPY.reader.searchPrompt} />
              : result.ok ? <>
                <Section title={title}>
                  {query !== "" && query.length < TRIGRAM_MIN_LENGTH && <Note>短い言葉は記事の題名・要約から探しています。本文を探すには、{TRIGRAM_MIN_LENGTH}文字以上で入力してください。</Note>}
                  <ArticleList telemetryPlacement="検索結果" articles={toArticleCards(site, result.value.hits.map((hit) => ({ ...hit, summary: hit.snippet ?? hit.summary })), thumbnailContextOf(blueprint))}
                    emptyTitle={UI_COPY.article.searchEmptyTitle} emptyBody={UI_COPY.article.searchEmptyBody} headingLevel="h3" />
                </Section>
                <ArticlePagination page={page} hasMore={result.value.nextOffset !== null}
                  hrefForPage={(next) => articlePageHref(path, next, { q: query, tag })} />
                {result.value.hits.length === 0 && <SiteSection id="search-alternatives" eyebrow="探し直す" title="カテゴリーから探す" lead="テーマを選ぶか、探す言葉を短くしてみてください。">
                  {blueprint.categories.length > 0
                    ? <CategoryDirectory items={blueprint.categories.map((category) => ({ href: siteHref(site, `/categories/${category.slug}`), label: category.name, description: category.oneLine }))} />
                    : <SeeAlso><TextLink href={siteHref(site, "/blog")}>公開中の記事を見る</TextLink></SeeAlso>}
                </SiteSection>}
              </> : <ErrorView title="探せませんでした" body={result.error.suggestedAction ?? result.error.message} />}
          </SitePage>
        );
      }}
    </SiteFrame>
  );
}
