import type { ReactNode } from "react";
import styles from "./patterns.module.css";

/**
 * 名前の付いた列を並べるだけの表。
 *
 * `RankingTable` / `ComparisonTable` は「順位」「比較」という中身を知っている
 * 専用の表だが、これは中身を知らない。管理画面が並べている表の大半は、
 * 順位でも比較でもない「一覧」なので、そのための器がひとつも無かった。
 *
 * **作った理由は 2 つだけ。** 見た目を揃えることではない（それは
 * `.table` の共有クラスでも足りる）。生タグでは守れないものが 2 つあり、
 * それを型で守れるようにするために作った。
 *
 * 1. **寄せは列の性質であって、セルの性質ではない。**
 *    `.numeric` をセルに付ける形だと、書くたびに `thead` と `tbody` の
 *    2 箇所へ手で付けることになる。2026-08-21 の実測では、管理画面で
 *    数値列を持つ 18 ファイルのうち**両方に付いていたのは 2 つだけ**で、
 *    残り 16 は値が右寄せ・見出しが左寄せのままだった。誰の不注意でもない。
 *    宣言する場所が 2 つある形が、そうなることを要求していた。
 *    だから `align` は列にしか書けず、**呼び出し側から寄せのクラスを
 *    触る道は開けていない**（`className` を受け取らないのはそのため）。
 * 2. **`caption` を省略できないようにする。** 実測では 34 の表のうち
 *    `caption` を持つのは 13 で、しかも同じファイルの中で揃っていなかった
 *    （`tools` は 4 つのうち 1 つ、`writing` は 5 つのうち 1 つ）。
 *    省略できるから揃わない。だから必須にしてある。
 *
 * **0 件のときの見せ方は持たない。** `empty` という口ごと開けていない。
 * 任意にすると「あるなら埋めよう」で既定文が生え、いま画面ごとに出している
 * 固有の文（多くはサーバから来た `emptyReason`）がそれに置き換わる。
 * また、この表を使う箇所の半分近くは定数から作る定義表で **0 件が起きない**。
 * そこへ `empty` を要求すると、起きない事態の文言を書かせることになる。
 * 0 件の分岐は、0 件が何を意味するかを知っている呼び出し側に置く。
 *
 * **行の中の操作も仕組みを持たない。** 実測で行内に操作が入るのは 34 のうち
 * 4 箇所だけで、いずれも `<Link>` を素で置いているだけだった。
 * セルが `ReactNode` を返せる以上、それで足りる。
 *
 * **通していない表が 2 つある。**「入れ忘れ」ではなく、外す判断をした。
 *
 * - `src/app/admin/content/matrix/page.tsx` の交差表は、**列が実行時に決まる**
 *   （出し先の媒体の数だけ列が増える）。ここを通すには `columns` を
 *   「配列 または 行から列を作る関数」にする必要があり、1 箇所のために
 *   全体の型を緩めることになる。
 * - `src/app/admin/feedback/page.tsx` の一覧は、**`<form>` の中にあり**、
 *   選択列のチェックボックスが送信の入力そのものになっている（送信ボタンは
 *   表の外・form の内）。表が form の一部である形は、表の器の責務ではない。
 *
 * この 2 つを通したくなったときは、`columns` を緩める前に
 * **なぜ 2 つだけ外れているのか**をもう一度読むこと。
 *
 * ---
 *
 * **狭い画面では積まずに横へ流す。**`.rankTable` は `@media (width < 48rem)` で
 * 表を積み、`thead` を `display: none` にしていた。そこに書かれた理由は
 * 「横スクロールで隠れる列を作らない」——**隠れた列に気づけない**ことを
 * 嫌ったものである。この部品はその決定を引き継がない。理由を書く。
 *
 * 積む形は `thead` を消すことと一体で、列の名前そのものを失う。
 * 隠れた列は横へ流せば出てくるが、**名前を失った値は、何の値だったかを
 * 復元する手立てが画面上に無い**。隠れていることすら分からない形で、
 * 元の決定が嫌ったものをより強く実現していた。列が 2〜3 で値が
 * 自己説明的なうちは成立するが、実測の列数は最大 8（`admin/ai-usage`）で、
 * そこでは**ラベルを失った数字が 8 個縦に並ぶ**。
 *
 * ただし横へ流すには条件がある。`overflow-x: auto` の器は、
 * **`tabindex` が無いとキーボードでスクロールできない**。
 * だから器に `tabindex` と `role="group"`（`region` ではない理由は下）を持たせ、
 * `caption` をそのラベルにする。スクロールが要るかは画面幅で決まり
 * サーバでは決まらないので、要否で出し分けず常に持たせる。
 *
 * この判断のために `caption` の型を `ReactNode` から `string` へ狭めた
 * （`aria-label` は文字列しか取れない）。結果として
 * 「`caption` にリンクやバッジを入れて第 2 の本文にする」道も閉じた。
 *
 * なお `ComparisonTable` は、この部品と同じ骨（列の配列・寄せは列の属性・
 * `caption` 必須）を先に持っている。将来この 2 つを重ねるなら、
 * `ComparisonTable` 側にある「事実区分」「確認日時」「0 件の既定文」を
 * どう外へ出すかが論点になる。
 */

