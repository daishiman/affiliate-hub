/**
 * 広告表記と表記のきまりの画面が持つ状態。
 *
 * `compliance-action.ts` から分けてあるのは、`"use server"` のファイルが
 * 非同期の関数しか外へ出せないため（`tests/architecture/server-action-exports.test.ts`）。
 */
export type ComplianceState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  /** どの欄が原因か。分かるときだけ入る。 */
  readonly field?: string;
};

export const INITIAL_COMPLIANCE_STATE: ComplianceState = {
  status: "idle",
  message: "",
};
