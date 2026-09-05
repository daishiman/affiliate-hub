import { AdminShell } from "@/presentation/admin/admin-shell";
import type { SiteWizardStep } from "@/domain/authoring";
import { SITE_WIZARD_STEPS } from "@/domain/authoring/site-draft";
import { startSiteDraftAction } from "@/presentation/admin/publish/site-wizard-action";
import { SiteWizardStepForm } from "@/presentation/admin/publish/site-wizard-form";
import { currentActor, siteBuilderUseCases, siteDraftNotice } from "@/presentation/composition";
import {
  ActionButton,
  Callout,
  EmptyView,
  ErrorView,
  ListView,
  Prose,
  Section,
  StorageNotice,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * ブログ作成ウィザード (§16.2)。
 *
 * **この画面が示したいのは「ブログを 1 本増やすのにコードを書かない」こと。**
 * 13 の質問に答えると設計図のデータができ、読者向けの画面
 * (`/s/<URL名>`) はすでにあるものがそのまま使われる。
 *
 * 段階は 1 画面 1 段階にしている。13 個を 1 画面に並べると、
 * どこまで答えたか分からなくなり、途中で離脱したときに続きから戻れない。
 *
 * 骨格（パンくず・見出し・戻り先）は 1 か所だけで書く。
 * 下書きの一覧と質問の途中で骨格を二重に書くと、
 * 片方だけ戻り先が消えた画面が後から生まれる。
 */
export default async function NewSitePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ draftId?: string; step?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AdminShell
      routeId="sites/new"
      title="新しいブログを作る"
      lead="13 の質問に答えると、ブログが 1 本できます。"
      actions={<TextLink href="/admin/sites">ブログの一覧へ戻る</TextLink>}
    >
      <StorageNotice status={await siteDraftNotice()} />

      {params.draftId === undefined ? (
        <DraftListView error={params.error} />
      ) : (
        <WizardBody draftId={params.draftId} step={params.step} />
      )}
    </AdminShell>
  );
}

/**
 * 質問 1 段階分。
 *
 * 現在地と、13 段階のうちどこが埋まっているかを同じ画面に出す。
 * 現在地だけだと「あと何回答えるのか」が読めず、途中でやめる理由になる。
 */
async function WizardBody({
  draftId,
  step: rawStep,
}: {
  readonly draftId: string;
  readonly step?: string;
}) {
  const actor = await currentActor();
  const step = SITE_WIZARD_STEPS.find((s) => s === rawStep) as SiteWizardStep | undefined;
  const found = await (await siteBuilderUseCases()).getDraft.execute(actor, { draftId, step });

  if (!found.ok) {
    return (
      <ErrorView
        title="この下書きを開けませんでした"
        body={found.error.message}
        suggestedAction={found.error.suggestedAction ?? null}
        action={<TextLink href="/admin/sites/new">作りかけの一覧へ戻る</TextLink>}
      />
    );
  }

  const draft = found.value;
  const current = draft.steps.find((s) => s.step === draft.currentStep);

  return (
    <>
      <Section
        title={current?.label ?? "作る"}
        /* 現在地は常に出す。13 段階のどこにいるか分からない状態を作らない。 */
        lead={`${current?.position ?? 1} / ${draft.totalSteps} 段階目（${draft.doneCount} 段階まで入力済み）`}
      >
        <Prose>{current?.question ?? ""}</Prose>
        <SiteWizardStepForm draft={draft} />
      </Section>

      <Section title="13 段階の進み具合" lead="好きな段階へ戻れます。順番どおりでなくて構いません。">
        <ListView
          rows={draft.steps.map((s) => ({
            key: s.step,
            label: `${s.position}. ${s.label}`,
            href: `/admin/sites/new?draftId=${draft.draftId}&step=${s.step}`,
            note: `${s.done ? "入力済み" : "まだ入力していません"}${
              s.step === draft.currentStep ? "（いま開いています）" : ""
            }`,
          }))}
        />
      </Section>
    </>
  );
}

/**
 * 作りかけの一覧。
 *
 * 下書きが 0 件のときも「始める」ボタンだけの画面にしない。
 * ここで何が起きるのか（13 の質問に答えると 1 本できる）を先に書く。
 */
async function DraftListView({ error }: { readonly error?: string }) {
  const actor = await currentActor();
  const listed = await (await siteBuilderUseCases()).listDrafts.execute(actor, {});

  return (
    <>
      {error === undefined ? null : <Callout tone="warn" reason={error} />}

      <Section title="新しいブログを始める">
        <Prose>
          答えた内容は設計図として保存され、読者に見える画面は既にあるものがそのまま使われます。作るまで公開されません。
        </Prose>
        <ActionButton
          action={startSiteDraftAction}
          label="13 の質問を始める"
          reason={
            "新しいブログを起こすかどうかは人が決める。目録に start_site_draft に当たる道具が無く、" +
            "AI サービスアカウントへ site.draft の権限も配っていない。13 の質問は" +
            "「誰に何を届けるか」を人から引き出す手続きなので、AI が代わりに答えると" +
            "設計図だけができて、答えた人が誰も居ないブログが残る。"
          }
        />
      </Section>

      <Section title="作りかけのブログ">
        {!listed.ok ? (
          <ErrorView
            title="作りかけの一覧を出せませんでした"
            body={listed.error.message}
            suggestedAction={listed.error.suggestedAction ?? null}
            action={<TextLink href="/admin/sites">ブログの一覧へ戻る</TextLink>}
          />
        ) : listed.value.total === 0 ? (
          <EmptyView
            title="作りかけはありません"
            body={listed.value.emptyReason ?? "作りかけのブログはありません。"}
          />
        ) : (
          <ListView
            rows={listed.value.items.map((d) => ({
              key: d.draftId,
              label: d.name === "" ? "名前がまだ決まっていない下書き" : d.name,
              href: `/admin/sites/new?draftId=${d.draftId}`,
              note: `${d.doneCount} / ${d.totalSteps} 段階まで入力済み${
                d.createdSiteSlug === null ? "（まだ公開されていません）" : "（作成済み）"
              }`,
            }))}
          />
        )}
      </Section>
    </>
  );
}