/** 列の寄せ。既定は文章向けの行頭寄せ。 */
export type DataTableAlign = "start" | "numeric";

export type DataTableColumn<Row> = {
  /** React の key と、列を見分けるための名前。 */
  readonly key: string;
  readonly header: ReactNode;
  /**
   * `numeric` は右寄せ + 等幅数字。
   * **見出しと値の両方に当たる。**片方だけに当てる道は開けていない。
   */
  readonly align?: DataTableAlign;
  /**
   * この列を `<th scope="row">` にする。行の中で 1 つだけ立てること。
   * 支援技術が「この行は何の行か」を読み上げる手掛かりになる。
   */
  readonly rowHeader?: boolean;
  readonly cell: (row: Row) => ReactNode;
};

export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
}: {
  /**
   * 何の表かを 1 文で。省略はできない（上の doc コメントの理由 2）。
   * **文字列に限る。**横へ流す器のラベル（`aria-label`）に同じものを使うため。
   */
  readonly caption: string;
  readonly columns: readonly DataTableColumn<Row>[];
  readonly rows: readonly Row[];
  /** 行の識別子。並べ替えても React が行を取り違えないようにするため。 */
  readonly rowKey: (row: Row) => string;
}) {
  return (
    // `tabIndex` はキーボードで横へ流すために要る（マウスの無い人が
    // 隠れた列へ届かなくなる）。`role` は、名前の付いていない `div` に
    // `aria-label` を書いても支援技術が読まないため。
    //
    // **`region` ではなく `group`。**最初 `region` にしたところ、
    // `admin/personas` で axe の `landmark-unique` が出た。繰り返しの中に
    // 表が並ぶ画面では caption が同じになり、同名の目印が行の数だけ増える。
    // そもそも表のスクロール器は「ページの主要な領域」ではないので、
    // 表が 5 つある画面（`admin/generation`）で目印を 5 つ増やすのは、
    // 目印の一覧を頼りに動く人にとって騒音でしかない。
    // `group` は名前を持てて、目印の一覧には出ない。
    <div className={styles.tableWrap} role="group" aria-label={caption} tabIndex={0}>
      <table className={styles.table}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={col.align === "numeric" ? styles.numeric : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col) => {
                const className = col.align === "numeric" ? styles.numeric : undefined;
                return col.rowHeader === true ? (
                  <th key={col.key} scope="row" className={className}>
                    {col.cell(row)}
                  </th>
                ) : (
                  <td key={col.key} className={className}>
                    {col.cell(row)}
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
