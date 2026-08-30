/**
 * 「成果の金額を直す」操作の画面の状態。
 *
 * `adjust-conversion-action.ts` から分けてあるのは
 * `content-progress-state.ts` と同じ理由で、`"use server"` を付けた
 * ファイルは**非同期の関数しか外へ出せない**（型も初期値も置けない）。
 */

export type AdjustConversionState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  /** どの欄が原因か。欄の下に出す。締め済みなど欄に紐づかない断りは入らない。 */
  readonly field?: string;
};

export const INITIAL_ADJUST_CONVERSION_STATE: AdjustConversionState = {
  status: "idle",
  message: "",
};
