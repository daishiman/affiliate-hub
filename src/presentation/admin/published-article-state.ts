import type { AdminActionState } from "./use-case-result";

/**
 * 公開済み記事を訂正・取り下げする欄の状態。
 *
 * `"use server"` の付いたファイルからは非同期の関数以外を出せないので、
 * 型と定数はここに置く（`affiliate-form-state.ts` と同じ理由）。
 *
 * **3 つの欄を自分で書き直さない。**`status` / `message` / `field` の組は
 * 管理画面の全 action で共通で、`AdminActionState` が 1 か所で持っている。
 * ここへ写すと、失敗の伝え方を変えた日にこの画面だけ古い形で残る
 * （`tests/presentation/admin-action-result.test.ts`）。
 */
export type PublishedArticleFormState = AdminActionState;

export const INITIAL_PUBLISHED_ARTICLE_STATE: PublishedArticleFormState = {
  status: "idle",
  message: "",
};
