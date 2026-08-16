/**
 * 共有カーネル (shared kernel)。
 *
 * ここに置いてよいもの:
 *   ID / 時刻 / 情報の由来 / 金額 / 結果型 / エラー型 / テナント境界 /
 *   Editorial-Commercial の印
 *
 * ここに置いてはいけないもの:
 *   商品の評価軸・ランキングの重み・記事構成・媒体ごとの制約・ASP固有の規則。
 *   これらは特定のコンテキストの言葉であり、共有カーネルへ置くと
 *   全コンテキストが 1 つの変更で壊れるようになる。
 */
export * from "./tagged";
export * from "./clock";
export * from "./data-classification";
export * from "./domain-events";
export * from "./errors";
export * from "./ids";
export * from "./money";
export * from "./provenance";
export * from "./result";
export * from "./tenancy";
