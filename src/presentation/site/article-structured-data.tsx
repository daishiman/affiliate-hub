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
  speakableSelectors,
}: {
  readonly article: PublishedArticle;
  readonly siteName: string;
  readonly origin: string;
  readonly basePath: string;
  readonly speakableSelectors: SpeakableSelectors;
}) {
  const site = { siteName, origin, basePath } satisfies SiteJsonLdInput;

  return (
    <JsonLdScripts
      values={[
        buildBlogPosting(article, site),
        buildBreadcrumbList([
          { name: site.siteName, url: `${site.origin}${site.basePath}` },
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
