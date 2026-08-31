import { AdminShell } from "@/presentation/admin/admin-shell";
import { UpdateWorkspaceForm } from "@/presentation/admin/maintain/workspace-form";
import { currentActor, settingsUseCases, workspacePlanOptions } from "@/presentation/composition";
import { Callout, ErrorView, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 作業場所の設定を直す画面。
 *
 * 見るだけの画面（`/admin/settings/workspaces`）と分けている。
 * 同じ画面に欄を混ぜると、上限や広告表記を**確かめに来ただけの人**が
 * 契約の区分に触れる位置に立つ。区分は上限そのもので、
 * 下げた瞬間に新しいブログを作れなくなる。
 */
export default async function EditWorkspacePage() {
  const actor = await currentActor();
  const overview = await (await settingsUseCases()).getOverview.execute(actor, {});

  return (
    <AdminShell
      routeId="settings/workspaces/edit"
      title="作業場所の設定を直す"
      lead="名前・契約の区分・時間帯・通貨。"
      actions={<TextLink href="/admin/settings/workspaces">この作業場所へ戻る</TextLink>}
    >
      {!overview.ok ? (
        <ErrorView
          title="作業場所を読み出せませんでした"
          body={overview.error.message}
          suggestedAction={overview.error.suggestedAction ?? null}
          action={<TextLink href="/admin/settings/workspaces">この作業場所へ戻る</TextLink>}
        />
      ) : (
        <>
          <Callout
            tone="info"
            title="区分を下げても、既にあるものは消えません"
            reason="上限を超えた分はそのまま残り、新しく作れなくなるだけです。消す作りにすると、料金の欄を触っただけで記事の載っているブログが消えます。"
          />

          <Section title="この作業場所のこと">
            <UpdateWorkspaceForm
              planOptions={workspacePlanOptions().map((o) => ({ value: o.key, label: o.label }))}
              initial={{
                name: overview.value.workspaceName,
                plan: overview.value.plan,
                timezone: overview.value.timezone,
                currency: overview.value.currency,
              }}
            />
          </Section>
        </>
      )}
    </AdminShell>
  );
}
