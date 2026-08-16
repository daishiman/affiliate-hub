import {
  type ArticleSummary,
  type PublishedArticle,
  articleHref,
} from "@/application/read-models/published-article";
import { type SiteBlueprint, type SiteRoute, buildPath, footerRoutes, routesFor } from "@/domain/authoring";
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
 * 本番では 1 ブログ = 1 ドメインなので、この接頭辞は空になる。
 * たたき台では 1 つの Worker に複数ブログを載せるため、
 * `/s/{ブログ名}` を前に付ける。**接頭辞の付け方はここだけで決める。**
 */
export const SITE_BASE = "/s";

export function siteBasePath(siteSlug: string): string {
  return `${SITE_BASE}/${siteSlug}`;
}

/** ルート表の 1 行から実際の URL を作る。 */
export function siteRouteHref(
  siteSlug: string,
  route: SiteRoute,
  params: Readonly<Record<string, string>> = {},
): string {
  const path = buildPath(route, params);
  return path === "/" ? siteBasePath(siteSlug) : `${siteBasePath(siteSlug)}${path}`;
}

export function siteHref(siteSlug: string, path: string): string {
  return path === "/" ? siteBasePath(siteSlug) : `${siteBasePath(siteSlug)}${path}`;
}

/**
 * ヘッダーと足元の案内。
 *
 * 中身はすべて設計図とルート表から作る。ブログごとに書き並べない。
 * 書き並べると、ブログを 1 本増やすたびに案内を作り直すことになる。
 */
export function toChrome(siteSlug: string, blueprint: SiteBlueprint): SiteChrome {
  const routes = routesFor(blueprint);
  const home = routes.find((r) => r.key === "home");
  const search = routes.find((r) => r.key === "search");

  const nav = [
    ...(home === undefined ? [] : [{ href: siteRouteHref(siteSlug, home), label: "トップ" }]),
    ...blueprint.categories.map((c) => ({
      href: siteHref(siteSlug, `/categories/${c.slug}`),
      label: c.name,
    })),
    ...(search === undefined ? [] : [{ href: siteRouteHref(siteSlug, search), label: search.label }]),
  ];

  return {
    siteName: blueprint.name,
    tagline: blueprint.purpose,
    brandTheme: blueprint.theme.brandTheme,
    nav,
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

/**
 * 記事 1 本。
 *
 * `productReviewSlug` は順位表の商品名から個別レビューへ落とすための対応。
 * 対応が無い商品はリンクにしない（存在しないページへ送らない）。
 */
export function toArticleView(
  siteSlug: string,
  article: PublishedArticle,
  productReviewSlug: (productId: string) => string | undefined = () => undefined,
): ArticleViewModel {
  return {
    title: article.title,
    summary: article.summary,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    authorName: article.author.name,
    authorHref: siteHref(siteSlug, `/authors/${article.author.slug}`),
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
    ranking:
      article.ranking === undefined
        ? undefined
        : {
            caption: article.ranking.caption,
            updatedAt: article.ranking.updatedAt,
            criteria: article.ranking.criteria,
            rows: article.ranking.entries.map((e) => {
              const reviewSlug = productReviewSlug(e.productId);
              return {
                productId: e.productId,
                rank: e.rank,
                productName: e.productName,
                totalScore: e.totalScore,
                criterionScores: e.criterionScores,
                href:
                  reviewSlug === undefined
                    ? undefined
                    : siteHref(siteSlug, `/reviews/${reviewSlug}`),
                note: e.oneLine,
              };
            }),
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
    readonly articleTitle: string;
    readonly what: string;
    readonly why: string;
  }[],
  hrefOf: (articleSlug: string) => string,
): readonly CorrectionView[] {
  return corrections.map((c) => ({
    id: c.id,
    correctedAt: c.correctedAt,
    articleTitle: c.articleTitle,
    articleHref: hrefOf(c.articleSlug),
    what: c.what,
    why: c.why,
  }));
}

/** 現在地に対応するパンくず。ルート表から作るので画面ごとに書かない。 */
export function breadcrumbsFor(
  siteSlug: string,
  blueprint: SiteBlueprint,
  trail: readonly { readonly label: string; readonly path?: string }[],
): readonly { readonly label: string; readonly href?: string }[] {
  return [
    { label: blueprint.name, href: siteBasePath(siteSlug) },
    ...trail.map((t) => ({
      label: t.label,
      href: t.path === undefined ? undefined : siteHref(siteSlug, t.path),
    })),
  ];
}
