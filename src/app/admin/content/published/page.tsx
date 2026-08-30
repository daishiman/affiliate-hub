import Form from "next/form";
import Link from "next/link";
import { articleHref } from "@/application/read-models/published-article";
import { siteBasePathBySlug } from "@/domain/authoring";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, publishedArticleAdminUseCases } from "@/presentation/composition";
import { Card, DataTable, EmptyView, ErrorView } from "@/presentation/ui";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * 絞り込みで選べる公開状態。**読み取りと表示を同じ 1 つの並びから作る。**
 *
 * 選択肢を `<option>` として直に 3 つ並べていたときは、住所から来た値を
 * 別の場所（`rawVisibility === "public" || ...`）で判定していた。**片方だけ
 * 増やせる形**で、増やしたほうが黙って無視される。ここを正本にすると、
 * 足した選択肢は必ず判定の側にも現れる。
 */
const VISIBILITY_FILTERS = [
  { value: "all", label: "すべて" },
  { value: "public", label: "公開中" },
  { value: "archived", label: "非表示" },
] as const;

type VisibilityFilter = (typeof VISIBILITY_FILTERS)[number]["value"];

function toVisibility(raw: string | undefined): VisibilityFilter {
  const found = VISIBILITY_FILTERS.find((option) => option.value === raw);
  return found?.value ?? "all";
}

export default async function PublishedArticlesPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string | string[]; readonly visibility?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? "";
  const visibility = toVisibility(Array.isArray(params.visibility) ? params.visibility[0] : params.visibility);
  const result = await (await publishedArticleAdminUseCases()).list.execute(await currentActor(), {
    query,
    visibility,
  });

  return (
    <AdminShell
      routeId="content/published"
      title="公開済み記事"
      lead="読者に出ている記事を探し、訂正または非表示にします。"
      actions={<Link href="/admin/content/new">新しい記事を作る</Link>}
    >
        <Card>
          <Form action="/admin/content/published" className={styles.publishedFilter}>
            <label htmlFor="published-query"><span>記事を検索</span><input id="published-query" type="search" name="q" defaultValue={query} placeholder="タイトル・結論・サイト名" /></label>
            <label htmlFor="published-visibility"><span>公開状態</span><select id="published-visibility" name="visibility" defaultValue={visibility}>
                {VISIBILITY_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select></label>
            <button type="submit">絞り込む</button>
          </Form>
        </Card>

        {!result.ok ? (
          <ErrorView title="公開済み記事を出せませんでした" body={result.error.message} suggestedAction={result.error.suggestedAction ?? null} />
        ) : result.value.length === 0 ? (
          <Card>
            <EmptyView title="条件に合う公開済み記事がありません" body="検索条件を変えるか、承認済み原稿から新しい記事を公開してください。" action={<Link href="/admin/content/new">記事の作り方を見る</Link>} />
          </Card>
        ) : (
          <Card>
            {/*
              **生の `<table>` を書かない。**表の作法（見出しが列か行かを名乗る・
              横スクロールを表の器へ閉じ込める・読み上げが最初に読む説明を持つ）は
              `DataTable` が 1 か所で持っている。ここで書き直すと、
              作法の直しが片方にだけ入る日が来る（`tests/ui/table-through-component.test.ts`）。
            */}
            <DataTable
              caption="読者に出ている記事の一覧"
              columns={[
                { key: "article", label: "記事" },
                { key: "site", label: "サイト" },
                { key: "status", label: "状態" },
                { key: "updatedAt", label: "更新日" },
                { key: "actions", label: "操作" },
              ]}
              rows={result.value.map(({ article, archivedAt }) => ({
                key: `${article.siteSlug}/${article.slug}`,
                cells: [
                  <>
                    <strong>{article.title}</strong>
                    <span>{article.summary}</span>
                  </>,
                  article.siteSlug,
                  <span key="visibility" className={styles.publishedStatus}>
                    {archivedAt === null ? "公開中" : "非表示"}
                  </span>,
                  article.updatedAt,
                  <>
                    <Link
                      href={`/admin/content/published/${encodeURIComponent(article.siteSlug)}/${encodeURIComponent(article.slug)}/edit`}
                    >
                      編集
                    </Link>
                    {archivedAt === null && (
                      <Link
                        href={`${siteBasePathBySlug(article.siteSlug)}${articleHref(article)}`}
                        target="_blank"
                      >
                        公開画面
                      </Link>
                    )}
                  </>,
                ],
              }))}
            />
          </Card>
        )}
    </AdminShell>
  );
}
