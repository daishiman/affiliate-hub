import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  AdvanceContentStateForm,
  ApproveContentForm,
} from "@/presentation/admin/content-progress-form";
import { qualityCheckLabel } from "@/presentation/admin/quality-check-labels";
import { SchedulePublicationForm } from "@/presentation/admin/schedule-publication-form";
import { contentUseCases, currentActor, editorialContentNotice } from "@/presentation/composition";
import {
  AiCannotApproveNotice,
  ApprovalBlockedNotice,
  ApprovalFlow,
  Callout,
  Card,
  DefinitionList,
  EmptyView,
  ErrorView,
  Page,
  SectionHeading,
  StackedList,
  StackedRow,
  StorageNotice,
  type ApprovalState,
} from "@/presentation/ui";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * 記事 1 本の画面。
 *
 * **自動確認の結果を「合格」だけで済ませない。**
 * 実行しなかった項目も理由つきで並べる。
 * 出さないと「24 項目すべて確認済み」と読まれ、
 * 実際には見ていない観点が見落とされる。
 *
 * 名前は `qualityCheckLabel()` で言い換える。**言い換え表は全域**で、
 * 検査を足した日に書き足すまで型が通らない（2026-08-21 以前は 7 件欠けており、
 * `vague_heading` のような識別子が編集者の画面にそのまま出ていた）。
 */
