import type { AdminActionState } from "./use-case-result";

/**
 * ブログの設計図を直す操作の画面の状態。
 *
 * `site-form-action.ts` から分けてあるのは `product-form-state.ts` と同じ理由で、
 * `"use server"` を付けたファイルは**非同期の関数しか外へ出せない**。
 */

export type SiteFormState = AdminActionState & {
  /** 直したブログを見に行く先。成功したときだけ入る。 */
  readonly sitePath?: string;
  /**
   * 実際に変わった項目の表示名。
   *
   * 「保存しました」だけだと、直したつもりの欄が本当に変わったのかが分からない。
   * 何も変わらなかったとき（同じ値を入れ直したとき）は空で返り、
   * 画面はそれを「変わりませんでした」と出す。
   */
  readonly changedLabels?: readonly string[];
};

export const INITIAL_SITE_FORM_STATE: SiteFormState = { status: "idle", message: "" };
