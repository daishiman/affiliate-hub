import {
  type ArticleSummary,
  type PublishedArticle,
  articleHref,
  outboundHref,
} from "@/application/read-models/published-article";
import type { PublicSiteBlueprint } from "@/application/usecases/site/read-site";
import {
  type ArticleType,
  type SiteRoute,
  buildPath,
  footerRoutes,
  routesFor,
  siteBasePathBySlug,
} from "@/domain/authoring";
import type {
  ArticleCardView,
  ArticleViewModel,
  CorrectionView,
  SiteChrome,
} from "@/presentation/ui";

/**
 * 保存されている形 → 画面に出す形 の変換。
 *
 * **ここ 1 箇所でしか変換しない。** 画面ごとに書くと、
 * 一覧の URL と記事内リンクの URL が食い違う、といった事故が起きる。
 *
 * 共通UI (`src/presentation/ui`) はこのファイルを知らない。
 * UI は「渡された形を出すだけ」に保つ（要求 E-2）。
 */

/**
 * ブログの入口パス。
 *
 * 接頭辞そのものは domain（`siteBasePathBySlug`）が持つ。
 * ここで `"/s"` を書き直すと、独自ドメインの判断を持っている domain 側と割れる。
 */
export { siteBasePathBySlug as siteBasePath } from "@/domain/authoring";

export function siteHref(siteSlug: string, path: string): string {
  return path === "/"
    ? siteBasePathBySlug(siteSlug)
    : `${siteBasePathBySlug(siteSlug)}${path}`;
}

/**
 * ルート表の 1 行から実際の URL を作る。
 *
 * 中身は `siteHref` と同じにする。以前は同じ式を 2 回書いていて、
 * 片方だけ直すと一覧の URL と記事内リンクが食い違う状態だった。
 */
export function siteRouteHref(
  siteSlug: string,
  route: SiteRoute,
  params: Readonly<Record<string, string>> = {},
): string {
  return siteHref(siteSlug, buildPath(route, params));
}

/**
 * ヘッダーと足元の案内。
 *
 * 中身はすべて設計図とルート表から作る。ブログごとに書き並べない。
 * 書き並べると、ブログを 1 本増やすたびに案内を作り直すことになる。
 */
export function toChrome(siteSlug: string, blueprint: PublicSiteBlueprint): SiteChrome {
  const routes = routesFor(blueprint);
  const home = routes.find((r) => r.key === "home");
  const search = routes.find((r) => r.key === "search");
  const editorialPolicy = routes.find((r) => r.key === "editorial-policy");

  const categoryNav = blueprint.categories.map((c) => ({
    href: siteHref(siteSlug, `/categories/${c.slug}`),
    label: c.name,
  }));

  const nav = [
    ...(home === undefined ? [] : [{ href: siteRouteHref(siteSlug, home), label: "トップ" }]),
    ...categoryNav,
    ...(search === undefined ? [] : [{ href: siteRouteHref(siteSlug, search), label: search.label }]),
  ];

  return {
    siteName: blueprint.name,
    tagline: blueprint.purpose,
    brandTheme: blueprint.theme.brandTheme,
    nav,
    categoryNav,
    homeHref: home === undefined ? siteBasePathBySlug(siteSlug) : siteRouteHref(siteSlug, home),
    searchHref:
      search === undefined ? `${siteBasePathBySlug(siteSlug)}/search` : siteRouteHref(siteSlug, search),
    aboutHref:
      editorialPolicy === undefined
        ? siteBasePathBySlug(siteSlug)
        : siteRouteHref(siteSlug, editorialPolicy),
    footer: footerRoutes(blueprint).map((r) => ({
      href: siteRouteHref(siteSlug, r),
      label: r.label,
    })),
  };
}

export function toArticleCard(siteSlug: string, summary: ArticleSummary): ArticleCardView {
  return {
    slug: summary.slug,
    href: siteHref(siteSlug, articleHref(summary)),
    title: summary.title,
    summary: summary.summary,
    updatedAt: summary.updatedAt,
    authorName: summary.authorName,
  };
}

export function toArticleCards(
  siteSlug: string,
  summaries: readonly ArticleSummary[],
): readonly ArticleCardView[] {
  return summaries.map((s) => toArticleCard(siteSlug, s));
}

