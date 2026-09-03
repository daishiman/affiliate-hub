import Form from "next/form";
import type { AffiliatePlacement } from "@/application/ports/blog-affiliate-placement";
import { BLOG_ARTICLE_STATUS_LABEL, type BlogArticleStatus } from "@/domain/blogops";
import { DataTable, Note } from "@/presentation/ui";

export type AffiliatePlacementLookupRow = AffiliatePlacement & {
  readonly articleStatus: BlogArticleStatus | "missing";
};

/** 成果リンクを起点に、掲載先の記事へ戻るための読み取り専用 projection。 */
export function AffiliatePlacementLookup({
  trackingCode,
  placements,
}: {
  readonly trackingCode: string;
  readonly placements: readonly AffiliatePlacementLookupRow[];
}) {
  return (
    <>
      <Form action="">
        <label htmlFor="placement-tracking-code">追跡コード</label>
        <input
          id="placement-tracking-code"
          name="trackingCode"
          defaultValue={trackingCode}
          placeholder="例: offer-1"
        />
        <button type="submit">掲載先を探す</button>
      </Form>
      {placements.length === 0 ? (
        <Note>この条件に一致する掲載はありません。</Note>
      ) : (
        <DataTable
          caption="成果リンクが置かれているブログと記事"
          columns={[
            { key: "site", label: "ブログ" },
            { key: "article", label: "記事" },
            { key: "state", label: "記事の状態" },
            { key: "placement", label: "掲載位置" },
            { key: "code", label: "追跡コード" },
          ]}
          rows={placements.map((placement) => ({
            key: `${placement.siteSlug}:${placement.articleSlug}:${placement.placement}:${placement.trackingCode ?? ""}`,
            cells: [
              placement.siteSlug,
              placement.articleSlug,
              placement.articleStatus === "missing"
                ? "記事が見つかりません"
                : BLOG_ARTICLE_STATUS_LABEL[placement.articleStatus],
              placement.placement,
              placement.trackingCode ?? "コードなし",
            ],
          }))}
        />
      )}
    </>
  );
}
