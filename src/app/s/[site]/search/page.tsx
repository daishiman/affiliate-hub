import { readerActor, siteUseCases } from "@/presentation/composition";
import { SiteFrame } from "@/presentation/site/page-frame";
import { SearchBox } from "@/presentation/site/search-box";
import { siteHref, toArticleCards } from "@/presentation/site/view-model";
import { ArticleList, EmptyView, ErrorView, SitePage, UI_COPY, fill } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 記事を探す。
 *
 * 4 つの状態をすべて出す:
 *   言葉が未入力 … 何をすればよいかを書く（空白のままにしない）
 *   0 件         … 「見つからなかった」と「壊れている」を区別する
 *   結果あり     … 件数を添える
 *   失敗         … 直せる言葉で理由を出す
 */
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ site: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { site } = await params;
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  const result = query === "" ? null : await (await siteUseCases()).search.execute(readerActor(), {
    siteSlug: site,
    query,
  });

  const path = "/search";

  return (
    <SiteFrame
      siteSlug={site}
      currentPath={siteHref(site, path)}
      trail={[{ label: UI_COPY.reader.searchSubmit }]}
    >
      {() => (
        <SitePage title={UI_COPY.reader.searchSubmit} wide>
          <SearchBox action={siteHref(site, path)} initialQuery={query} />

          {result === null ? (
            <EmptyView title={UI_COPY.reader.searchSubmit} body={UI_COPY.reader.searchPrompt} />
          ) : result.ok ? (
            <section>
              <h2>
                {fill(UI_COPY.reader.searchResultFormat, {
                  query: result.value.query,
                  count: result.value.hits.length,
                })}
              </h2>
              <ArticleList
                articles={toArticleCards(site, result.value.hits)}
                emptyTitle={UI_COPY.article.searchEmptyTitle}
                emptyBody={UI_COPY.article.searchEmptyBody}
                headingLevel="h3"
              />
            </section>
          ) : (
            <ErrorView
              title="探せませんでした"
              body={result.error.suggestedAction ?? result.error.message}
            />
          )}
        </SitePage>
      )}
    </SiteFrame>
  );
}