export default async function ContentDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly variant: string }>;
}) {
  const { variant: variantId } = await params;
  const actor = await currentActor();
  const result = await (await contentUseCases()).getContent.execute(actor, { variantId });

  if (!result.ok) {
    return (
      <Shell title="記事">
        <ErrorView
          title="この記事を表示できませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<Link href="/admin/content">記事の一覧へ戻る</Link>}
        />
      </Shell>
    );
  }

  const {
    variant,
    quality,
    policy,
    policyUncheckedReason,
    authorName,
    state,
    stateLabel,
    nextStates,
    approvalBlockedReason,
    publishBlockedReason,
  } = result.value;
  const title = variant.title ?? "（見出し未設定）";
  const errors = quality.issues.filter((i) => i.severity === "error");
  const warnings = quality.issues.filter((i) => i.severity !== "error");

  return (
    <Shell title={title}>
      <StorageNotice status={await editorialContentNotice()} />

      <Card>
        <SectionHeading level={2}>いまの段階</SectionHeading>
        <ApprovalFlow current={approvalStateOf(variant.status)} />
        {actor.isAiServiceAccount ? (
          <AiCannotApproveNotice action={<Link href="/admin/content">記事の一覧へ</Link>} />
        ) : approvalBlockedReason === null ? null : (
          <ApprovalBlockedNotice
            reason={approvalBlockedReason}
            action={<Link href="/admin/content">ほかの記事を見る</Link>}
          />
        )}
        <p className={styles.sectionLead}>
          書き手: {authorName ?? "未設定"} / 媒体: {variant.channel} / 作成に使った指示:{" "}
          {variant.generationPromptVersion}（{variant.modelId}）
        </p>
      </Card>

      <Card>
        <SectionHeading level={2}>次に進める</SectionHeading>
        {state === null ? (
          // 分からないものを最初の段階として出さない。出すと、押しても通らない。
          <EmptyView
            title="進行の記録がありません"
            body="この記事がかんばんのどの列にいるかが記録されていません。記事の一覧から開き直してください。"
          />
        ) : (
          <>
            <p className={styles.sectionLead}>
              いまは「{stateLabel}」です。進めた段階は保存され、記事の一覧にも反映されます。
            </p>
            {actor.isAiServiceAccount ? null : (
              <AdvanceContentStateForm variantId={variantId} from={state} nextStates={nextStates} />
            )}
            {/* 承認は人にしかできない。AI の代行では、押せる欄そのものを出さない。 */}
            {actor.isAiServiceAccount || approvalBlockedReason !== null ? null : (
              <ApproveContentForm variantId={variantId} />
            )}
          </>
        )}
      </Card>

      <Card>
        <SectionHeading level={2}>自動確認の結果</SectionHeading>
        <p className={styles.sectionLead}>
          直すべき指摘 {errors.length}件 / 気をつける点 {warnings.length}件 / 確認しなかった項目{" "}
          {quality.skipped.length}件
        </p>

        {quality.issues.length === 0 ? (
          <EmptyView
            title="指摘はありません"
            body="自動で確認できる範囲では問題は見つかりませんでした。人の目での確認は別に必要です。"
          />
        ) : (
          <StackedList>
            {quality.issues.map((issue, i) => (
              <StackedRow key={`${issue.check}-${i}`}>
                <Callout
                  tone={issue.severity === "error" ? "danger" : "warn"}
                  title={qualityCheckLabel(issue.check)}
                  reason={issue.message}
                />
              </StackedRow>
            ))}
          </StackedList>
        )}

        <SectionHeading level={3}>確認しなかった項目</SectionHeading>
        {quality.skipped.length === 0 ? (
          <p className={styles.sectionLead}>すべての項目を確認しました。</p>
        ) : (
          <DefinitionList
            items={quality.skipped.map((s) => ({
              term: qualityCheckLabel(s.check),
              description: s.reason,
            }))}
          />
        )}
      </Card>

      <Card>
        <SectionHeading level={2}>表現のきまり</SectionHeading>
        {policy === null ? (
          // 確認できなかったことを「指摘なし」と並べて出さない。
          // 同じ見た目にすると、見ていない記事が見た記事と区別できなくなる。
          <Callout
            tone="warn"
            title="確認できていません"
            reason={policyUncheckedReason ?? "理由が分かりません。"}
            action={<Link href="/admin/content">記事の一覧へ戻る</Link>}
          />
        ) : policy.violations.length === 0 ? (
          <EmptyView
            title="当たった項目はありません"
            body="この記事の分野で登録されているきまりには当たりませんでした。登録されていない法令は確認していません。"
          />
        ) : (
          <StackedList>
            {policy.violations.map((v, i) => (
              <StackedRow key={`${String(v.ruleId)}-${i}`}>
                <Callout
                  tone={v.severity === "block" ? "danger" : v.severity === "warn" ? "warn" : "info"}
                  title={v.ruleName}
                  // 禁止だけ示すと執筆が止まる。根拠と言い換えを必ず添える。
                  reason={`「${v.excerpt}」— ${v.basis}。${v.suggestion}`}
                />
              </StackedRow>
            ))}
          </StackedList>
        )}
        {policy !== null && policy.unevaluatedRuleIds.length > 0 && (
          // 実行できなかったルールを黙って飛ばさない。
          <Callout
            tone="warn"
            title="確認できなかったきまりがあります"
            reason={`${policy.unevaluatedRuleIds.length}件のきまりが実行できませんでした。設定した検出条件を見直してください。`}
          />
        )}
      </Card>

      <Card>
        <SectionHeading level={2}>この記事を出す</SectionHeading>
        {publishBlockedReason === null ? (
          <>
            <p className={styles.sectionLead}>
              出し先と日時を決めると、配信が 1 件登録されます。ここで投稿はされません。
              同じ記事・同じ先・同じ日時をもう一度登録しても、配信は増えません。
            </p>
            <SchedulePublicationForm variantId={variantId} />
          </>
        ) : (
          // 欄を消して黙らない。なぜ出せないのか、次に何をすれば出せるのかを書く。
          // 理由の文はユースケースが返す。画面でもう一度判定すると、
          // 画面と AI で違う理由が出る（そして片方だけ古くなる）。
          <EmptyView title="まだ配信できません" body={publishBlockedReason} />
        )}
      </Card>

      <Card>
        <SectionHeading level={2}>本文</SectionHeading>
        <p className={styles.sectionLead}>{variant.summary}</p>
        {variant.body.split("\n").map((line, i) => (
          <p key={`${i}-${line.slice(0, 8)}`}>{line}</p>
        ))}
      </Card>

      {variant.assumptions.length === 0 ? null : (
        <Card>
          <SectionHeading level={2}>AI が置いた仮定</SectionHeading>
          <p className={styles.sectionLead}>
            これは確かめられた内容ではありません。読者にも仮定として示します。
          </p>
          <StackedList>
            {variant.assumptions.map((a) => (
              <StackedRow key={a}>{a}</StackedRow>
            ))}
          </StackedList>
        </Card>
      )}
    </Shell>
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

function Shell({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/content"
      breadcrumbs={[
        { label: "ホーム", href: "/admin" },
        { label: "記事", href: "/admin/content" },
        { label: title },
      ]}
      actions={<Link href="/admin/content">記事の一覧へ戻る</Link>}
    >
      <Page title={title} lead="本文と自動確認の結果を見て、次の段階へ進めてよいかを判断します。">
        {children}
      </Page>
    </AdminShell>
  );
}
