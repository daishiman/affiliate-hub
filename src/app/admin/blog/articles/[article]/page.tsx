import { AdminShell } from "@/presentation/admin/admin-shell";
import { BlogArticleEditForm } from "@/presentation/admin/blog-article-form";
import { blogOpsEntry, currentActor } from "@/presentation/composition";
import { ErrorView, FactList, Note, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 記事 1 本の編集。
 *
 * 版面が要求する部品のうち足りないものを、画面の一番上に出す。
 * 「保存できません」で止めるのではなく、**何が足りないかを常に見せて**
 * 下書きのまま保存させる。書きかけを保存できない画面は、
 * 別の場所（下書きファイル）に本文が溜まり、そちらが正になる。
 */
export default async function BlogArticleEditPage({
  params,
}: {
  readonly params: Promise<{ readonly article: string }>;
}) {
  const { article } = await params;
  const entry = await blogOpsEntry();

  if (!entry.ready) {
    return (
      <AdminShell
        routeId="blog/articles/[article]"
        routeParams={{ article }}
        breadcrumbLabels={{ "blog/articles/[article]": "記事 1 本" }}
        title="記事を直す"
        lead="記事の中身を直し、公開まで進めます。"
      >
        <ErrorView
          title="いまは編集できません"
          body={entry.reason}
          suggestedAction="保存先を用意した実行環境で開いてください。"
          action={<TextLink href="/admin/blog/articles">記事の一覧へ</TextLink>}
        />
      </AdminShell>
    );
  }

  const actor = await currentActor();
  const found = await entry.getArticle.execute(actor, { articleId: article });

  if (!found.ok) {
    return (
      <AdminShell
        routeId="blog/articles/[article]"
        routeParams={{ article }}
        breadcrumbLabels={{ "blog/articles/[article]": "記事 1 本" }}
        title="記事を直す"
        lead="記事の中身を直し、公開まで進めます。"
      >
        <ErrorView
          title="この記事を読めませんでした"
          body={found.error.message}
          suggestedAction={found.error.suggestedAction ?? null}
          action={<TextLink href="/admin/blog/articles">記事の一覧へ</TextLink>}
        />
      </AdminShell>
    );
  }

  const view = found.value;
  const tags = await entry.listTags.execute(actor, { siteSlug: view.siteSlug });

  return (
    <AdminShell
      routeId="blog/articles/[article]"
      routeParams={{ article }}
      breadcrumbLabels={{ "blog/articles/[article]": view.title }}
      title={view.title}
      lead="記事の中身を直し、公開まで進めます。"
      actions={<TextLink href="/admin/blog/articles">記事の一覧へ</TextLink>}
    >
      <Section title="この記事">
        <FactList
          rows={[
            { key: "site", label: "置き場所", value: view.siteSlug },
            { key: "slug", label: "住所", value: `/${view.slug}` },
            { key: "template", label: "版面", value: view.templateLabel },
          ]}
        />
        <Note>{view.titleRule}</Note>
      </Section>

      <Section title="中身">
        <BlogArticleEditForm
          articleId={view.articleId}
          title={view.title}
          lead={view.lead}
          template={view.template}
          status={view.status}
          authorName={view.authorName}
          blocks={view.blocks.map((block) => ({
            id: block.id,
            kind: block.kind,
            heading: block.heading,
            body: block.body,
          }))}
          tagOptions={
            tags.ok
              ? tags.value.tags.map((tag) => ({ value: tag.tagId, label: tag.name }))
              : []
          }
          selectedTagIds={view.tagIds}
          missing={view.missing}
        />
      </Section>
    </AdminShell>
  );
}
