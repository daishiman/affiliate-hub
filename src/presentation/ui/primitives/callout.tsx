import type { ReactNode } from "react";
import styles from "./ui.module.css";

/**
 * 理由の表示。
 *
 * **編集できない一覧・空やゼロが並ぶ表示には、必ず理由を 1 行出す。**
 * 例:
 *   「確定済みの月のため編集できません」+ 確定の解除画面への導線
 *   「対応表が未登録です」+ 対応表の登録画面への導線
 *
 * 無言で操作を止めると、利用者は「壊れている」と受け取る。
 * `reason` を必須にして、書き忘れをコンパイルで止める。
 */
export type CalloutTone = "info" | "warn" | "danger" | "success";

const TONE_CLASS: Readonly<Record<CalloutTone, string>> = {
  info: styles.calloutInfo,
  warn: styles.calloutWarn,
  danger: styles.calloutDanger,
  success: styles.calloutSuccess,
};

export function Callout({
  tone = "info",
  title,
  reason,
  action,
}: {
  readonly tone?: CalloutTone;
  readonly title?: string;
  /** なぜそうなっているか。1 行で、利用者の言葉で書く。 */
  readonly reason: string;
  /** 解決できる画面への導線。無くてよい場合だけ省く。 */
  readonly action?: ReactNode;
}) {
  return (
    <div
      className={[styles.callout, TONE_CLASS[tone]].join(" ")}
      role={tone === "danger" ? "alert" : "note"}
    >
      {title !== undefined && <span className={styles.calloutTitle}>{title}</span>}
      <span>{reason}</span>
      {action !== undefined && <span className={styles.calloutAction}>{action}</span>}
    </div>
  );
}
