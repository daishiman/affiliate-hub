/**
 * ブログの固定文書（運営者情報・各方針・規約・特商法表記）の画面が持つ状態。
 *
 * `site-document-action.ts` から分けてあるのは、`"use server"` のファイルが
 * 非同期の関数しか外へ出せないため（`tests/architecture/server-action-exports.test.ts`）。
 */
import type { AdminActionState } from "../use-case-result";

/**
 * 形は管理画面の共通形そのまま。写して書くと、共通形に欄が 1 つ増えた日に
 * 写しの側だけが古いまま型が通り、画面に出ない断りが増える。
 */
export type SiteDocumentState = AdminActionState;

export const INITIAL_SITE_DOCUMENT_STATE: SiteDocumentState = {
  status: "idle",
  message: "",
};
