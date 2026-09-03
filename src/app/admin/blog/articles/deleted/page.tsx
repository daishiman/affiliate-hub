import { AdminShell } from "@/presentation/admin/admin-shell";
import { BlogArticleRestoreForm } from "@/presentation/admin/publish/blog-article-form";
import { blogOpsEntry, currentActor } from "@/presentation/composition";
import { DataTable, EmptyView, ErrorView, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

export default async function DeletedBlogArticlesPage() {
  const entry = await blogOpsEntry();
  if (!entry.ready) {
    return (
      <AdminShell
        routeId="blog/articles/deleted"
        title="削除済みの記事"
        lead="通常一覧から外した記事を、元の住所へ戻します。"
      >
        <ErrorView title="削除済み一覧を出せません" body={entry.reason} />
      </AdminShell>
    );
  }

  const actor = await currentActor();
  const list = await entry.listDeletedArticles.execute(actor, { siteSlug: null });
  return (
    <AdminShell
      routeId="blog/articles/deleted"
      title="削除済みの記事"
      lead="元のブログと URL の空きを再確認してから、本文・タグ・評価ごと戻します。"
      actions={<TextLink href="/admin/blog/articles">通常の記事へ戻る</TextLink>}
    >
      {!list.ok ? (
        <ErrorView
          title="削除済み一覧を出せません"
          body={list.error.message}
          suggestedAction={list.error.suggestedAction ?? null}
        />
      ) : list.value.total === 0 ? (
        <Section title="削除済み">
          <EmptyView
            title="削除済みの記事はありません"
            body={list.value.emptyReason ?? "ここへ戻す対象はありません。"}
            action={<TextLink href="/admin/blog/articles">通常の記事へ戻る</TextLink>}
          />
        </Section>
      ) : (
        <Section title="削除済みの記事">
          <DataTable
            caption="削除済みのブログ記事"
            columns={[
              { key: "title", label: "見出し" },
              { key: "site", label: "ブログ" },
              { key: "slug", label: "元の URL 名" },
              { key: "status", label: "削除前の状態" },
              { key: "deleted", label: "削除日時" },
              { key: "restore", label: "操作" },
            ]}
            rows={list.value.rows.map((row) => ({
              key: row.articleId,
              cells: [
                row.title,
                row.siteSlug,
                row.slug,
                row.statusLabel,
                row.deletedAt.slice(0, 10),
                <BlogArticleRestoreForm
                  key="restore"
                  articleId={row.articleId}
                  title={row.title}
                />,
              ],
            }))}
          />
        </Section>
      )}
    </AdminShell>
  );
}
