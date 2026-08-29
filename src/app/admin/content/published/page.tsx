import Form from "next/form";
import Link from "next/link";
import { articleHref } from "@/application/read-models/published-article";
import { siteBasePathBySlug } from "@/domain/authoring";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, publishedArticleAdminUseCases } from "@/presentation/composition";
import { Card, EmptyView, ErrorView } from "@/presentation/ui";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

export default async function PublishedArticlesPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string | string[]; readonly visibility?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? "";
  const rawVisibility = Array.isArray(params.visibility) ? params.visibility[0] : params.visibility;
  const visibility = rawVisibility === "public" || rawVisibility === "archived" ? rawVisibility : "all";
  const result = await (await publishedArticleAdminUseCases()).list.execute(await currentActor(), {
    query,
    visibility,
  });

  return (
    <AdminShell
      routeId="content/published"
      title="公開済み記事"
      lead="読者に出ている記事を探し、訂正または非表示化します。"
      actions={<Link href="/admin/content/new">新しい記事を作る</Link>}
    >
      <Card>
          <Form action="/admin/content/published" className={styles.publishedFilter}>
            <label htmlFor="published-query"><span>記事を検索</span><input id="published-query" type="search" name="q" defaultValue={query} placeholder="タイトル・結論・サイト名" /></label>
            <label htmlFor="published-visibility"><span>公開状態</span><select id="published-visibility" name="visibility" defaultValue={visibility}>
                <option value="all">すべて</option>
                <option value="public">公開中</option>
                <option value="archived">非表示</option>
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
            <div className={styles.publishedTableHost}>
              <table className={styles.publishedTable}>
                <thead><tr><th>記事</th><th>サイト</th><th>状態</th><th>更新日</th><th>操作</th></tr></thead>
                <tbody>
                  {result.value.map(({ article, archivedAt }) => (
                    <tr key={`${article.siteSlug}/${article.slug}`}>
                      <td data-label="記事"><strong>{article.title}</strong><span>{article.summary}</span></td>
                      <td data-label="サイト">{article.siteSlug}</td>
                      <td data-label="状態"><span className={styles.publishedStatus}>{archivedAt === null ? "公開中" : "非表示"}</span></td>
                      <td data-label="更新日">{article.updatedAt}</td>
                      <td data-label="操作">
                        <Link href={`/admin/content/published/${encodeURIComponent(article.siteSlug)}/${encodeURIComponent(article.slug)}/edit`}>編集</Link>
                        {archivedAt === null && <Link href={`${siteBasePathBySlug(article.siteSlug)}${articleHref(article)}`} target="_blank">公開画面</Link>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
    </AdminShell>
  );
}
