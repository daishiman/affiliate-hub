/**
 * Product Feedback コンテキスト（10 番目の境界）。
 *
 * 外からはこの入口だけを使う。ファイルを直接指さないことで、
 * 中の分け方を変えても外側が壊れない。
 *
 * 依存は **feedback → analytics/loop-kinds の一方向**。
 * 逆向き（Analytics が要望を知る）を作らない。作ると指標の集計に人の声が混ざる。
 */
export * from "./capture-policy";
export * from "./disposition";
export * from "./diagnostics";
export * from "./diagnostics-retention";
export * from "./handoff";
export * from "./handoff-prompt";
export * from "./integration-access";
export * from "./report";
export * from "./status";
