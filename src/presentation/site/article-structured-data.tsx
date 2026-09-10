import {
  type PublishedArticle,
  articleHref,
} from "@/application/read-models/published-article";
import {
  buildBlogPosting,
  buildBreadcrumbList,
  buildFaqPage,
  buildHowTo,
  buildItemList,
  buildSpeakable,
  type SiteJsonLdInput,
  type SpeakableSelectors,
} from "@/application/seo/structured-data";
import { JsonLdScripts } from "./json-ld-script";

/**
 * 公開記事 1 本に付随する構造化データの Server Component。
 *
 * builder の選択と順序、サイト情報の組み立て、nullable 文書の除外を
 * この境界へ集める。記事画面は「公開記事の構造化データを置く」だけを宣言する。
 */
export function ArticleStructuredData({
  article,
  siteName,
  origin,
  basePath,
  parent,
  speakableSelectors,
}: {
  readonly article: PublishedArticle;
  readonly siteName: string;
  readonly origin: string;
  readonly basePath: string;
  /**
   * パンくずの**中段**（記事一覧）。画面に出ている段をそのまま受け取る。
   *
   * 呼ぶ側が持っている段を渡す形にしてあるのは、ここで記事タイプから
   * 組み直すと、画面側の並べ方を変えた日に**片方だけが古くなる**ため。
   * 中段の無い置き場（あれば）は `undefined` を渡し、二段のまま出す。
   */
  readonly parent?: { readonly name: string; readonly url: string };
  readonly speakableSelectors: SpeakableSelectors;
}) {
  const site = { siteName, origin, basePath } satisfies SiteJsonLdInput;

  return (
    <JsonLdScripts
      values={[
        buildBlogPosting(article, site),
        buildBreadcrumbList([
          { name: site.siteName, url: `${site.origin}${site.basePath}` },
          /*
            画面のパンくずと**同じ段数**を機械にも渡す。
            画面には出ている親を構造化データから落とすと、検索結果と
            AI 検索には「トップの直下に記事がある」構造で伝わり、
            読者が見ている階層と食い違う。
          */
          ...(parent === undefined ? [] : [parent]),
          {
            name: article.title,
            url: `${site.origin}${site.basePath}${articleHref(article)}`,
          },
        ]),
        buildItemList(article, site),
        buildFaqPage(article),
        buildHowTo(article, site),
        buildSpeakable(article, speakableSelectors),
      ]}
    />
  );
}
