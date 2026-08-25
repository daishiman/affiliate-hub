import { AdminShell } from "@/presentation/admin/admin-shell";
import { auditLogNotice, currentActor, settingsUseCases } from "@/presentation/composition";
import {
  ActionNote,
  DataTable,
  EmptyView,
  Note,
  Section,
  StorageNotice,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 操作の記録。
 *
 * `/admin/settings` から移出した。
 *
 * **控えで動いているときは必ず文字で出す。** 記録は「残った」と言えること自体が
 * 意味を持つ唯一の種類なので、黙って控え（この実行中だけ覚える置き場）へ落ちる記録は、
 * 残っていると思われて残っていないぶん、無いより悪い。
 */
export default async function AuditLogSettingsPage() {
  const actor = await currentActor();
  const audit = await (await settingsUseCases()).listAuditLog.execute(actor, { limit: 50 });

  return (
    <AdminShell
      routeId="settings/audit"
      title="操作の記録"
      lead="誰がいつ何をしたかの記録。"
      actions={<TextLink href="/admin/settings">設定へ戻る</TextLink>}
    >
      <StorageNotice status={await auditLogNotice()} />

      <Section title="直近の操作">
        {!audit.ok ? (
          // 権限が無い場合はここに入る。「空」ではなく「見られない理由」を出す。
          <ActionNote>
            操作の記録は表示できません。{audit.error.message}
            {audit.error.suggestedAction === undefined ? "" : ` ${audit.error.suggestedAction}`}
          </ActionNote>
        ) : audit.value.rows.length === 0 ? (
          <EmptyView
            title="まだ記録がありません"
            body={audit.value.emptyReason ?? "操作を行うとここに並びます。"}
          />
        ) : (
          <>
            <DataTable
              caption="直近 50 件の操作"
              columns={[
                { key: "at", label: "いつ" },
                { key: "who", label: "誰が" },
                { key: "what", label: "何を" },
                { key: "target", label: "対象" },
                { key: "reason", label: "理由" },
              ]}
              rows={audit.value.rows.map((r) => ({
                key: `${r.occurredAt.toISOString()}-${r.targetLabel}-${r.action}`,
                cells: [
                  r.occurredAt.toLocaleString("ja-JP"),
                  r.byHuman ? r.actorLabel : `${r.actorLabel}・人ではありません`,
                  r.action,
                  r.targetLabel,
                  r.reason ?? "—",
                ],
              }))}
            />
            <Note>
              この記録は後から書き換えられません。承認が人によるものであることを、あとから確かめるために残しています。
            </Note>
          </>
        )}
      </Section>
    </AdminShell>
  );
}
