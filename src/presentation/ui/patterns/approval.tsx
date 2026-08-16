import { UI_COPY } from "../copy";
import { Callout } from "../primitives/callout";
import styles from "./patterns.module.css";

/**
 * 承認の流れ。
 *
 * 状態遷移は draft → review → approved → scheduled → published → archived。
 * **人の承認が必要**で、AI アカウントの操作は承認とみなさない。
 * この決まりを画面ごとに書くと、どこかの画面だけ AI で承認できてしまう。
 */

export const APPROVAL_STEPS = [
  "draft",
  "review",
  "approved",
  "scheduled",
  "published",
] as const;

export type ApprovalState = (typeof APPROVAL_STEPS)[number] | "archived";

const LABEL: Readonly<Record<ApprovalState, string>> = {
  draft: UI_COPY.approval.draft,
  review: UI_COPY.approval.review,
  approved: UI_COPY.approval.approved,
  scheduled: UI_COPY.approval.scheduled,
  published: UI_COPY.approval.published,
  archived: UI_COPY.approval.archived,
};

export function ApprovalFlow({ current }: { readonly current: ApprovalState }) {
  const index = APPROVAL_STEPS.indexOf(current as (typeof APPROVAL_STEPS)[number]);

  if (current === "archived") {
    // 取り下げ済みは流れの外。並びの中に混ぜると現在地が読めなくなる。
    return (
      <p className={styles.flow}>
        <span className={[styles.flowStep, styles.flowStepCurrent].join(" ")}>
          {LABEL.archived}
        </span>
      </p>
    );
  }

  return (
    <ol className={styles.flow} aria-label={UI_COPY.approval.humanRequired}>
      {APPROVAL_STEPS.map((step, i) => {
        const done = i < index;
        const isCurrent = i === index;
        return (
          <li
            key={step}
            className={[
              styles.flowStep,
              done ? styles.flowStepDone : "",
              isCurrent ? styles.flowStepCurrent : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-current={isCurrent ? "step" : undefined}
          >
            {done && <span aria-hidden="true">✓</span>}
            {LABEL[step]}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * 承認できない理由の表示。
 *
 * ボタンを無効にするだけにしない。**なぜ押せないかを必ず出す。**
 * 無効なボタンだけを見せると、利用者は「壊れている」と受け取る。
 */
export function ApprovalBlockedNotice({
  reason,
  action,
}: {
  readonly reason: string;
  readonly action?: React.ReactNode;
}) {
  return <Callout tone="warn" title={UI_COPY.approval.humanRequired} reason={reason} action={action} />;
}

/** AI アカウントが承認しようとしたときの表示。 */
export function AiCannotApproveNotice({ action }: { readonly action?: React.ReactNode }) {
  return (
    <Callout
      tone="danger"
      title={UI_COPY.approval.aiCannotApprove}
      reason={UI_COPY.approval.humanRequired}
      action={action}
    />
  );
}
