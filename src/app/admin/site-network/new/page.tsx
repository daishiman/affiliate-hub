import { AdminShell } from "@/presentation/admin/admin-shell";
import { blogSiteOptions } from "@/presentation/admin/blog-site-options";
import { SiteNetworkForm } from "@/presentation/admin/site-network-form";
import { Prose, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * つながりに 1 本足す。
 *
 * 足す時点で決めるのは「識別名・役割・親」の 3 つだけ。
 * 並び順や公開状態を後回しにしているのは、**足す前には比べる相手がいない**ため。
 * 3 本目を足したときに初めて「どの順で並べたいか」が決まる。
 */
export default async function SiteNetworkNewPage() {
  const { options, emptyReason } = await blogSiteOptions();

  return (
    <AdminShell
      routeId="site-network/new"
      title="つながりに 1 本足す"
      lead="ブログを 1 本、つながりの中に置きます。"
      actions={<TextLink href="/admin/site-network">つながりの一覧へ</TextLink>}
    >
      <Section title="新しいつながり">
        <Prose>
          親を空にすると、そのブログはどこからも辿れません。中心 (hub)
          を 1 本だけ決めて、残りをその子に置くと迷いません。
        </Prose>
        {emptyReason !== null && options.length === 0 ? (
          <Prose>
            まだ 1 本もありません。最初の 1 本は親を空のままにして、中心 (hub) として置いてください。
          </Prose>
        ) : null}
        <SiteNetworkForm siteOptions={options} />
      </Section>
    </AdminShell>
  );
}
