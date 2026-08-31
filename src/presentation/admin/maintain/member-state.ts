/**
 * 担当者の招待・役割の変更・担当の取り消しを行う画面が持つ状態。
 *
 * `member-action.ts` から分けてあるのは、`"use server"` のファイルが
 * 非同期の関数しか外へ出せないため（`tests/architecture/server-action-exports.test.ts`）。
 *
 * --- 招待したアドレスは、この型に残さない ---
 * 断るときも、入力されたアドレスを状態へ写して欄に戻すことはしない。
 * 戻すと、共有の端末で開きっぱなしの画面に他人のアドレスが残り続ける。
 * 出るのは「何が起きたか」の文だけである。
 */
export type MemberState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  /** どの欄が原因か。分かるときだけ入る。 */
  readonly field?: string;
};

export const INITIAL_MEMBER_STATE: MemberState = {
  status: "idle",
  message: "",
};
