/**
 * SEO/AI 指針の出典画面が持つ状態。
 *
 * `guideline-reference-action.ts` から分けてあるのは、`"use server"` のファイルが
 * 非同期の関数しか外へ出せないため（`tests/architecture/server-action-exports.test.ts`）。
 */
export type GuidelineReferenceState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  /** どの欄が原因か。分かるときだけ入る。 */
  readonly field?: string;
};

export const INITIAL_GUIDELINE_REFERENCE_STATE: GuidelineReferenceState = {
  status: "idle",
  message: "",
};
