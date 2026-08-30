import type { AdminActionState } from "../use-case-result";

/**
 * 商品を登録する・直す操作の画面の状態。
 *
 * `product-form-action.ts` から分けてあるのは
 * `schedule-publication-state.ts` と同じ理由で、`"use server"` を付けたファイルは
 * **非同期の関数しか外へ出せない**（型も初期値も置けない）。
 *
 * 登録と修正で 1 つの型にしてある。画面は 2 枚だが、押した後に知りたいことは
 * 「通ったか」「どの欄が悪いか」「どこへ行けるか」の 3 つで同じである。
 * 型を分けると、片方にだけ項目が増える。
 */

export type ProductFormState = AdminActionState & {
  /** できた（直した）商品を見に行く先。成功したときだけ入る。 */
  readonly productPath?: string;
  /**
   * この商品を主題にしている記事の本数。修正のときだけ入る。
   *
   * 断りではない。**直した内容がこの本数の記事に及ぶ**という知らせで、
   * 0 件なら黙っている（0 と書くと、何かの警告に見える）。
   */
  readonly referencingArticles?: number;
};

export const INITIAL_PRODUCT_FORM_STATE: ProductFormState = { status: "idle", message: "" };

/**
 * 仕様欄の書式。**1 行 1 項目、コロンで区切る。**
 *
 * 表を画面に組ませない理由は、比較表の列は分野ごとに数も名前も違うため。
 * 欄を固定すると、その分野にしか使えない画面になる。
 * 行を足すボタンも置かない（置くと、何行目を消したかで迷う）。
 */
export function parseSpecifications(text: string): {
  readonly values: Record<string, string | number>;
  readonly badLine: string | null;
} {
  const values: Record<string, string | number> = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    const at = line.indexOf(":");
    if (at <= 0 || at === line.length - 1) return { values, badLine: line };
    const key = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim();
    if (key === "" || value === "") return { values, badLine: line };
    // 数に見えるものは数にする。比較表で大小を並べるのは数のときだけ。
    const asNumber = Number(value);
    values[key] = value !== "" && Number.isFinite(asNumber) ? asNumber : value;
  }
  return { values, badLine: null };
}

/** 保存済みの仕様を、上の書式へ戻す。修正の画面の初期値に使う。 */
export function formatSpecifications(
  specs: Readonly<Record<string, string | number>>,
): string {
  return Object.entries(specs)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}
