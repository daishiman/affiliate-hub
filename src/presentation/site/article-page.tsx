import { readerActor, siteUseCases } from "@/presentation/composition";
import { ArticleView } from "@/presentation/ui";
import { NotFoundBody, SiteFrame } from "./page-frame";
import { siteHref, toArticleView } from "./view-model";

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
  const result = await siteUseCases().getArticle.execute(readerActor(), { siteSlug, slug });
  const path = `${pathPrefix}/${slug}`;

  return (
    <SiteFrame
      siteSlug={siteSlug}
      currentPath={siteHref(siteSlug, path)}
      trail={[{ label: routeLabel }, { label: result.ok ? result.value.title : "記事" }]}
    >
      {() =>
        result.ok ? (
          <ArticleView article={toArticleView(siteSlug, result.value)} />
        ) : (
          <NotFoundBody what="記事" siteSlug={siteSlug} />
        )
      }
    </SiteFrame>
  );
}
