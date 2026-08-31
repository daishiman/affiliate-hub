import Form from "next/form";
import Link from "next/link";
import { articleHref } from "@/application/read-models/published-article";
import { siteBasePathBySlug } from "@/domain/authoring";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, publishedArticleAdminUseCases } from "@/presentation/composition";
import { DataTable, EmptyView, ErrorView, Section } from "@/presentation/ui";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

const VISIBILITY_OPTIONS = [
  { value: "all", label: "すべて" },
  { value: "public", label: "公開中" },
  { value: "archived", label: "非表示" },
] as const;

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
      <Section title="記事を絞り込む" lead="タイトル・結論・サイト名と公開状態で、直す記事を探します。">
          <Form action="/admin/content/published" className={styles.publishedFilter}>
            <label htmlFor="published-query"><span>記事を検索</span><input id="published-query" type="search" name="q" defaultValue={query} placeholder="タイトル・結論・サイト名" /></label>
            <label htmlFor="published-visibility"><span>公開状態</span><select id="published-visibility" name="visibility" defaultValue={visibility}>
                {VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select></label>
            <button type="submit">絞り込む</button>
          </Form>
      </Section>

        {!result.ok ? (
          <ErrorView title="公開済み記事を出せませんでした" body={result.error.message} suggestedAction={result.error.suggestedAction ?? null} />
        ) : result.value.length === 0 ? (
          <Section title="記事の一覧">
            <EmptyView title="条件に合う公開済み記事がありません" body="検索条件を変えるか、承認済み原稿から新しい記事を公開してください。" action={<Link href="/admin/content/new">記事の作り方を見る</Link>} />
          </Section>
        ) : (
          <Section title="記事の一覧" lead={`${result.value.length}件。列見出しと記事名は、表を送っても表示位置に残ります。`}>
            <DataTable
              caption="公開済み記事。記事名、サイト、状態、更新日を比べて、編集する記事を選びます。"
              columns={[
                { key: "article", label: "記事" },
                { key: "site", label: "サイト" },
                { key: "status", label: "状態" },
                { key: "updated", label: "更新日" },
                { key: "actions", label: "操作" },
              ]}
              rows={result.value.map(({ article, archivedAt }) => ({
                key: `${article.siteSlug}/${article.slug}`,
                cells: [
                  <span key="article" className={styles.publishedArticleCell}>
                    <strong>{article.title}</strong>
                    <span>{article.summary}</span>
                  </span>,
                  article.siteSlug,
                  <span key="status" className={styles.publishedStatus}>{archivedAt === null ? "公開中" : "非表示"}</span>,
                  article.updatedAt,
                  <span key="actions" className={styles.publishedActions}>
                    <Link href={`/admin/content/published/${encodeURIComponent(article.siteSlug)}/${encodeURIComponent(article.slug)}/edit`}>編集</Link>
                    {archivedAt === null && <Link href={`${siteBasePathBySlug(article.siteSlug)}${articleHref(article)}`} target="_blank" rel="noreferrer noopener">公開画面</Link>}
                  </span>,
                ],
              }))}
            />
          </Section>
        )}
    </AdminShell>
  );
}
