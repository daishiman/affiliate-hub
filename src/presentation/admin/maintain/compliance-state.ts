import type { AdminActionState } from "../use-case-result";

/**
 * 広告表記と表記のきまりの画面が持つ状態。
 *
 * `compliance-action.ts` から分けてあるのは、`"use server"` のファイルが
 * 非同期の関数しか外へ出せないため（`tests/architecture/server-action-exports.test.ts`）。
 *
 * 形は管理画面の共通 `AdminActionState` そのものなので、書き写さずに借りる。
 * 同じ形を各画面が別々に書くと、共通側へ欄を足した日に足し忘れが静かに残る
 * （`tests/presentation/admin-action-result.test.ts`）。
 */
export type ComplianceState = AdminActionState;

export const INITIAL_COMPLIANCE_STATE: ComplianceState = {
  status: "idle",
  message: "",
};
