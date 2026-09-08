/**
 * ブログ運用の画面がフォームから受け取る答え。
 *
 * `*-action.ts` から分けてあるのは、`"use server"` のファイルが非同期の関数しか
 * 外へ出せないため（`tests/architecture/server-action-exports.test.ts`）。
 *
 * 6 つの口（つながり・版面・配信・記事・固定ページ・タグ）で同じ形を使う。
 * 画面ごとに違う形を作ると、`FormResult` の出し方が 6 通りに割れる。
 */
import type { AdminActionState } from "../use-case-result";

export type BlogOpsState = AdminActionState & {
  /** 保存競合を通常の入力エラーと区別し、端末下書きを残すための機械判定値。 */
  readonly errorCode?: string;
  /** 記事保存が成功した直後の版番。次の保存の expectedRevision に使う。 */
  readonly revision?: number;
  /**
   * サーバーが保存へ使った時刻。端末時計ではなくこの値を「保存済み」に出す。
   *
   * 端末下書きの保存時刻（`useDraft` の `draftSavedAt`）や、読者が「気になる」を
   * 押した時刻（`ShortlistItem.shortlistedAt`）と同じ `savedAt` という名前だったため、
   * どの時刻を出しているのか読んで分からなかった。名前で意味を分ける。
   */
  readonly persistedAt?: string;
};

export const INITIAL_BLOG_OPS_STATE: BlogOpsState = { status: "idle", message: "" };
