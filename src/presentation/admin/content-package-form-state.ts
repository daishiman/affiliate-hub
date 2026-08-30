import type { AdminActionState } from "./use-case-result";

/**
 * 企画を登録する欄の状態。
 *
 * `"use server"` の付いたファイルからは、非同期の関数以外を出せない。
 * 型と定数はここに置く（`persona-form-state.ts` と同じ理由）。
 */
export type ContentPackageFormState = AdminActionState & {
  /** 登録できたときだけ入る。一覧へ戻る導線をどこへ張るか。 */
  readonly packageListPath?: string;
};

export const INITIAL_CONTENT_PACKAGE_FORM_STATE: ContentPackageFormState = {
  status: "idle",
  message: "",
};
