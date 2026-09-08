/**
 * 比較表の枠。**中身の描き方だけを差し替える。**
 *
 * 読む側 (`prose-body`) は文字を置き、書く側 (`prose-editor`) は入力欄を置く。
 * 違うのはそこだけで、`div > table > thead > tr > th …` の骨組みは同じである。
 * 骨組みを両方に書くと、横に流す包み (`proseTableScroll`) を片方だけ直した日に、
 * もう片方の表だけがページごと横へ動く——**読者から見て「記事によって挙動が違う」**
 * になる。
 *
 * `tests/ui/uiux-duplicate-implementation.test.ts` はこの写しを数えている。
 * 枠を 1 か所にしたのは検査を黙らせるためではなく、直す場所を 1 つにするためである。
 */

import type { ReactNode } from "react";
import styles from "./prose.module.css";

export type ProseTableFrameProps = {
  readonly columnCount: number;
  readonly rowCount: number;
  /** `col` 列目の見出しの中身。 */
  readonly renderHeaderCell: (col: number) => ReactNode;
  /** `row` 行 `col` 列の中身。 */
  readonly renderCell: (row: number, col: number) => ReactNode;
};

/** 0..n-1 の並び。`key` は順序そのものなので、添字をそのまま使う。 */
function range(count: number): readonly number[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => i);
}

export function ProseTableFrame({
  columnCount,
  rowCount,
  renderHeaderCell,
  renderCell,
}: ProseTableFrameProps) {
  /*
    **横に溢れる表は、表の中だけで横に流す。**ページごと横に動くと、
    読者は本文の行を見失う。狭い画面で表を持つ記事は珍しくない。
  */
  return (
    <div className={styles.proseTableScroll}>
      <table className={styles.proseTable}>
        <thead>
          <tr>
            {range(columnCount).map((col) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 列は順序が同一性
              <th key={col} scope="col">
                {renderHeaderCell(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {range(rowCount).map((row) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 行は順序が同一性
            <tr key={row}>
              {range(columnCount).map((col) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: 桁は順序が同一性
                <td key={col}>{renderCell(row, col)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
