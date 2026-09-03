import {
  type PublishedArticle,
  type PublishedPerson,
  articleHref,
} from "@/application/read-models/published-article";
import { expressionBlocksOf } from "./expression-blocks";
import {
  expressionBlockOfArticleBlock,
  expressionBlockOfArticleBody,
  isExpressionArticleBody,
} from "@/application/adapters/expression-article-block";
import type { BlogArticleBlock } from "@/domain/blogops";

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
  /*
    構造化データも画面と**同じ射影**（`expressionBlocksOf`）から作る。
    ここで `sections[].claims[].evidence` を自前で辿り直すと、
    重複のまとめ方や期限切れの扱いが監査と別々に育ち、
    公開判定と検索エンジンへ渡す集約出典が食い違う。

    画面内の EvidenceList は「どの主張の根拠か」という文脈を持つため、
    同じ出典を主張ごとに残す。記事全体の citation とは別の表示責務である。
  */
  const blocks = expressionBlocksOf(article);
  const answer = blocks.find((b) => b.kind === "answer");
  const sources = blocks.find((b) => b.kind === "sources");
  const keyPoints = blocks.find((b) => b.kind === "key_points");
  const freshness = blocks.find((b) => b.kind === "freshness");
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    ...(answer === undefined ? {} : { description: answer.text }),
    // 日本語の記事だと明示する。多言語の検索・AI 抽出は言語不明の文書を後回しにする。
    inLanguage: "ja",
    articleSection: article.categorySlug,
    datePublished: article.publishedAt,
    ...(freshness === undefined ? {} : { dateModified: freshness.asOf }),
    author: buildPerson(article.author, site),
    /*
      要点を abstract に出す。読者に見えている箇条書きを**そのまま**
      1 件 1 行で連ねるだけで、ここで文を作らない。
      画面に無い要約が検索結果に出るのは構造化データの誤用そのもの。
    */
    ...(keyPoints === undefined ? {} : { abstract: keyPoints.items.join("\n") }),
    /*
      出典を citation に出す。URL のある出典は URL 付きで、
      無い出典（書籍・実測など）は名前だけで出す。
      URL を持たないことを理由に落とすと、出典欄には並んでいるのに
      機械には「出典が無い記事」に見える。
    */
    ...(sources === undefined
      ? {}
      : {
          citation: sources.items.map((item) => ({
            "@type": "CreativeWork",
            name: item.label,
            ...(item.url === undefined ? {} : { url: item.url }),
          })),
        }),
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
export function buildFaqPage(article: PublishedArticle): JsonLdObject | null {
  const faq = expressionBlocksOf(article).find((block) => block.kind === "faq");
  if (faq === undefined) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

/** 運用側の記事 carrier から、読者に見える FAQ と同じ内容を機械向けにも出す。 */
export function buildBlogOpsFaqPage(
  blocks: readonly BlogArticleBlock[],
): JsonLdObject | null {
  const faq = blocks
    .map(expressionBlockOfArticleBlock)
    .find((block) => block?.kind === "faq");
  if (faq === undefined || faq === null || faq.kind !== "faq" || faq.items.length === 0) {
    return null;
  }
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/**
 * ブログ運用で書いた記事 1 本の BlogPosting（受入 A10・A12）。
 *
 * **`buildBlogPosting` と別関数にする。**あちらは編集済みの読み取りモデル
 * (`PublishedArticle`) を取り、要点・出典・監修者・鮮度をそこから引く。
 * こちらが受け取るのは運用側の記事集約 (`BlogArticle` + 部品列) で、
 * 出典も監修者も持たない。1 つの関数に両方を通そうとすると、
 * 引数の半分が常に `undefined` になり、「無い」と「渡し忘れた」が混ざる。
 *
 * 出せない項目は**キーごと省く**。空の著者・空の出典を出すと、
 * 機械には「情報がある記事」に見えて中身が無い、という嘘になる。
 */
export function buildBlogOpsPosting(input: {
  readonly article: {
    readonly slug: string;
    readonly title: string;
    readonly lead: string;
    readonly authorName: string;
    readonly publishedAt: Date | null;
    readonly updatedAt: Date;
  };
  /** 記事本文の部品。まとめの節があれば abstract に写す。 */
  readonly blocks: readonly { readonly kind: string; readonly body: string }[];
  readonly site: SiteJsonLdInput;
}): JsonLdObject {
  const { article, blocks, site } = input;
  const url = `${site.origin}${site.basePath}/blog/${article.slug}`;
  /*
    まとめの節を abstract に出す。**読者に見えている本文をそのまま渡す。**
    ここで要約を作ると、画面に無い文が検索結果と AI の引用に出る。
  */
  const expressionSummary = blocks
    .map((block) => expressionBlockOfArticleBody(block.body))
    .find((block) => block?.kind === "summary");
  const summary = blocks.find(
    (block) =>
      block.kind === "summary-section" && !isExpressionArticleBody(block.body),
  );
  const abstract =
    expressionSummary?.kind === "summary" ? expressionSummary.text : summary?.body;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.lead,
    inLanguage: "ja",
    /*
      公開日は**公開されていれば**出す。下書きのまま日付を出すと、
      まだ無い記事が「その日に公開された」と機械に読まれる。
      更新日は必ず出す（A12 の dateModified）。
    */
    ...(article.publishedAt === null
      ? {}
      : { datePublished: article.publishedAt.toISOString() }),
    dateModified: article.updatedAt.toISOString(),
    /*
      著者は名前だけ。運用側の記事は著者ページを持たないので `url` を出さない。
      出すと、検索エンジンを存在しない住所へ送る。
    */
    author: { "@type": "Person", name: article.authorName },
    ...(abstract === undefined ? {} : { abstract }),
    publisher: { "@type": "Organization", name: site.siteName },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };
}

/**
 * JSON-LD を HTML に埋め込める文字列にする。
 *
 * `<` を `\\u003c` に置き換える。置き換えないと、値の中の
 * `</script>` がタグとして解釈され、記事の本文（利用者が書ける文字列）から
 * スクリプトを差し込める（XSS）。JSON としての意味は変わらない。
 */
export function serializeJsonLd(obj: JsonLdObject): string {
  return JSON.stringify(obj).replaceAll("<", "\\u003c");
}
