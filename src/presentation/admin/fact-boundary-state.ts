/**
 * 事実の範囲の確認画面の状態。
 *
 * `fact-boundary-action.ts` から分けてある理由は
 * `site-wizard-state.ts` と同じ（`"use server"` のファイルからは
 * 非同期の関数だけを外へ出す、という決まりに揃えるため）。
 * `tests/architecture/server-action-exports.test.ts` が機械で見ている。
 */

export type FactBoundaryCheckState = {
  readonly status: "idle" | "passed" | "flagged" | "failed";
  readonly message: string;
  readonly field?: string;
  /** 指摘 1 件ずつ。どこが問題かを本文の抜粋つきで出す。 */
  readonly findings: readonly { readonly excerpt: string; readonly message: string }[];
};

export const INITIAL_FACT_BOUNDARY_STATE: FactBoundaryCheckState = {
  status: "idle",
  message: "",
  findings: [],
};
