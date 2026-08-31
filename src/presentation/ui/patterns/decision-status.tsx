import styles from "./patterns.module.css";

export type DecisionStatusKind = "provisional" | "final" | "insufficient-n";

const STATUS_LABEL = {
  provisional: "暫定",
  final: "確定",
  "insufficient-n": "母数不足",
} as const satisfies Record<DecisionStatusKind, string>;

/**
 * 数字を判断に使える段階か、色に頼らず伝える共通部品。
 *
 * 見た目の色名ではなく業務上の3状態を型にする。`detail` は読み上げ名にも含め、
 * 「暫定」だけを聞いた人にも次に何をすべきかが残る。
 */
export function DecisionStatus({
  status,
  detail,
}: {
  readonly status: DecisionStatusKind;
  readonly detail: string;
}) {
  const label = STATUS_LABEL[status];
  return (
    <span
      className={styles.decisionStatus}
      data-decision-status={status}
      aria-label={`判定状態: ${label}。${detail}`}
      title={detail}
    >
      {label}
    </span>
  );
}