/** 記事 1 本。順位表の商品名は、レビューがある商品だけリンクにする。 */
export function toArticleView(siteSlug: string, article: PublishedArticle): ArticleViewModel {
  return {
    title: article.title,
    summary: article.summary,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    authorName: article.author.name,
    authorHref: siteHref(siteSlug, `/authors/${article.author.slug}`),
    authorBio: article.author.bio,
    authorCredentials: article.author.credentials,
    expertName: article.reviewedBy?.name,
    expertHref:
      article.reviewedBy === undefined
        ? undefined
        : siteHref(siteSlug, `/experts/${article.reviewedBy.slug}`),
    disclosureRequired: article.disclosureRequired,
    methodologyHref: siteHref(siteSlug, "/methodology"),
    policyHref: siteHref(siteSlug, "/advertising-policy"),
    sections: article.sections.map((s) => ({
      id: s.id,
      heading: s.heading,
      paragraphs: s.paragraphs,
      claims: s.claims?.map((c) => ({
        id: c.id,
        statement: c.statement,
        kind: c.kind,
        evidence: c.evidence.map((e) => ({
          id: e.id,
          sourceLabel: e.sourceLabel,
          url: e.url,
          checkedAt: e.checkedAt,
          expired: e.expired,
        })),
      })),
    })),
    conversation: article.conversation,
    productCards: article.productCards?.map((card) => ({
      name: card.name,
      brand: card.brand,
      oneLine: card.oneLine,
      specs: card.specs.map((spec) => ({
        label: spec.label,
        value: spec.value,
        basis: spec.kind,
      })),
      priceNote: card.priceNote,
      affiliateHref: outboundHref(card.trackingCode, card.affiliateUrl),
      // 買う導線が無いときは、理由を必ず添える。
      // 理由が無いと、読者には「リンクの貼り忘れ」と区別が付かない。
      blockedReason:
        card.affiliateUrl === undefined && card.trackingCode === undefined
          ? (card.blockedReason ?? "この商品は、いま提携している販売先がありません。")
          : undefined,
      detailHref:
        card.reviewSlug === undefined ? undefined : siteHref(siteSlug, `/reviews/${card.reviewSlug}`),
    })),
    ranking:
      article.ranking === undefined
        ? undefined
        : {
            caption: article.ranking.caption,
            updatedAt: article.ranking.updatedAt,
            criteria: article.ranking.criteria,
            rows: article.ranking.entries.map((e) => ({
              productId: e.productId,
              rank: e.rank,
              productName: e.productName,
              totalScore: e.totalScore,
              criterionScores: e.criterionScores,
              href:
                e.reviewSlug === undefined
                  ? undefined
                  : siteHref(siteSlug, `/reviews/${e.reviewSlug}`),
              affiliateHref: outboundHref(e.trackingCode, e.affiliateUrl),
              note: e.oneLine,
            })),
            excluded: article.ranking.excluded,
          },
    comparison:
      article.comparison === undefined
        ? undefined
        : {
            caption: article.comparison.caption,
            columns: article.comparison.columns,
            rows: article.comparison.rows.map((row) => ({
              id: row.id,
              label: row.label,
              cells: Object.fromEntries(
                Object.entries(row.cells).map(([key, cell]) => [
                  key,
                  { value: cell.value, factuality: cell.kind, checkedAt: cell.checkedAt },
                ]),
              ),
            })),
          },
    stub:
      article.stub === undefined
        ? undefined
        : { ...article.stub, stubId: "persistence:content-sample" },
  };
}

export function toCorrectionViews(
  siteSlug: string,
  corrections: readonly {
    readonly id: string;
    readonly correctedAt: string;
    readonly articleSlug: string;
    readonly articleType: ArticleType;
    readonly articleTitle: string;
    readonly what: string;
    readonly why: string;
  }[],
): readonly CorrectionView[] {
  return corrections.map((c) => ({
    id: c.id,
    correctedAt: c.correctedAt,
    articleTitle: c.articleTitle,
    // 記事の URL の作り方は 1 箇所（articleHref）だけ。ここで組み立て直さない。
    articleHref: siteHref(siteSlug, articleHref({ type: c.articleType, slug: c.articleSlug })),
    what: c.what,
    why: c.why,
  }));
}

/** 現在地に対応するパンくず。ルート表から作るので画面ごとに書かない。 */
export function breadcrumbsFor(
  siteSlug: string,
  blueprint: PublicSiteBlueprint,
  trail: readonly { readonly label: string; readonly path?: string }[],
): readonly { readonly label: string; readonly href?: string }[] {
  return [
    { label: blueprint.name, href: siteBasePathBySlug(siteSlug) },
    ...trail.map((t) => ({
      label: t.label,
      href: t.path === undefined ? undefined : siteHref(siteSlug, t.path),
    })),
  ];
}
