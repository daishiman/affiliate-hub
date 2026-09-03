import { AdminShell } from "@/presentation/admin/admin-shell";
import { blogOpsEntry, currentActor } from "@/presentation/composition";
import { selectOperationalRows } from "@/domain/blogops";
import {
  OperationalHealthControls,
  OperationalHealthView,
  parseOperationalHealthQuery,
} from "@/presentation/admin/publish/operational-health-view";
import {
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  Section,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * ブログ同士のつながりの一覧。
 *
 * この画面が答える問いは 1 つだけ:**どこから辿れないブログがあるか**。
 * 表に「行き止まり」列を置いてあるのは、親を消したときに気付ける場所が
 * ここしか無いため。読者の側では、行き止まりのブログは静かに孤立するだけで
 * 何のエラーも出ない。
 */
export default async function SiteNetworkPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const entry = await blogOpsEntry();
  if (!entry.ready) {
    return (
      <AdminShell
        routeId="site-network"
        title="ブログのつながり"
        lead="ブログ同士の親子関係を見て、行き止まりを見つけます。"
      >
        <ErrorView
          title="いまは編集できません"
          body={entry.reason}
          suggestedAction="保存先を用意した実行環境で開いてください。"
          action={<TextLink href="/admin">ホームへ戻る</TextLink>}
        />
      </AdminShell>
    );
  }

  const [actor, params] = await Promise.all([currentActor(), searchParams]);
  const list = await entry.listNetwork.execute(actor, {});
  const healthQuery = parseOperationalHealthQuery(params);
  const shownRows = list.ok
    ? selectOperationalRows(list.value.rows, healthQuery, (row) => ({
        name: row.name,
        health: row.health,
      }))
    : [];

  return (
    <AdminShell
      routeId="site-network"
      title="ブログのつながり"
      lead="ブログ同士の親子関係を見て、行き止まりを見つけます。"
      actions={
        <>
          <TextLink href="/admin/site-network/new">つながりに 1 本足す</TextLink>
          <TextLink href="/admin/site-network/deleted">削除済みを見る</TextLink>
        </>
      }
    >
      {!list.ok ? (
        <ErrorView
          title="つながりを出せませんでした"
          body={list.error.message}
          suggestedAction={list.error.suggestedAction ?? null}
        />
      ) : list.value.total === 0 ? (
        <Section title="つながり">
          <EmptyView
            title="つながりがありません"
            body={list.value.emptyReason ?? "まだ 1 本も登録されていません。"}
            action={<TextLink href="/admin/site-network/new">つながりに 1 本足す</TextLink>}
          />
        </Section>
      ) : (
        <>
          <Callout
            tone={list.value.orphanCount === 0 ? "info" : "warn"}
            title={
              list.value.orphanCount === 0
                ? `${list.value.total} 本すべてが、どこかから辿れます`
                : `${list.value.orphanCount} 本が、どこからも辿れません`
            }
            reason={
              list.value.orphanCount === 0
                ? "読者はどのブログからでも、中心のブログを経由して他のブログへ行けます。"
                : "親のブログが無いか、隠されています。読者はこのブログに直接の入口からしか来られません。"
            }
          />

          <Section title="つながりの木" lead="字下げが親子の深さです。">
            <OperationalHealthControls
              action="/admin/site-network"
              query={healthQuery}
            />
            <DataTable
              caption="ブログのつながり"
              columns={[
                { key: "name", label: "ブログ" },
                { key: "role", label: "役割" },
                { key: "parent", label: "親" },
                { key: "status", label: "読者に見せる" },
                { key: "orphan", label: "行き止まり" },
                { key: "health", label: "運用健全性" },
                { key: "edit", label: "操作" },
              ]}
              rows={shownRows.map((row) => ({
                key: row.nodeId,
                cells: [
                  `${"　".repeat(row.depth)}${row.name}`,
                  row.roleLabel,
                  row.parentSlug ?? "（無し）",
                  row.status === "active" ? "見せる" : "隠す",
                  row.orphaned ? "行き止まり" : "—",
                  <OperationalHealthView key="health" health={row.health} />,
                  <TextLink
                    key="edit"
                    href={`/admin/site-network/${encodeURIComponent(row.nodeId)}`}
                  >
                    直す
                  </TextLink>,
                ],
              }))}
            />
          </Section>
        </>
      )}
    </AdminShell>
  );
}
