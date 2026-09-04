/**
 * 「記事を次の段階へ進める」「承認する」操作の画面の状態。
 *
 * `content-progress-action.ts` から分けてあるのは
 * `schedule-publication-state.ts` と同じ理由で、`"use server"` を付けた
 * ファイルは**非同期の関数しか外へ出せない**（型も初期値も置けない）。
 */

export type ContentProgressState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  /**
   * どの欄が原因か。欄の下に出す。
   * 段階の指定が食い違ったとき（画面を開いたままだったとき）はここに入らないので、
   * 欄の下ではなく操作全体の断りとして出す。
   */
  readonly field?: string;
};

export const INITIAL_CONTENT_PROGRESS_STATE: ContentProgressState = {
  status: "idle",
  message: "",
};
