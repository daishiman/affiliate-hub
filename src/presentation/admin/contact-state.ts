/**
 * 読者からの問い合わせの画面が持つ状態。
 *
 * `contact-action.ts` から分けてあるのは、`"use server"` のファイルが
 * 非同期の関数しか外へ出せないため（`tests/architecture/server-action-exports.test.ts`）。
 */

import type { AdminActionState } from "./use-case-result";

/**
 * 対応済みの印を付けた / 外したときの結果。
 *
 * 形は管理画面の共通形そのまま。同じ形を写して書かないのは、
 * 写した先だけが古い形のまま残る日が来るため（失敗の欄名を 1 つ足したとき、
 * 写しの側は型が通ってしまい、画面に出ない断りが増える）。
 */
export type ContactHandledState = AdminActionState;

export const INITIAL_CONTACT_HANDLED_STATE: ContactHandledState = {
  status: "idle",
  message: "",
};
