import { readerActor, siteUseCases } from "@/presentation/composition";
import { ArticleList, PersonView, SectionHeading, SitePage, UI_COPY } from "@/presentation/ui";
import { ReadFailureBody, SiteFrame, stopIfMissing } from "./page-frame";
import { siteHref, toArticleCards } from "./view-model";

/**
 * 書き手・監修者のページ。
 *
 * 2 本のルート (`/authors/{slug}` と `/experts/{slug}`) が同じものを使う。
 * 「誰が書いたか」と「誰が確認したか」は読者にとって同じ形の情報なので、
 * 画面を 2 つ書き分けない。違うのは呼び方（書き手 / 監修者）だけ。
 */
export async function PersonPage({
  siteSlug,
  kind,
  slug,
}: {
  readonly siteSlug: string;
  readonly kind: "author" | "expert";
  readonly slug: string;
}) {
  const result = await (await siteUseCases()).getPerson.execute(readerActor(), {
    siteSlug,
    kind,
    slug,
  });

  // 無い書き手・監修者は 404 として打ち切る。**JSX を組み立てる前に。**（項目 36）
  if (!result.ok) stopIfMissing(result.error);

  const roleLabel = kind === "author" ? UI_COPY.article.author : UI_COPY.article.reviewedBy;
  const path = kind === "author" ? `/authors/${slug}` : `/experts/${slug}`;

  return (
    <SiteFrame
      siteSlug={siteSlug}
      currentPath={siteHref(siteSlug, path)}
      trail={[{ label: result.ok ? result.value.person.name : roleLabel }]}
    >
      {() =>
        result.ok ? (
          <SitePage title={result.value.person.name} lead={roleLabel}>
            <PersonView
              name={result.value.person.name}
              bio={result.value.person.bio}
              credentials={result.value.person.credentials}
            />
            <section>
              <SectionHeading level={2}>この人が関わった記事</SectionHeading>
              <ArticleList
                articles={toArticleCards(siteSlug, result.value.articles)}
                emptyTitle={UI_COPY.article.emptyListTitle}
                emptyBody={UI_COPY.article.emptyListBody}
              />
            </section>
          </SitePage>
        ) : (
          <ReadFailureBody what={roleLabel} siteSlug={siteSlug} />
        )
      }
    </SiteFrame>
  );
}
