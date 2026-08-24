/**
 * 「いまサイトに出す」操作の画面の状態。
 *
 * `publish-article-action.ts` から分けてある理由は
 * `schedule-publication-state.ts` と同じで、`"use server"` を付けたファイルは
 * **非同期の関数しか外へ出せない**（型も初期値も置けない）。
 */

import type { AiSearchCheck } from "@/application/seo/ai-search-audit";

export type PublishArticleFormState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  /** どの欄が原因か。欄の下に出す。 */
  readonly field?: string;
  /** 読者が開く URL。成功したときだけ入る。 */
  readonly url?: string;
  /**
   * 検査できなかった項目。
   *
   * **隠さない。** 「出せた」とだけ伝えると、確かめられていないことまで
   * 確かめたことになる。出したうえで、何が未確認かを画面に残す。
   */
  readonly skipped?: readonly { readonly label: string; readonly reason: string }[];
  /**
   * AI 検索への備えの点検（結論・更新日・著者・出典・説明文の 5 つ）。
   *
   * 公開の**後**に、読者と同じ読み取り口から読み直して測る。公開の条件では
   * ない——構造が弱くても記事は出る。出した直後が直す気になる唯一の瞬間
   * なので、ここで見せる。読み直せなかったときは undefined（推測で出さない）。
   */
  readonly aiSearch?: readonly AiSearchCheck[];
};

export const INITIAL_PUBLISH_ARTICLE_STATE: PublishArticleFormState = {
  status: "idle",
  message: "",
};
