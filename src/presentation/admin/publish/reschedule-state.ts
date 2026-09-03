/**
 * 投稿予定日の変更画面の状態。
 *
 * `reschedule-action.ts` から分けてある理由は
 * `site-wizard-state.ts` と同じ（`"use server"` のファイルからは
 * 非同期の関数だけを外へ出す、という決まりに揃えるため）。
 * `tests/architecture/server-action-exports.test.ts` が機械で見ている。
 */

export type RescheduleState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  readonly field?: string;
};

export const INITIAL_RESCHEDULE_STATE: RescheduleState = { status: "idle", message: "" };
