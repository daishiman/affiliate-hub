import { PUBLIC_ARTICLE_PAGE_SIZE } from "@/application/read-models/article-discovery";
import { type PublishedArticle, articleHref } from "@/application/read-models/published-article";
import { canonicalSiteUrl } from "@/application/seo/feeds";
import { entrySitemapEntries } from "@/application/seo/sitemap";
import {
  SITE_DOCUMENT_KEYS,
  findRoute,
  routesFor,
  type SiteBlueprint,
  type SiteDocumentKey,
} from "@/domain/authoring";
import { pageKeyOf, type PageKey } from "@/domain/seo/aeo-measurement";

/** 1世代を有限に保つ。超過時は一部を「全体監査」として公開しない。 */
export const STATIC_AUDIT_INVENTORY_LIMIT = 1_000;

export type StaticAuditInventoryTarget = {
  readonly pageKey: PageKey;
  readonly url: string;
  readonly articleSlug: string | null;
  readonly updatedAt: string | null;
};

export type StaticAuditInventory = {
  readonly siteSlug: string;
  readonly targets: readonly StaticAuditInventoryTarget[];
  /** complete=trueなら確定総数、falseなら検出できた下限。 */
  readonly total: number;
  readonly complete: boolean;
  readonly emitLlmsTxt: boolean;
};

type InventorySite = Pick<SiteBlueprint, "pages" | "emitLlmsTxt"> & {
  readonly categories: readonly Pick<SiteBlueprint["categories"][number], "slug">[];
};

/**
 * 公開HTMLのcanonical集合を作る唯一の口。
 *
 * sitemapと同じ静的入口・記事URLを使い、sitemapが意図的に持たない
 * category/author/expertと実在paginationだけを公開projectionから補う。
 */
export function publicPageInventory(input: {
  readonly siteSlug: string;
  readonly origin: string;
  readonly basePath: string;
  readonly site: InventorySite;
  readonly articles: readonly PublishedArticle[];
  /** 下書きや削除済みを除いた、実際に読者へ返す固定文書だけ。 */
  readonly publishedDocuments: readonly {
    readonly key: SiteDocumentKey;
    readonly updatedAt: string;
  }[];
  readonly limit?: number;
}): StaticAuditInventory {
  const limit = Math.max(0, Math.floor(input.limit ?? STATIC_AUDIT_INVENTORY_LIMIT));
  const articles = input.articles.filter((article) => article.siteSlug === input.siteSlug);
  const feedItems = articles.map((article) => ({
    path: articleHref(article),
    title: article.title,
    summary: article.summary,
    updatedAt: article.updatedAt,
  }));
  const publishedDocuments = new Map(input.publishedDocuments.map((document) => [document.key, document.updatedAt]));
  const siteDocumentKeys = new Set<string>(SITE_DOCUMENT_KEYS);
  const routes = [
    ...routesFor(input.site).filter((route) => !siteDocumentKeys.has(route.key)),
    ...[...publishedDocuments.keys()].flatMap((key) => {
      const route = findRoute(key);
      return route === null ? [] : [route];
    }),
  ];
  const enabled = new Set(routes.map((route) => route.key));
  const paths = new Map<string, { articleSlug: string | null; updatedAt: string | null }>();
  const add = (path: string, articleSlug: string | null, updatedAt: string | null) => {
    const current = paths.get(path);
    if (current === undefined || (current.articleSlug === null && articleSlug !== null)) {
      paths.set(path, { articleSlug, updatedAt });
    }
  };

  const documentUpdatedAtByPath = new Map(routes.flatMap((route) => {
    const updatedAt = publishedDocuments.get(route.key as SiteDocumentKey);
    return updatedAt === undefined ? [] : [[route.path, updatedAt] as const];
  }));
  for (const entry of entrySitemapEntries(routes, feedItems)) {
    add(entry.path, null, documentUpdatedAtByPath.get(entry.path) ?? entry.updatedAt);
  }
  for (const article of articles) {
    add(articleHref(article), article.slug, article.updatedAt);
  }

  if (enabled.has("category")) {
    const latestByCategory = new Map(
      groupLatest(articles, (article) => article.categorySlug)
        .map((group) => [group.key, group.updatedAt] as const),
    );
    for (const category of input.site.categories) {
      add(`/categories/${category.slug}`, null, latestByCategory.get(category.slug) ?? null);
    }
    // 旧記事の分類が設計図から外れていても、その公開記事から到達できるURLは監査する。
    for (const [categorySlug, updatedAt] of latestByCategory) {
      add(`/categories/${categorySlug}`, null, updatedAt);
    }
  }
  if (enabled.has("author")) {
    for (const group of groupLatest(articles, (article) => article.author.slug)) {
      add(`/authors/${group.key}`, null, group.updatedAt);
    }
  }
  if (enabled.has("expert")) {
    for (const group of groupLatest(
      articles.filter((article) => article.reviewedBy !== undefined),
      (article) => article.reviewedBy?.slug ?? "",
    )) {
      if (group.key !== "") add(`/experts/${group.key}`, null, group.updatedAt);
    }
  }

  // 公開一覧の後続ページは独立したcanonicalと内容を持つ。
  addPagination(paths, "/blog", articles);
  for (const route of routes) {
    if (!route.key.endsWith("-index")) continue;
    const articleType = route.key.replace(/-index$/, "");
    addPagination(paths, route.path, articles.filter((article) => article.type === articleType));
  }

  const all = [...paths.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([path, identity]) => {
      const url = canonicalSiteUrl({ origin: input.origin, basePath: input.basePath }, path);
      const key = pageKeyOf(url);
      return key.ok ? [{ pageKey: key.key, url, ...identity }] : [];
    });

  return {
    siteSlug: input.siteSlug,
    targets: all.slice(0, limit),
    total: all.length,
    complete: all.length <= limit,
    emitLlmsTxt: input.site.emitLlmsTxt,
  };
}

function addPagination(
  paths: Map<string, { articleSlug: string | null; updatedAt: string | null }>,
  path: string,
  articles: readonly PublishedArticle[],
): void {
  const pages = Math.ceil(articles.length / PUBLIC_ARTICLE_PAGE_SIZE);
  const updatedAt = latest(articles.map((article) => article.updatedAt));
  for (let page = 2; page <= pages; page += 1) {
    paths.set(`${path}?page=${page}`, { articleSlug: null, updatedAt });
  }
}

function groupLatest(
  articles: readonly PublishedArticle[],
  keyOf: (article: PublishedArticle) => string,
): readonly { key: string; updatedAt: string | null }[] {
  const groups = new Map<string, string[]>();
  for (const article of articles) {
    const key = keyOf(article);
    groups.set(key, [...(groups.get(key) ?? []), article.updatedAt]);
  }
  return [...groups].map(([key, dates]) => ({ key, updatedAt: latest(dates) }));
}

function latest(values: readonly string[]): string | null {
  return values.reduce<string | null>(
    (result, value) => result === null || value > result ? value : result,
    null,
  );
}
