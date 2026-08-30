import Link from "next/link";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { PublishedArticleForm } from "@/presentation/admin/publish/published-article-form";
import { currentActor, publishedArticleAdminUseCases } from "@/presentation/composition";
import { Card, EmptyView, ErrorView, FactList } from "@/presentation/ui";
import styles from "../../../../../admin.module.css";

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
  return (
    <AdminShell
      routeId="content/published/[site]/[slug]/edit"
      routeParams={{ site, slug }}
      title={result.ok ? (result.value?.article.title ?? "公開済み記事") : "公開済み記事"}
      lead="読者に出ている文章を訂正し、変更理由を記録に残します。"
      actions={<Link href="/admin/content/published">一覧へ戻る</Link>}
    >
        {!result.ok ? (
          <ErrorView title="公開済み記事を開けませんでした" body={result.error.message} suggestedAction={result.error.suggestedAction ?? null} />
        ) : result.value !== null ? (
          <div className={styles.publishedEditor}>
            <Card>
              {/*
                項目と値の並びは `FactList` が 1 か所で持つ。ここで `dl` を
                書き起こすと、読み上げの対の作り方が 2 通りになる
                （`tests/ui/uiux-duplicate-implementation.test.ts`）。
              */}
              <FactList
                rows={[
                  { key: "site", label: "サイト", value: result.value.article.siteSlug },
                  { key: "slug", label: "URL", value: result.value.article.slug },
                  {
                    key: "status",
                    label: "状態",
                    value: result.value.archivedAt === null ? "公開中" : "非表示",
                  },
                ]}
              />
            </Card>
            <Card><PublishedArticleForm article={result.value.article} archivedAt={result.value.archivedAt} /></Card>
          </div>
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
