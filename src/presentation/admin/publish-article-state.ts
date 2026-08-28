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
  /**
   * 直前に何をしたか。
   *
   * **`status` だけでは足りない。** 点検も公開も成功すれば `done` になるが、
   * 記事が読者に出たかどうかは正反対である。画面側で `url` の有無から
   * 言い当てさせない（点検の結果に url が付いた日に、全部の判定が狂う）。
   */
  readonly phase?: "published" | "checked";
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
   * AI 検索への備えの点検（REQ-SEO03）。
   *
   * 結論・要点・よくある質問・出典・更新日という**表現ブロックの有無**と、
   * 書き手・説明文の長さを見る。判定の元は
   * `expressionBlocksOf()` の射影で、読者に実際に出たものと同じ
   * （`docs/product/design-decisions.md` §6）。
   *
   * 出るのは 2 つの場面。
   *   - 「公開前に点検する」を押したとき（`phase: "checked"`）。
   *     **まだ何も出ていない**ので、直してから出せる。
   *   - 公開したあと（`phase: "published"`）。読者と同じ読み取り口から
   *     読み直して測る。読み直せなかったときは undefined（推測で出さない）。
   *
   * どちらも**公開の条件ではない**。構造が弱くても記事は出る。
   * 止めるのは表現のきまり（`evaluatePublishGate`）の役目で、
   * あちらは法令と根拠に関わる。
   */
  readonly aiSearch?: readonly AiSearchCheck[];
};

export const INITIAL_PUBLISH_ARTICLE_STATE: PublishArticleFormState = {
  status: "idle",
  message: "",
};
