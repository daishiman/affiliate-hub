import type { ArticleType } from "@/domain/authoring";
import type { ArticleSummary, PublishedArticle } from "./published-article";
import { searchableTextOf } from "./searchable-text";

/** 公開記事一覧の1ページ件数。画面と監査対象のpaginationで共有する。 */
export const PUBLIC_ARTICLE_PAGE_SIZE = 30;

/** 一覧・検索とも公開済み記事の同じ境界で絞り、保存先で1ページだけ読む。 */
export type ArticleBrowseRequest = {
  readonly query?: string;
  readonly tag?: string;
  readonly type?: ArticleType;
  readonly limit: number;
  readonly offset: number;
};

export type ArticleSearchHit = ArticleSummary & { readonly snippet?: string };
export type ArticleBrowsePage = {
  readonly articles: readonly ArticleSearchHit[];
  readonly hasMore: boolean;
};

/** HTMLを生成せず、公開記事の読める本文から一致箇所の周辺を返す。 */
export function articleSearchSnippet(article: PublishedArticle, query: string): string {
  const text = `${article.summary} ${searchableTextOf(article)}`.replace(/\s+/g, " ");
  const match = text.toLowerCase().indexOf(query.toLowerCase());
  const start = Math.max(0, match - 45);
  const end = Math.min(text.length, start + Math.max(160, query.length + 90));
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
