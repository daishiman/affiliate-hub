/**
 * 改善要望の画面が持つ状態。
 *
 * `feedback-action.ts` から分けてあるのは、`"use server"` のファイルが
 * 非同期の関数しか外へ出せないため（`tests/architecture/server-action-exports.test.ts`）。
 *
 * どの状態にも `message` を必ず持たせる。押したあと何も変わらない画面を作らないため、
 * 「成功」も「失敗」も同じ場所に文が出る形にしてある。
 */

/** 対応状況・扱いを変えたときの結果。 */
export type FeedbackStatusState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  /** どの欄が原因か。分かるときだけ入る。 */
  readonly field?: string;
};

export const INITIAL_FEEDBACK_STATUS_STATE: FeedbackStatusState = {
  status: "idle",
  message: "",
};

/**
 * 払い出しの結果。
 *
 * 渡せた分と渡せなかった分を**両方**返す。渡せなかったものを黙って落とすと、
 * 一覧で選んだ件数と手元に出た件数が食い違い、どれが抜けたか分からなくなる。
 */
export type FeedbackHandoffState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  readonly prompts: readonly {
    readonly reportId: string;
    readonly text: string;
    readonly templateVersion: string;
  }[];
  readonly skipped: readonly { readonly reportId: string; readonly reason: string }[];
  /** 何度押しても同じ文面が出ることの説明。domain が持つ文をそのまま運ぶ。 */
  readonly idempotencyText: string;
  /** 下読みだけで、渡した記録は残していない状態か。 */
  readonly previewOnly: boolean;
};

export const INITIAL_FEEDBACK_HANDOFF_STATE: FeedbackHandoffState = {
  status: "idle",
  message: "",
  prompts: [],
  skipped: [],
  idempotencyText: "",
  previewOnly: false,
};

/** 取得用の鍵を操作したときの結果。 */
export type IntegrationAccessState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  readonly field?: string;
  /**
   * 発行したときだけ入る平文。**この 1 回しか出ない。**
   * 画面はこれを控えるよう促すだけで、どこにも保存しない。
   */
  readonly issuedValue: string | null;
};

export const INITIAL_INTEGRATION_ACCESS_STATE: IntegrationAccessState = {
  status: "idle",
  message: "",
  issuedValue: null,
};
