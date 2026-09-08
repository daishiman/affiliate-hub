import { SeeAlso, TextLink } from "@/presentation/ui";

/** URLの頁は1始まり。表示位置の計算が安全な整数になる範囲だけ受ける。 */
export function articlePageNumber(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page <= Math.floor(Number.MAX_SAFE_INTEGER / 100) ? page : 1;
}

/** 検索条件を保って次へ進む。最初の頁のURLにはpageを付けない。 */
export function articlePageHref(path: string, page: number, filters: { q?: string; tag?: string } = {}): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.tag) params.set("tag", filters.tag);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query === "" ? path : `${path}?${query}`;
}

export function ArticlePagination({ page, hasMore, hrefForPage }: {
  readonly page: number;
  readonly hasMore: boolean;
  readonly hrefForPage: (page: number) => string;
}) {
  if (page === 1 && !hasMore) return null;
  return (
    <nav aria-label="記事一覧のページ">
      <p>{page}ページ目</p>
      <SeeAlso>
        {page > 1 && <TextLink href={hrefForPage(page - 1)}>前のページ</TextLink>}
        {hasMore && <TextLink href={hrefForPage(page + 1)}>次のページ</TextLink>}
        {page > 2 && <TextLink href={hrefForPage(1)}>最初のページ</TextLink>}
      </SeeAlso>
    </nav>
  );
}
