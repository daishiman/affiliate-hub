import Link from "next/link";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { PublishedArticleForm } from "@/presentation/admin/published-article-form";
import { currentActor, publishedArticleAdminUseCases } from "@/presentation/composition";
import { Card, EmptyView, ErrorView, FactList, Section, Stack } from "@/presentation/ui";

export const dynamic = "force-dynamic";

export default async function EditPublishedArticlePage({
  params,
}: {
  readonly params: Promise<{ readonly site: string; readonly slug: string }>;
}) {
  const { site, slug } = await params;
  const result = await (await publishedArticleAdminUseCases()).get.execute(await currentActor(), {
    siteSlug: site,
    slug,
  });
  const title = result.ok ? result.value?.article.title ?? "公開済み記事" : "公開済み記事";
  return (
    <AdminShell
      routeId="content/published/[site]/[slug]/edit"
      routeParams={{ site, slug }}
      title={title}
      lead="読者に出ている文章を訂正し、変更理由を操作記録に残します。"
      actions={<Link href="/admin/content/published">一覧へ戻る</Link>}
    >
      {!result.ok ? (
          <ErrorView title="公開済み記事を開けませんでした" body={result.error.message} suggestedAction={result.error.suggestedAction ?? null} />
        ) : result.value !== null ? (
          <Stack>
            <Card
              claim="読者に出ている記事の現在状態"
              main={
                <FactList
                  rows={[
                    { key: "site", label: "サイト", value: result.value.article.siteSlug },
                    { key: "url", label: "URL", value: result.value.article.slug },
                    {
                      key: "status",
                      label: "状態",
                      value: result.value.archivedAt === null ? "公開中" : "非表示",
                    },
                  ]}
                />
              }
            />
            <Section
              title="訂正内容と変更理由"
              lead="変更する内容と理由を確認してから保存します。"
            >
              <PublishedArticleForm
                article={result.value.article}
                archivedAt={result.value.archivedAt}
              />
            </Section>
          </Stack>
        ) : (
          <EmptyView
            title="この公開済み記事は見つかりません"
            body="URLが古いか、別のサイトの記事を開いている可能性があります。公開済み記事の一覧から、編集する記事を選び直してください。"
            action={<Link href="/admin/content/published">公開済み記事一覧へ戻る</Link>}
          />
      )}
    </AdminShell>
  );
}
