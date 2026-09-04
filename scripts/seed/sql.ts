/**
 * 見本データを SQL の字面へ移すときの、共通のごく小さい道具。
 *
 * 分けてあるのは**引用符の付け方を 1 か所に留める**ため。
 * 種を足すたびに各ファイルで `q` を書き直すと、片方だけ `'` の
 * 二重化を忘れた日に、SQL としては通るが値が壊れた行が入る。
 */

/** SQLite の文字列。`'` を 2 つ重ねる以外の細工をしない。 */
export function q(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** `daysAgo` 日前の秒。`base` は基準になる現在時刻（秒）。 */
export function seconds(daysAgo: number, base: number): number {
  return base - daysAgo * 24 * 60 * 60;
}

/** SQL に置く数値または `NULL`。 */
export function num(value: number | null): string {
  return value === null ? "NULL" : String(value);
}

/** SQL に置く文字列または `NULL`。 */
export function text(value: string | null): string {
  return value === null ? "NULL" : q(value);
}
