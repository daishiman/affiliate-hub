import type { AdminActionState } from "./use-case-result";

/**
 * 送信前の配信を直す操作の画面の状態。
 *
 * `publication-form-action.ts` から分けてあるのは
 * `schedule-publication-state.ts` と同じ理由で、`"use server"` を付けたファイルは
 * **非同期の関数しか外へ出せない**（型も初期値も置けない）。
 */

export type PublicationFormState = AdminActionState & {
  /** 直した配信を見に行く先。成功したときだけ入る。 */
  readonly publicationPath?: string;
  /** 自動で投稿できない先に変えたときの案内。 */
  readonly manualExportNotice?: string | null;
};

export const INITIAL_PUBLICATION_FORM_STATE: PublicationFormState = {
  status: "idle",
  message: "",
};
