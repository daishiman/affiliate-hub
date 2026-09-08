import type { PageRequest, Paged } from "@/application/ports/common";

/**
 * 決定的に並べ済みの一覧を、ID cursorで切る共通部品。
 * cursorが見つからない場合に先頭へ戻すと重複取得になるため、空の終端として扱う。
 */
export function pageById<T>(
  ordered: readonly T[],
  page: PageRequest,
  idOf: (item: T) => string,
): Paged<T> {
  const cursorIndex = page.cursor === null
    ? -1
    : ordered.findIndex((item) => idOf(item) === page.cursor);
  if (page.cursor !== null && cursorIndex < 0) return { items: [], nextCursor: null };

  const start = cursorIndex + 1;
  const items = ordered.slice(start, start + page.limit);
  const hasMore = start + items.length < ordered.length;
  return {
    items,
    nextCursor: hasMore && items.length > 0 ? idOf(items[items.length - 1]!) : null,
  };
}
