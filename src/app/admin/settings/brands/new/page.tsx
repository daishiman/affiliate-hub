import { AdminShell } from "@/presentation/admin/admin-shell";
import { SaveBrandForm } from "@/presentation/admin/maintain/brand-form";
import {
  brandPolitenessOptions,
  brandVocabularyOptions,
  currentActor,
  settingsUseCases,
} from "@/presentation/composition";
import { Callout, ErrorView, Section, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * ブランドを作る画面。
 *
 * ブランドは「誰が言っているか」。これが 1 件も無いと、記事に書き手が無く、
 * 訂正の連絡先も示せない。**入口がここしか無い**ので、
 * 読める人には出す（作れるかどうかは保存のときに断る）。
 *
 * 上限に達しているかどうかを先に見るのは、書き終えてから断られないため。
 */
export default async function NewBrandPage() {
  const actor = await currentActor();
  const overview = await (await settingsUseCases()).getOverview.execute(actor, {});
  const brandCapacity = overview.ok
    ? (overview.value.capacities.find((c) => c.label.includes("ブランド")) ?? null)
    : null;

  return (
    <AdminShell
      routeId="settings/brands/new"
      title="ブランドを作る"
      lead="読者から見た「誰が言っているか」を 1 つ登録します。"
      actions={<TextLink href="/admin/settings/workspaces">この作業場所へ戻る</TextLink>}
    >
      {!overview.ok ? (
        /*
         * 「読めなかった」と「上限に達している」を分ける。
         * 読めなかっただけの人に「上限です」と出すと、
         * 契約を上げても直らないものを上げに行かせる。
         */
        <ErrorView
          title="作業場所を読み出せませんでした"
          body={overview.error.message}
          suggestedAction={overview.error.suggestedAction ?? null}
          action={<TextLink href="/admin/settings/workspaces">この作業場所へ戻る</TextLink>}
        />
      ) : (
        <>
          {brandCapacity !== null && brandCapacity.full && (
            <Callout
              tone="warn"
              title="ブランドの上限に達しています"
              reason={`いま ${brandCapacity.used} 件で、上限は ${brandCapacity.max} 件です。保存しようとすると断られます。契約の区分を上げるか、要らないブランドを片づけてください。`}
            />
          )}

          <Callout
            tone="info"
            title="運営者の表示名と問い合わせ先が空だと、記事を公開できません"
            reason="読者が訂正を求める先を示せないまま広告を出すことになるためです。あとから埋められるので、途中まででも保存できます。"
          />

          <Section title="このブランドのこと">
            <SaveBrandForm
              politenessOptions={brandPolitenessOptions().map((o) => ({
                value: o.key,
                label: o.label,
              }))}
              vocabularyOptions={brandVocabularyOptions().map((o) => ({
                value: o.key,
                label: o.label,
              }))}
            />
          </Section>
        </>
      )}
    </AdminShell>
  );
}
