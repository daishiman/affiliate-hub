import { AdminShell } from "@/presentation/admin/admin-shell";
import { SiteNetworkRestoreForm } from "@/presentation/admin/site-network-form";
import { blogOpsEntry, currentActor } from "@/presentation/composition";
import { DataTable, EmptyView, ErrorView, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

export default async function DeletedSiteNetworkPage() {
  const entry = await blogOpsEntry();
  if (!entry.ready) {
    return (
      <AdminShell
        routeId="site-network/deleted"
        title="削除済みのブログ"
        lead="通常一覧から外したブログを、元の住所へ戻します。"
      >
        <ErrorView title="削除済み一覧を出せません" body={entry.reason} />
      </AdminShell>
    );
  }

  const actor = await currentActor();
  const list = await entry.listDeletedNetwork.execute(actor, {});
  return (
    <AdminShell
      routeId="site-network/deleted"
      title="削除済みのブログ"
      lead="親子関係を現在のサイト網で再確認してから、同じ URL へ戻します。"
      actions={<TextLink href="/admin/site-network">通常のつながりへ戻る</TextLink>}
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
            title="削除済みのブログはありません"
            body={list.value.emptyReason ?? "ここへ戻す対象はありません。"}
            action={<TextLink href="/admin/site-network">通常のつながりへ戻る</TextLink>}
          />
        </Section>
      ) : (
        <Section title="削除済みのブログ">
          <DataTable
            caption="削除済みのサイト網"
            columns={[
              { key: "name", label: "ブログ" },
              { key: "role", label: "役割" },
              { key: "parent", label: "元の親" },
              { key: "deleted", label: "削除日時" },
              { key: "restore", label: "" },
            ]}
            rows={list.value.rows.map((row) => ({
              key: row.nodeId,
              cells: [
                `${row.name} (${row.siteSlug})`,
                row.roleLabel,
                row.parentSlug ?? "（無し）",
                row.deletedAt.slice(0, 10),
                <SiteNetworkRestoreForm
                  key="restore"
                  nodeId={row.nodeId}
                  name={row.name}
                />,
              ],
            }))}
          />
        </Section>
      )}
    </AdminShell>
  );
}
