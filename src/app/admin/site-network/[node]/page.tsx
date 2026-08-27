import { AdminShell } from "@/presentation/admin/admin-shell";
import { blogSiteOptions } from "@/presentation/admin/blog-site-options";
import { SiteNetworkForm } from "@/presentation/admin/site-network-form";
import { blogOpsEntry, currentActor } from "@/presentation/composition";
import { ErrorView, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * つながり 1 本を直す / 外す。
 *
 * 保存先が無いときに `notFound()` を投げない。
 * 「404」は**そのブログが無い**という意味になるが、実際にあるのは
 * 「いまは読めない」という状態で、意味が違う。
 * 意味の違う画面を出すと、運用者は消えたと思って作り直してしまう。
 */
export default async function SiteNetworkNodePage({
  params,
}: {
  // Next.js 16 では params は Promise。await せずに読むと undefined になる。
  readonly params: Promise<{ readonly node: string }>;
}) {
  const { node } = await params;
  const entry = await blogOpsEntry();

  if (!entry.ready) {
    return (
      <AdminShell
        routeId="site-network/[node]"
        routeParams={{ node }}
        breadcrumbLabels={{ "site-network/[node]": "つながり 1 本" }}
        title="つながりを直す"
        lead="1 本のつながりの名前・親・並び順を直します。"
      >
        <ErrorView
          title="いまは編集できません"
          body={entry.reason}
          suggestedAction="保存先を用意した実行環境で開いてください。"
          action={<TextLink href="/admin/site-network">つながりの一覧へ</TextLink>}
        />
      </AdminShell>
    );
  }

  const actor = await currentActor();
  const [list, siteOptions] = await Promise.all([
    entry.listNetwork.execute(actor, {}),
    blogSiteOptions(),
  ]);

  const row = list.ok ? list.value.rows.find((r) => r.nodeId === node) ?? null : null;

  return (
    <AdminShell
      routeId="site-network/[node]"
      routeParams={{ node }}
      breadcrumbLabels={{ "site-network/[node]": row?.name ?? "つながり 1 本" }}
      title={row === null ? "つながりを直す" : row.name}
      lead="1 本のつながりの名前・親・並び順・公開状態を直します。"
      actions={<TextLink href="/admin/site-network">つながりの一覧へ</TextLink>}
    >
      {!list.ok ? (
        <ErrorView
          title="つながりを読めませんでした"
          body={list.error.message}
          suggestedAction={list.error.suggestedAction ?? null}
        />
      ) : row === null ? (
        <ErrorView
          title="このつながりはありません"
          body="外されたか、住所が違います。"
          suggestedAction="つながりの一覧から選び直してください。"
          action={<TextLink href="/admin/site-network">つながりの一覧へ</TextLink>}
        />
      ) : (
        <Section title="この 1 本" lead={`識別名: ${row.siteSlug}`}>
          <SiteNetworkForm
            node={{
              nodeId: row.nodeId,
              siteSlug: row.siteSlug,
              role: row.role,
              parentSlug: row.parentSlug,
              name: row.name,
              oneLine: row.oneLine,
              position: row.position,
              status: row.status,
            }}
            // 自分を自分の親にできると、木が輪になって表示が止まらなくなる。
            siteOptions={siteOptions.options.filter((o) => o.value !== row.siteSlug)}
          />
        </Section>
      )}
    </AdminShell>
  );
}
