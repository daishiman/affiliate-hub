import type { AdminActionState } from "../use-case-result";

/**
 * 検索と AI からの見え方を操作したときの状態。
 *
 * `seo-aeo-action.ts` から分けてあるのは、`"use server"` のファイルからは
 * 非同期の関数だけを外へ出す、という決まりによる
 * （`tests/architecture/server-action-exports.test.ts` が機械で見ている）。
 *
 * 中身を書き足していないのは、この 3 つの操作が画面へ返すものが
 * 「できた／できなかった」と 1 文だけだからである。**足すものが無いときに
 * 自前の型を作らない。** 作ると、失敗の表し方が画面ごとに少しずつ違う形に育つ。
 */
export type SeoAeoFormState = AdminActionState;

export const INITIAL_SEO_AEO_STATE: SeoAeoFormState = {
  status: "idle",
  message: "",
};
