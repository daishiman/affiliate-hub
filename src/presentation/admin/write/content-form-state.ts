import type { AdminActionState } from "../use-case-result";

/**
 * 記事を作る・直す操作の画面の状態。
 *
 * `content-form-action.ts` から分けてあるのは `product-form-state.ts` と同じ理由で、
 * `"use server"` を付けたファイルは**非同期の関数しか外へ出せない**。
 */

export type ContentFormState = AdminActionState & {
  /** できた（直した）記事を見に行く先。成功したときだけ入る。 */
  readonly variantPath?: string;
  /**
   * 承認が外れたか。直したときだけ入る。
   *
   * 断りではない。**承認済みの文章を直すと承認は自動で外れる**という知らせで、
   * 外れていないときは黙っている。毎回出すと、外れた回の知らせが埋もれる。
   */
  readonly approvalCleared?: boolean;
};

export const INITIAL_CONTENT_FORM_STATE: ContentFormState = { status: "idle", message: "" };
