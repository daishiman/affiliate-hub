import { UI_COPY, fill } from "../copy";
import { EmptyView } from "../primitives/state-view";
import styles from "./patterns.module.css";

/**
 * 順位の表示と、評価基準の開示。
 *
 * 仕様の中核が 2 つある。
 *   1. 順位は採点表から機械的に決まる。**画面で並べ替えない。**
 *      → props は「並んだ結果」だけを受け取る。並べ替えの関数を持たない。
 *   2. 報酬額は順位の入力にしない。
 *      → 行の型に報酬・単価の欄が無い。渡そうとすると型エラーになる。
 *
 * 選外（除外した商品）も理由つきで出す。黙って消すと、
 * 「なぜこの商品が無いのか」が誰にも分からなくなる。
 */

export type RankingRow = {
  readonly productId: string;
  readonly rank: number;
  readonly productName: string;
  /** 総合点。採点表から算出済みの値を受け取る。 */
  readonly totalScore: number;
  /** 評価軸ごとの点。criteria と同じ並び。 */
  readonly criterionScores: readonly number[];
};

export type CriterionView = {
  readonly key: string;
  readonly label: string;
  /** 重み。合計が 1 になる想定だが、表示は受け取った値をそのまま出す。 */
  readonly weight: number;
  /** どう測ったか。開示の中核。 */
  readonly measurement: string;
};

export type ExcludedProduct = {
  readonly productId: string;
  readonly productName: string;
  /** なぜ選外にしたか。必須。 */
  readonly reason: string;
};

export function RankingTable({
  caption,
  criteria,
  rows,
  excluded = [],
  updatedAt,
  emptyAction,
}: {
  /** この表が何の順位かの 1 文。表だけ見て分かるようにする。 */
  readonly caption: string;
  readonly criteria: readonly CriterionView[];
  readonly rows: readonly RankingRow[];
  readonly excluded?: readonly ExcludedProduct[];
  readonly updatedAt: string;
  readonly emptyAction?: React.ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <EmptyView
        title={UI_COPY.state.emptyTitle}
        body={UI_COPY.state.emptyBodyFallback}
        action={emptyAction}
      />
    );
  }

  return (
    <div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption>
            {caption}（{UI_COPY.ranking.updatedAt}: {updatedAt}）
          </caption>
          <thead>
            <tr>
              <th scope="col">{UI_COPY.ranking.rankColumn}</th>
              <th scope="col">{UI_COPY.ranking.productColumn}</th>
              <th scope="col">{UI_COPY.ranking.totalScoreColumn}</th>
              {criteria.map((c) => (
                <th key={c.key} scope="col">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.productId}>
                <td className={styles.rank}>{row.rank}</td>
                <th scope="row">{row.productName}</th>
                <td className={styles.numeric}>{row.totalScore}</td>
                {criteria.map((c, i) => (
                  <td key={c.key} className={styles.numeric}>
                    {row.criterionScores[i] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CriteriaDisclosure criteria={criteria} />

      {excluded.length > 0 && (
        <div className={styles.criteria}>
          <span>{UI_COPY.ranking.excludedTitle}</span>
          <ul className={styles.evidenceList}>
            {excluded.map((item) => (
              <li key={item.productId} className={styles.excluded}>
                {item.productName} — {UI_COPY.ranking.excludedReasonLabel}: {item.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * 評価基準の開示。順位表と必ずセットで出す。
 * 「どう測ったか」を出さない順位は、読者から見て根拠が無い。
 */
export function CriteriaDisclosure({ criteria }: { readonly criteria: readonly CriterionView[] }) {
  return (
    <div className={styles.criteria}>
      <span>{UI_COPY.ranking.criteriaTitle}</span>
      {criteria.map((c) => (
        <div key={c.key} className={styles.criteriaRow}>
          <span>{c.label}</span>
          <span className={styles.criteriaWeight}>
            {fill("{label} {weight}", {
              label: UI_COPY.ranking.criterionWeight,
              weight: c.weight,
            })}
          </span>
          <span className={styles.evidenceMeta}>
            {UI_COPY.ranking.criterionMeasurement}: {c.measurement}
          </span>
        </div>
      ))}
      {/* 報酬を順位に使っていないことは、順位を出す画面すべてで明示する。 */}
      <span>{UI_COPY.disclosure.rankingNote}</span>
    </div>
  );
}
