import {
  type PublishedArticle,
  type PublishedPerson,
  articleHref,
} from "@/application/read-models/published-article";

/**
 * 構造化データ（JSON-LD）の組み立て（feat-blog-ui-builder）。
 *
 * AI 検索・検索エンジンに「この記事は誰がいつ書いた何か」を機械可読で渡す。
 * すべて純関数。fetch も環境変数も読まない。画面（presentation）は
 * ここで出来上がった文字列を `<script type="application/ld+json">` に置くだけ。
 *
 * 記事の URL は `articleHref` から引く。**ここで組み立て直さない**
 * （組み立て直すと、画面のリンクと構造化データの URL が別々にずれる）。
 */

/** JSON-LD に要るサイト情報の最小形。設計図（blueprint）全体は要求しない。 */
export type SiteJsonLdInput = {
  readonly siteName: string;
  /** 例: https://example.com（末尾スラッシュ無し）。 */
  readonly origin: string;
  /** サイトの土台の道。例: /s/my-site。無ければ空文字。 */
  readonly basePath: string;
};

export type JsonLdObject = Readonly<Record<string, unknown>>;

/**
 * 書き手・監修者の Person。
 *
 * `url` は実在する著者ページ（`/authors/<slug>`）を指す。E-E-A-T の
 * 「誰が言っているか」を機械が辿れる形にするのが目的で、辿れない URL を
 * 出すくらいなら出さない方がよい——が、著者ページは公開ルートとして
 * 常に実在する（`view-model.ts` の `authorHref` と同じ道）ので常に出す。
 * `hasCredential` は資格が 1 つも無いとき**キーごと省く**。空配列の
 * 資格一覧は「資格の無い資格持ち」という嘘の構造になる。
 */
function buildPerson(person: PublishedPerson, site: SiteJsonLdInput): JsonLdObject {
  return {
    "@type": "Person",
    name: person.name,
    description: person.bio,
    url: `${site.origin}${site.basePath}/authors/${person.slug}`,
    ...(person.credentials.length === 0
      ? {}
      : {
          hasCredential: person.credentials.map((credential) => ({
            "@type": "EducationalOccupationalCredential",
            name: credential,
          })),
        }),
  };
}

/** 記事 1 本の BlogPosting。 */
export function buildBlogPosting(
  article: PublishedArticle,
  site: SiteJsonLdInput,
): JsonLdObject {
  const url = `${site.origin}${site.basePath}${articleHref(article)}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.summary,
    // 日本語の記事だと明示する。多言語の検索・AI 抽出は言語不明の文書を後回しにする。
    inLanguage: "ja",
    articleSection: article.categorySlug,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: buildPerson(article.author, site),
    // 監修者が付いている記事だけ contributor を出す。付いていない記事に
    // 空の監修者を出すと「監修されている風」の嘘になる。
    ...(article.reviewedBy === undefined
      ? {}
      : { contributor: buildPerson(article.reviewedBy, site) }),
    publisher: {
      "@type": "Organization",
      name: site.siteName,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };
}

/**
 * 順位記事の ItemList。順位・商品名・（あれば）レビュー記事への URL を出す。
 *
 * ranking が無い記事・順位 0 件なら **null**（順位の無い順位表を出さない）。
 * `reviewSlug` が無い商品は URL を出さない——画面と同じ判断で、
 * 存在しないページへ検索エンジンを送らない。
 */
export function buildItemList(
  article: PublishedArticle,
  site: SiteJsonLdInput,
): JsonLdObject | null {
  const ranking = article.ranking;
  if (ranking === undefined || ranking.entries.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: ranking.caption,
    numberOfItems: ranking.entries.length,
    itemListElement: ranking.entries.map((entry) => ({
      "@type": "ListItem",
      position: entry.rank,
      name: entry.productName,
      ...(entry.reviewSlug === undefined
        ? {}
        : { url: `${site.origin}${site.basePath}/reviews/${entry.reviewSlug}` }),
    })),
  };
}

/** パンくず。trail は上位から順（サイト名 → カテゴリー → 記事）。 */
export function buildBreadcrumbList(
  trail: readonly { readonly name: string; readonly url: string }[],
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.name,
      item: step.url,
    })),
  };
}

/**
 * FAQ。0 件なら **null を返す**。
 *
 * 空の FAQPage を出すと「質問の無い FAQ」という嘘の構造になる。
 * 無いものは出さない（呼び出し側は null をそのまま「出さない」に写す）。
 */
export function buildFaqPage(
  items: readonly { readonly question: string; readonly answer: string }[],
): JsonLdObject | null {
  if (items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

/**
 * JSON-LD を HTML に埋め込める文字列にする。
 *
 * `<` を `<` に置き換える。置き換えないと、値の中の
 * `</script>` がタグとして解釈され、記事の本文（利用者が書ける文字列）から
 * スクリプトを差し込める（XSS）。JSON としての意味は変わらない。
 */
export function serializeJsonLd(obj: JsonLdObject): string {
  return JSON.stringify(obj).replaceAll("<", "\\u003c");
}
