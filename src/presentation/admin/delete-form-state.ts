import type { AdminActionState } from "./use-case-result";

/**
 * 消す操作の結果。
 *
 * 消したものは戻せないので、`done` のときに戻り先を渡す。
 * 消えた物の詳細画面に留まると、次に押せるものが何も無い画面が残る。
 */
export type DeleteFormState = AdminActionState & {
  /** 消した後に見る場所（一覧）。 */
  readonly listPath?: string;
};

export const INITIAL_DELETE_FORM_STATE: DeleteFormState = { status: "idle", message: "" };
