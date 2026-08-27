/**
 * ブログの固定文書（運営者情報・各方針・規約・特商法表記）の画面が持つ状態。
 *
 * `site-document-action.ts` から分けてあるのは、`"use server"` のファイルが
 * 非同期の関数しか外へ出せないため（`tests/architecture/server-action-exports.test.ts`）。
 */
export type SiteDocumentState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  /** どの欄が原因か。分かるときだけ入る。 */
  readonly field?: string;
};

export const INITIAL_SITE_DOCUMENT_STATE: SiteDocumentState = {
  status: "idle",
  message: "",
};
