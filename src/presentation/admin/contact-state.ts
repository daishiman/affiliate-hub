/**
 * 読者からの問い合わせの画面が持つ状態。
 *
 * `contact-action.ts` から分けてあるのは、`"use server"` のファイルが
 * 非同期の関数しか外へ出せないため（`tests/architecture/server-action-exports.test.ts`）。
 */

/** 対応済みの印を付けた / 外したときの結果。 */
export type ContactHandledState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  /** どの欄が原因か。分かるときだけ入る。 */
  readonly field?: string;
};

export const INITIAL_CONTACT_HANDLED_STATE: ContactHandledState = {
  status: "idle",
  message: "",
};
