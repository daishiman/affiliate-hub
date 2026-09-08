import { SiteSearch } from "@/presentation/ui";

/** ホーム・ヘッダーと同じGET検索。検索結果からの再検索はタグ条件を維持する。 */
export function SearchBox({
  action,
  initialQuery = "",
  tag,
}: {
  readonly action: string;
  readonly initialQuery?: string;
  readonly tag?: string;
}) {
  return (
    <SiteSearch
      action={action}
      initialQuery={initialQuery}
      tag={tag}
      inputId="site-result-search"
      landmarkLabel="記事を探す"
      toolName="searchArticles"
    />
  );
}
