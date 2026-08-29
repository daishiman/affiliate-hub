/**
 * ブログ運用の画面がフォームから受け取る答え。
 *
 * `*-action.ts` から分けてあるのは、`"use server"` のファイルが非同期の関数しか
 * 外へ出せないため（`tests/architecture/server-action-exports.test.ts`）。
 *
 * 6 つの口（つながり・版面・配信・記事・固定ページ・タグ）で同じ形を使う。
 * 画面ごとに違う形を作ると、`FormResult` の出し方が 6 通りに割れる。
 */
import type { AdminActionState } from "./use-case-result";

export type BlogOpsState = AdminActionState;

export const INITIAL_BLOG_OPS_STATE: BlogOpsState = { status: "idle", message: "" };
