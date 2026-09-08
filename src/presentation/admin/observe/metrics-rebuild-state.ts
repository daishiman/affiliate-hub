import type { AdminActionState } from "../use-case-result";

/**
 * 日次集計のやり直し欄の状態。
 *
 * `metrics-rebuild-action.ts` から分けてあるのは、`"use server"` のファイルが
 * 非同期の関数しか外へ出せないため（`tests/architecture/server-action-exports.test.ts`）。
 *
 * 中身は共通の `AdminActionState` そのままで、この操作に固有の追加値は無い。
 * それでも別名を置いてあるのは、form と action が同じ型を指していることを
 * 名前で示すためで、後から「やり直した日」などを足すときの置き場所にもなる。
 */
export type MetricsRebuildState = AdminActionState;

export const INITIAL_METRICS_REBUILD_STATE: MetricsRebuildState = {
  status: "idle",
  message: "",
};
