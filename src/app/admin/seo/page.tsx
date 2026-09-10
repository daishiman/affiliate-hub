import {
  RevertSeoAutoApplyForm,
  ApplySeoRevisionForm,
  SeoAutoApplyPauseForm,
  SeoCitationMonthlyLimitForm,
} from "@/presentation/admin/observe/seo-aeo-forms";
import { SeoRevisionPreview } from "@/presentation/admin/observe/seo-revision-preview";
import { seoReviewHref } from "@/presentation/admin/observe/seo-review-href";
import { can } from "@/domain/identity/permissions";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { FINDING_DISPLAY_LIMIT, SeoDashboard } from "@/presentation/admin/observe/seo-dashboard";
import {
  currentActor,
  platformUseCases,
  seoMeasurementUseCases,
} from "@/presentation/composition";
import { ErrorView, Note, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/** 記事ごとの差分確認と反映、同じページの観測値をつなぐ管理画面。 */
export default async function SeoPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const siteSlug = params.site !== undefined && params.site !== "" ? params.site : undefined;

  const articleSlug = params.article?.trim() || undefined;
  const actor = await currentActor();
  const uc = await seoMeasurementUseCases(actor.workspaceId);

  /*
    保存先がつながっていないときは、見本の数字を出さずに断る。
    ここは観測を見せる画面なので、**見本が出た瞬間に嘘になる。**
  */
  if (uc === null) {
    return (
      <AdminShell
        routeId="seo"
        title="検索とAIからの見え方"
        lead="検索と AI から、このブログがどう見えているかを見ます。"
      >
        <ErrorView
          title="まだ計測の記録を読み出せません"
          body="保存先につながっていないため、観測した数字を出せません。見本の数字は出しません（自分のブログの状態と読み違えるため）。"
          suggestedAction="環境の設定を確認してから、もう一度開いてください。"
          action={<TextLink href="/admin">ホームへ戻る</TextLink>}
        />
      </AdminShell>
    );
  }

  const dashboard = await uc.manage.execute(actor, { action: "dashboard", siteSlug, limit: FINDING_DISPLAY_LIMIT });
  const sites = await (await platformUseCases()).listSites.execute(actor, {});
  const preview = siteSlug !== undefined && articleSlug !== undefined
    ? await uc.manage.execute(actor, { action: "preview", siteSlug, articleSlug })
    : null;

  return (
    <AdminShell
      routeId="seo"
      title="検索とAIからの見え方"
      lead="記事の修正候補と差分を確認し、反映後は同じページの観測値を見ます。"
      actions={<TextLink href="/admin/improvement">改善の状況を見る</TextLink>}
    >
      {!dashboard.ok ? (
        <ErrorView
          title="計測の状況を出せませんでした"
          body={dashboard.error.message}
          suggestedAction={dashboard.error.suggestedAction ?? null}
          action={<TextLink href="/admin">ホームへ戻る</TextLink>}
        />
      ) : dashboard.value.action !== "dashboard" ? (
        <ErrorView
          title="計測の状況を出せませんでした"
          body="予期しない応答でした。"
          suggestedAction="もう一度開いてください。"
          action={<TextLink href="/admin">ホームへ戻る</TextLink>}
        />
      ) : (
        <SeoDashboard
          view={dashboard.value}
          siteSlug={siteSlug}
          siteOptions={sites.ok ? sites.value.items : []}
          siteError={sites.ok ? null : sites.error.message}
          canManage={can(actor, "site.manage")}
          reviewSlot={preview === null ? null : !preview.ok ? (
            <ErrorView title="記事の差分を読み出せませんでした" body={preview.error.message}
              suggestedAction={preview.error.suggestedAction ?? "記事の候補を確認し直してください。"}
              action={<TextLink href={seoReviewHref(siteSlug!)}>記事の候補へ戻る</TextLink>} />
          ) : preview.value.action !== "preview" ? (
            <ErrorView title="記事の差分を読み出せませんでした" body="予期しない応答でした。" suggestedAction="もう一度開いてください。"
              action={<TextLink href={seoReviewHref(siteSlug!)}>記事の候補へ戻る</TextLink>} />
          ) : (
            <SeoRevisionPreview view={preview.value} recentApplies={dashboard.value.recentApplies}
              canManage={can(actor, "site.manage")}
              renderRevert={(logId) => <RevertSeoAutoApplyForm logId={logId} />}
              applySlot={<ApplySeoRevisionForm
                siteSlug={preview.value.article.siteSlug} articleSlug={preview.value.article.articleSlug}
                approvalToken={preview.value.approvalToken}
                disabledReason={!can(actor, "site.manage") ? "反映にはブログの設定を変える権限が必要です。差分と観測値は確認できます。"
                  : preview.value.blockedReason ?? (preview.value.approvalToken === null ? "反映する差分はありません。" : null)}
              />} />
          )}
          renderRevert={(logId) => <RevertSeoAutoApplyForm logId={logId} />}
          pauseSlot={<SeoAutoApplyPauseForm paused={dashboard.value.paused} />}
          citationBudgetSlot={can(actor, "site.manage")
            ? <SeoCitationMonthlyLimitForm limit={dashboard.value.citationMonthlyBudget.limitSearches} />
            : <Note>月次上限を変更できるのは、ブログの設定を変える権限を持つ人だけです。</Note>}
        />
      )}
    </AdminShell>
  );
}
