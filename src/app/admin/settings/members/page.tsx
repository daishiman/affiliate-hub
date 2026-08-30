import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  ChangeMemberRolesForm,
  InviteMemberForm,
  RevokeMemberForm,
} from "@/presentation/admin/maintain/member-forms";
import { currentActor, settingsUseCases } from "@/presentation/composition";
import {
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  Note,
  Section,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 担当者。
 *
 * `/admin/settings` から移出した。**招く操作をまだ置いていない**理由は
 * ログインの仕組みが入るまで身元を確かめられないためで、
 * 「できない」を画面ごと消さずに理由として書く。消すと、
 * 利用者には「機能が無い」と「まだ使えない」の区別が付かない。
 */
export default async function MemberSettingsPage() {
  const actor = await currentActor();
  const uc = await settingsUseCases();
  const [members, roles] = await Promise.all([
    uc.listMembers.execute(actor, {}),
    uc.listRoles.execute(actor, {}),
  ]);
  const roleOptions = roles.ok
    ? roles.value.rows
        .filter((role) => !role.isMachine)
        .map((role) => ({ value: role.role as string, label: role.label }))
    : [];

  return (
    <AdminShell
      routeId="settings/members"
      title="担当者"
      lead="誰が何を担当しているか。"
      actions={<TextLink href="/admin/settings">設定へ戻る</TextLink>}
    >
      {!members.ok ? (
        <ErrorView
          title="担当者を出せませんでした"
          body={members.error.message}
          suggestedAction={members.error.suggestedAction ?? null}
          action={<TextLink href="/admin/settings">設定へ戻る</TextLink>}
        />
      ) : (
        <>
          <Callout
            tone="info"
            title="招待とログイン許可は別です"
            reason="ここで担当者へ招待したあと、運用側のログイン許可名簿にも同じアドレスを登録する必要があります。"
          />
          {members.value.ownerMissing && (
            <Callout
              tone="warn"
              title="運営者が決まっていません"
              reason="運営者がいないと、契約と支払いに関する操作を誰も行えません。"
            />
          )}

          <Section title="いまの担当者">
            {members.value.rows.length === 0 ? (
              <EmptyView
                title="担当者がいません"
                body={members.value.emptyReason ?? "招待するとここに並びます。"}
              />
            ) : (
              <DataTable
                caption="この作業場所の担当者"
                columns={[
                  { key: "name", label: "名前" },
                  { key: "email", label: "招待したアドレス" },
                  { key: "role", label: "役割" },
                  { key: "state", label: "状態" },
                  { key: "scope", label: "担当の範囲" },
                  ...(roleOptions.length === 0 ? [] : [{ key: "change", label: "変える" }]),
                ]}
                rows={members.value.rows.map((m) => ({
                  key: m.membershipId,
                  cells: [
                    m.displayName,
                    m.invitedEmail,
                    m.roleLabels.join("・"),
                    m.stateLabel,
                    m.scopeLabel,
                    ...(roleOptions.length === 0
                      ? []
                      : [
                          <div key="member-actions">
                            <ChangeMemberRolesForm
                              membershipId={m.membershipId}
                              displayName={m.displayName}
                              currentRoles={[...m.roles]}
                              roleOptions={roleOptions}
                            />
                            {m.active ? (
                              <RevokeMemberForm
                                membershipId={m.membershipId}
                                displayName={m.displayName}
                              />
                            ) : null}
                          </div>,
                        ]),
                  ],
                }))}
              />
            )}
            {roleOptions.length === 0 ? null : (
              <>
                <InviteMemberForm roleOptions={roleOptions} />
                <Note>
                  役割ごとにできることは{" "}
                  <TextLink href="/admin/settings/roles">役割の画面</TextLink> で見られます。
                </Note>
              </>
            )}
          </Section>
        </>
      )}
    </AdminShell>
  );
}
