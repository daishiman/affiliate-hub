/**
 * 「この記事を出す」操作の画面の状態。
 *
 * `schedule-publication-action.ts` から分けてある理由は
 * `site-wizard-state.ts` と同じで、`"use server"` を付けたファイルは
 * **非同期の関数しか外へ出せない**（型も初期値も置けない）。
 */

export type SchedulePublicationState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  /** どの欄が原因か。欄の下に出す。 */
  readonly field?: string;
  /**
   * 同じ配信が既にあったか。
   *
   * これは失敗ではない。**2 回押しても 1 件のまま**という結果なので、
   * 赤い文字ではなく「すでに登録済みです」と伝える。
   */
  readonly alreadyExisted?: boolean;
  /** できた配信を見に行く先。成功したときだけ入る。 */
  readonly publicationPath?: string;
  /** 自動で投稿できない先のときの案内。 */
  readonly manualExportNotice?: string | null;
};

export const INITIAL_SCHEDULE_STATE: SchedulePublicationState = { status: "idle", message: "" };
