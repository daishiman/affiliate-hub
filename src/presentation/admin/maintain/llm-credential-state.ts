/**
 * 生成 AI の鍵の画面が持つ状態。
 *
 * `llm-credential-action.ts` から分けてあるのは、`"use server"` のファイルが
 * 非同期の関数しか外へ出せないため（`tests/architecture/server-action-exports.test.ts`）。
 *
 * --- 値を持つ欄が無い ---
 * 入力した API キーを載せる欄をこの型に作らない。
 * 一度でも画面の状態へ載せると、そこから戻る道（再表示・再送信・履歴）が生まれる。
 * 出るのは末尾 4 文字だけで、それも保管庫が返した要約から取る。
 */
export type LlmCredentialState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  /** どの欄が原因か。分かるときだけ入る。 */
  readonly field?: string;
};

export const INITIAL_LLM_CREDENTIAL_STATE: LlmCredentialState = {
  status: "idle",
  message: "",
};
