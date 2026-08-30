/**
 * 改善ループの操作画面の状態。
 *
 * `improvement-action.ts` から分けてある理由は `fact-boundary-state.ts` と同じ
 * （`"use server"` のファイルからは非同期の関数だけを外へ出す、という決まり。
 * `tests/architecture/server-action-exports.test.ts` が機械で見ている）。
 */

export type ImprovementFormState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  /** どの欄が原因か。欄の下に出す。 */
  readonly field?: string;
};

export const INITIAL_IMPROVEMENT_STATE: ImprovementFormState = {
  status: "idle",
  message: "",
};
