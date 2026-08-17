/**
 * 「いまサイトに出す」操作の画面の状態。
 *
 * `publish-article-action.ts` から分けてある理由は
 * `schedule-publication-state.ts` と同じで、`"use server"` を付けたファイルは
 * **非同期の関数しか外へ出せない**（型も初期値も置けない）。
 */

export type PublishArticleFormState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  /** どの欄が原因か。欄の下に出す。 */
  readonly field?: string;
  /** 読者が開く URL。成功したときだけ入る。 */
  readonly url?: string;
  /**
   * 検査できなかった項目。
   *
   * **隠さない。** 「出せた」とだけ伝えると、確かめられていないことまで
   * 確かめたことになる。出したうえで、何が未確認かを画面に残す。
   */
  readonly skipped?: readonly { readonly label: string; readonly reason: string }[];
};

export const INITIAL_PUBLISH_ARTICLE_STATE: PublishArticleFormState = {
  status: "idle",
  message: "",
};
