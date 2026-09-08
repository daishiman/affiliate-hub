import styles from "./patterns.module.css";

export type BarChartPoint = {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly valueLabel: string;
};

/**
 * 正確な値を文字でも残す、同一単位・同一期間の比較用横棒グラフ。
 *
 * `unit` と `period` を必須にする。呼び出し側が異種の数字を1本の棒へ混ぜると、
 * 棒の長さだけが比較できそうに見えてしまうためである。
 */
export function BarChart({
  title,
  unit,
  period,
  textSummary,
  pointValues,
}: {
  readonly title: string;
  readonly unit: string;
  readonly period: string;
  readonly textSummary: string;
  readonly pointValues: readonly BarChartPoint[];
}) {
  const max = Math.max(1, ...pointValues.map((point) => point.value));
  return (
    <figure className={styles.barChart}>
      <figcaption>
        <strong className={styles.chartTitle}>{title}</strong>
        <span className={styles.chartSummary}>{textSummary}</span>
        <span className={styles.chartSummary}>期間: {period}／単位: {unit}</span>
      </figcaption>
      <ul className={styles.chartList} aria-label={title}>
        {pointValues.map((point) => (
          <li key={point.key} className={styles.chartRow}>
            <span className={styles.chartLabel}>{point.label}</span>
            <meter min={0} max={max} value={point.value} aria-label={`${point.label} ${point.valueLabel}`} />
            <strong className={styles.chartValue}>{point.valueLabel}</strong>
          </li>
        ))}
      </ul>
    </figure>
  );
}
