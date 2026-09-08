import { AdminShell } from "@/presentation/admin/admin-shell";
import { ArticleThumbnailForm } from "@/presentation/admin/publish/article-thumbnail-form";
import { BlogArticleEditForm } from "@/presentation/admin/publish/blog-article-form";
import { blogSiteOptions } from "@/presentation/admin/publish/blog-site-options";
import { ExpressionBlockAppendForm } from "@/presentation/admin/publish/expression-block-form";
import { blogOpsEntry, currentActor } from "@/presentation/composition";
import { blogThumbnailHref } from "@/infrastructure/platform/blog-thumbnail-r2";
import { Callout, ErrorView, FactList, Note, Section, TextLink } from "@/presentation/ui";

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
  const [tags, sites, thumbnail] = await Promise.all([
    entry.listTags.execute(actor, { siteSlug: view.siteSlug }),
    blogSiteOptions(),
    entry.getThumbnail.execute(actor, { articleId: view.articleId }),
  ]);
  const categoryOptions =
    sites.options.find((site) => site.value === view.siteSlug)?.categories ?? [];

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

      {/*
        表紙は本文より先に置く。一覧・トップ・SNS の写しに出るのはこの 1 枚で、
        本文を直しても差し替わらない。後ろに置くと、記事を書き終えた人が
        画面を閉じるまでここに辿り着かない。
      */}
      <Section title="表紙の絵">
        {thumbnail.ok ? (
          <ArticleThumbnailForm
            articleId={view.articleId}
            current={
              thumbnail.value === null
                ? null
                : {
                    href: blogThumbnailHref(thumbnail.value.objectKey),
                    altText: thumbnail.value.altText,
                    derivedWidths: thumbnail.value.derivedWidths,
                  }
            }
          />
        ) : (
          /*
            **読めなかったことを空欄で描かない。** 空欄にすると運営者は
            「表紙が無い」と読んで上げ直し、読める状態に戻った瞬間に
            前の絵が置き場へ取り残される。
          */
          <Callout
            tone="warn"
            title="いま付いている表紙を読めませんでした"
            reason={thumbnail.error.message}
          />
        )}
      </Section>

      <Section title="中身">
        <BlogArticleEditForm
          articleId={view.articleId}
          revision={view.revision}
          title={view.title}
          lead={view.lead}
          template={view.template}
          status={view.status}
          authorName={view.authorName}
          categorySlug={view.categorySlug ?? categoryOptions[0]?.value ?? ""}
          categoryOptions={categoryOptions}
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
        />
      </Section>
      <Section title="図解・比較・CTA・要約・スペック表を足す">
        <ExpressionBlockAppendForm articleId={view.articleId} />
      </Section>
    </AdminShell>
  );
}
