import type { ReactNode } from "react";
import styles from "./patterns.module.css";

export type SummaryMetric = {
  readonly key: string;
  readonly label: string;
  readonly value: ReactNode;
  readonly meaning: string;
  readonly action?: ReactNode;
};

/**
 * 画面を開いた直後に読む要約。
 * 値だけを並べず、意味を必須にして「この数字で何を判断するか」を残す。
 */
export function SummaryStrip({ label, metrics }: { readonly label: string; readonly metrics: readonly SummaryMetric[] }) {
  return (
    <dl className={styles.summaryStrip} aria-label={label}>
      {metrics.map((metric) => (
        <div key={metric.key} className={styles.summaryMetric}>
          <dt className={styles.summaryLabel}>{metric.label}</dt>
          <dd className={styles.summaryValue}>{metric.value}</dd>
          <dd className={styles.summaryMeaning}>{metric.meaning}</dd>
          {metric.action === undefined ? null : <dd className={styles.summaryAction}>{metric.action}</dd>}
        </div>
      ))}
    </dl>
  );
}
