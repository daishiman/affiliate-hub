import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, settingsUseCases } from "@/presentation/composition";
import { ErrorView, ListView, Note, Prose, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 役割ごとにできること。
 *
 * `/admin/settings` から移出した。ここで最も重要なのは表そのものではなく、
 * **「人だけが行える操作」は役割に関係なく機械へ渡らない**という一行である。
 * 役割の表を見ている人は「許可すれば AI にもできる」と読むので、
 * その読みをこの画面の中で否定しておく。
 */
export default async function RoleSettingsPage() {
  const actor = await currentActor();
  const roles = await (await settingsUseCases()).listRoles.execute(actor, {});

  return (
    <AdminShell
      routeId="settings/roles"
      title="役割ごとにできること"
      lead="役割で許される操作の一覧。"
      actions={<TextLink href="/admin/settings">設定へ戻る</TextLink>}
    >
      {!roles.ok ? (
        <ErrorView
          title="役割を出せませんでした"
          body={roles.error.message}
          suggestedAction={roles.error.suggestedAction ?? null}
          action={<TextLink href="/admin/settings">設定へ戻る</TextLink>}
        />
      ) : (
        <>
          <Section title="役割に関係なく機械へ渡らない操作">
            <Prose>
              人だけが行える操作: {roles.value.humanOnlyNote}
              。これらは AI からは呼べません。役割の設定に関係なく、機械には渡りません。
            </Prose>
            <Note>
              誰がどの役割かは <TextLink href="/admin/settings/members">担当者の画面</TextLink>{" "}
              で見られます。
            </Note>
          </Section>

          {roles.value.rows.map((r) => (
            <Section key={r.role} title={r.label}>
              <ListView
                rows={r.capabilities.map((c) => ({ key: c.key, label: c.label }))}
              />
              {r.humanOnlyBlocked.length > 0 && (
                <Note>
                  役割の表には入っていますが、機械には渡していません:{" "}
                  {r.humanOnlyBlocked.join("・")}
                </Note>
              )}
            </Section>
          ))}
        </>
      )}
    </AdminShell>
  );
}
