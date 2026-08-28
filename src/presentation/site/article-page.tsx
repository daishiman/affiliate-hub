import { readerActor, siteUseCases } from "@/presentation/composition";
import type { PageKind } from "@/presentation/tools/webmcp-policy";
import { ArticleTableOfContents, ArticleView } from "@/presentation/ui";
import { ReadFailureBody, SiteFrame } from "./page-frame";
import { siteHref, toArticleCards, toArticleView } from "./view-model";

/**
 * 記事 1 本の画面。
 *
 * 順位 (`/best`)・レビュー (`/reviews`)・比較 (`/compare`)・選び方 (`/guides`) の
 * 4 ルートはすべてこれを呼ぶ。**記事タイプごとに画面を作らない。**
 *
 * 作ると、広告表示の出し方・出典の出し方・パンくずの作り方が
 * 4 通りに分かれ、法令に関わる表示の直し漏れがそこから生まれる。
 * ルートごとの違いは URL の前半だけで、画面の中身は 1 つ。
 */
/**
 * URL の前半から、ページの種類を決める。
 *
 * 画面は 1 つでも、読者がそこでやりたいことはルートごとに違う。
 * 比較のページに順位の説明の道具を渡しても、説明する順位がそこに無い。
 */
const PAGE_KIND_BY_PREFIX: Readonly<Record<string, PageKind>> = {
  "/best": "ranking",
  "/compare": "comparison",
  "/reviews": "product",
  "/guides": "article",
};

export async function ArticlePage({
  siteSlug,
  slug,
  pathPrefix,
  routeLabel,
}: {
  readonly siteSlug: string;
  readonly slug: string;
  /** `/best` など。パンくずと現在地の表示に使う。 */
  readonly pathPrefix: string;
  readonly routeLabel: string;
}) {
  const useCases = await siteUseCases();
  const actor = readerActor();
  const [result, recent] = await Promise.all([
    useCases.getArticle.execute(actor, { siteSlug, slug }),
    useCases.listRecent.execute(actor, { siteSlug, limit: 4 }),
  ]);
  const path = `${pathPrefix}/${slug}`;
  const relatedArticles = recent.ok
    ? toArticleCards(
        siteSlug,
        recent.value.filter((candidate) => candidate.slug !== slug).slice(0, 3),
      )
    : undefined;
  const article = result.ok ? toArticleView(siteSlug, result.value, relatedArticles) : null;
  const failure = result.ok ? null : result.error;

  return (
    <SiteFrame
      siteSlug={siteSlug}
      currentPath={siteHref(siteSlug, path)}
      trail={[{ label: routeLabel }, { label: result.ok ? result.value.title : "記事" }]}
      pageKind={PAGE_KIND_BY_PREFIX[pathPrefix] ?? "article"}
      sidebar={
        article === null ? undefined : (
          <ArticleTableOfContents sections={article.sections} placement="sidebar" />
        )
      }
    >
      {() =>
        article !== null ? (
          <ArticleView article={article} />
        ) : failure !== null ? (
          <ReadFailureBody error={failure} what="記事" siteSlug={siteSlug} />
        ) : (
          <ReadFailureBody error={{ code: "NOT_FOUND" }} what="記事" siteSlug={siteSlug} />
        )
      }
    </SiteFrame>
  );
}
