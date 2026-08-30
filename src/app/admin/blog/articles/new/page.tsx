import { AdminShell } from "@/presentation/admin/admin-shell";
import { BlogArticleCreateForm } from "@/presentation/admin/blog-article-form";
import { blogSiteOptions } from "@/presentation/admin/blog-site-options";
import { EmptyView, Prose, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 記事を 1 本作る。
 *
 * ここで作られるのは常に**下書き**である。作った直後に公開できる道を
 * 用意していないのは、版面が要求する部品がまだ 1 つも無いため。
 * 「作る」と「公開する」を同じ操作にすると、空の記事が読者に出る。
 */
export default async function BlogArticleNewPage() {
  const sites = await blogSiteOptions();

  return (
    <AdminShell
      routeId="blog/articles/new"
      title="記事を 1 本作る"
      lead="版面と住所を決めて、下書きを置きます。"
      actions={<TextLink href="/admin/blog/articles">記事の一覧へ</TextLink>}
    >
      {sites.options.length === 0 ? (
        <Section title="ブログ">
          <EmptyView
            title="置き先のブログがありません"
            body={sites.emptyReason ?? "先にブログのつながりを 1 本作ってください。"}
            action={<TextLink href="/admin/site-network/new">つながりに 1 本足す</TextLink>}
          />
        </Section>
      ) : (
        <Section title="新しい記事">
          <Prose>
            版面を選ぶと、その記事が要求する部品の種類が決まります。部品は作ったあとに足します。
          </Prose>
          <BlogArticleCreateForm siteOptions={sites.options} />
        </Section>
      )}
    </AdminShell>
  );
}
