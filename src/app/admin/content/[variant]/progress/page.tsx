import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  AdvanceContentStateForm,
  ApproveContentForm,
} from "@/presentation/admin/content-progress-form";
import { SchedulePublicationForm } from "@/presentation/admin/schedule-publication-form";
import {
  contentUseCases,
  currentActor,
  distributionUseCases,
} from "@/presentation/composition";
import {
  AiCannotApproveNotice,
  ApprovalBlockedNotice,
  ApprovalFlow,
  ChannelStatusList,
  EmptyView,
  ErrorView,
  Prose,
  Section,
  TextLink,
  type ApprovalState,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 記事 1 本の進行。
 *
 * `/admin/content/[variant]` から移出した。あちらは**読んで判断する**画面で、
 * こちらは**押して動かす**画面である。同じ場所に置いていたとき、
 * 本文を読みに来た人の目の前に「承認」と「配信を作る」が並んでいた。
 *
 * 出稿状況をここへ置いたのは、次に押す物を決める材料だから。
 * 「どこへ出したか」を見ずに「どこへ出すか」は決められない。
 */
export default async function ContentProgressPage({
  params,
}: {
  readonly params: Promise<{ readonly variant: string }>;
}) {
  const { variant: variantId } = await params;
  const actor = await currentActor();
  const [detail, channels] = await Promise.all([
    (await contentUseCases()).getContent.execute(actor, { variantId }),
    (await distributionUseCases()).channelStatus.execute(actor, { variantId }),
  ]);

  // パンくずの見出しだけ先に決める。本文を出せない場合でも、戻り先は残す。
  const label = detail.ok ? (detail.value.variant.title ?? "（見出し未設定）") : "記事";

  return (
    <AdminShell
      routeId="content/[variant]/progress"
      routeParams={{ variant: variantId }}
      breadcrumbLabels={{ "content/[variant]": label }}
      title="進行と配信"
      lead="次に押せることだけを並べます。"
      actions={<TextLink href="/admin/content">記事の一覧へ戻る</TextLink>}
    >
      {!detail.ok ? (
        <ErrorView
          title="この記事の進行を表示できませんでした"
          body={detail.error.message}
          suggestedAction={detail.error.suggestedAction ?? null}
          action={<TextLink href="/admin/content">記事の一覧へ戻る</TextLink>}
        />
      ) : (
        <>
          <Section title="いまの段階">
            <ApprovalFlow current={approvalStateOf(detail.value.variant.status)} />
            {actor.isAiServiceAccount ? (
              <AiCannotApproveNotice
                action={<TextLink href="/admin/content">記事の一覧へ</TextLink>}
              />
            ) : detail.value.approvalBlockedReason === null ? null : (
              <ApprovalBlockedNotice
                reason={detail.value.approvalBlockedReason}
                action={
                  <TextLink href={`/admin/content/${encodeURIComponent(variantId)}`}>
                    本文と指摘を見る
                  </TextLink>
                }
              />
            )}
          </Section>

          <Section title="次に進める">
            {detail.value.state === null ? (
              // 分からないものを最初の段階として出さない。出すと、押しても通らない。
              <EmptyView
                title="進行の記録がありません"
                body="この記事がかんばんのどの列にいるかが記録されていません。記事の一覧から開き直してください。"
              />
            ) : (
              <>
                <Prose>
                  いまは「{detail.value.stateLabel}
                  」です。進めた段階は保存され、記事の一覧にも反映されます。
                </Prose>
                {actor.isAiServiceAccount ? null : (
                  <AdvanceContentStateForm
                    variantId={variantId}
                    from={detail.value.state}
                    nextStates={detail.value.nextStates}
                  />
                )}
                {/* 承認は人にしかできない。AI の代行では、押せる欄そのものを出さない。 */}
                {actor.isAiServiceAccount || detail.value.approvalBlockedReason !== null ? null : (
                  <ApproveContentForm variantId={variantId} />
                )}
              </>
            )}
          </Section>

          <Section title="いまどこへ出ているか">
            {!channels.ok ? (
              <ErrorView
                title="出稿の状況を出せませんでした"
                body={channels.error.message}
                suggestedAction={channels.error.suggestedAction ?? null}
              />
            ) : (
              <>
                <Prose>
                  まだ出していない先も「未着手」として並べます。
                  出していない先を消すと、出し忘れが画面から消えます。
                </Prose>
                <ChannelStatusList
                  entries={channels.value.entries.map((e) => ({
                    capability: e.capability,
                    state: e.state,
                    failureReason: e.failureReason,
                    href:
                      e.publicationId === null
                        ? undefined
                        : `/admin/distribution/${e.publicationId}`,
                  }))}
                />
              </>
            )}
          </Section>

          <Section title="この記事を出す">
            {detail.value.publishBlockedReason === null ? (
              <>
                <Prose>
                  出し先と日時を決めると、配信が 1 件登録されます。ここで投稿はされません。
                  同じ記事・同じ先・同じ日時をもう一度登録しても、配信は増えません。
                </Prose>
                <SchedulePublicationForm variantId={variantId} />
              </>
            ) : (
              // 欄を消して黙らない。なぜ出せないのか、次に何をすれば出せるのかを書く。
              <EmptyView title="まだ配信できません" body={detail.value.publishBlockedReason} />
            )}
          </Section>
        </>
      )}
    </AdminShell>
  );
}

/** 記事の状態を、承認の流れの現在地へ読み替える。 */
function approvalStateOf(status: string): ApprovalState {
  switch (status) {
    case "review":
      return "review";
    case "approved":
      return "approved";
    case "published":
      return "published";
    case "rejected":
      return "archived";
    default:
      return "draft";
  }
}
