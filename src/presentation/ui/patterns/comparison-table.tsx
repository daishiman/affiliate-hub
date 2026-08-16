import { UI_COPY } from "../copy";
import { EmptyView } from "../primitives/state-view";
import { FactualityBadge, type Factuality } from "./factuality";
import { ProvenanceNote } from "./evidence";
import styles from "./patterns.module.css";

/**
 * 比較表。
 *
 * 列を足すのが最も多い変更なので、**列は配列で受け取る**。
 * 列ごとに JSX を書く形にすると、列の追加でコードを触る箇所が
 * 「見出し・本体・スマホ表示」の 3 箇所に散る。
 *
 * セルは値だけでなく、事実区分と確認日時を持てる。
 * 「この数値はどこから来たのか」を表の中で答えられるようにするため。
 */

export type ComparisonColumn = {
  readonly key: string;
  readonly label: string;
  /** 数値列は右寄せ + 等幅数字にする。 */
  readonly numeric?: boolean;
  /** 単位。ヘッダに出す（セルごとに書くと表が読みにくくなる）。 */
  readonly unit?: string;
};

export type ComparisonCell = {
  readonly value: string;
  /** 根拠の有無。未指定なら区分を出さない（仕様外の列＝商品名など）。 */
  readonly factuality?: Factuality;
  readonly checkedAt?: string;
};

export type ComparisonRow = {
  readonly id: string;
  /** 行の見出し。通常は商品名。 */
  readonly label: string;
  readonly cells: Readonly<Record<string, ComparisonCell>>;
};

export function ComparisonTable({
  caption,
  columns,
  rows,
  emptyAction,
}: {
  readonly caption: string;
  readonly columns: readonly ComparisonColumn[];
  readonly rows: readonly ComparisonRow[];
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
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{UI_COPY.ranking.productColumn}</th>
            {columns.map((col) => (
              <th key={col.key} scope="col" className={col.numeric === true ? styles.numeric : ""}>
                {col.label}
                {col.unit !== undefined && (
                  <span className={styles.evidenceMeta}>（{col.unit}）</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.label}</th>
              {columns.map((col) => {
                const cell = row.cells[col.key];
                return (
                  <td key={col.key} className={col.numeric === true ? styles.numeric : ""}>
                    {/* 値が無い列は空白にせず「—」を出す。空白は入力漏れと見分けが付かない。 */}
                    {cell === undefined ? "—" : cell.value}
                    {cell?.factuality !== undefined && (
                      <>
                        {" "}
                        <FactualityBadge kind={cell.factuality} />
                      </>
                    )}
                    {cell?.checkedAt !== undefined && <ProvenanceNote checkedAt={cell.checkedAt} />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
