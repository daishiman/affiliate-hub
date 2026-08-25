import type { GuidelineReference } from "@/domain/seo/guideline-reference";
import type { WorkspaceId } from "@/domain/shared";
import type { PortResult } from "./common";

/**
 * SEO/AI 検索ガイドラインの参照レジストリの保存口。
 *
 * --- Editorial のポートに混ぜない理由 ---
 * 出典レジストリは運営側 (管理画面) の台帳で、読者側の記事表示とは
 * 読む人も更新の頻度も違う。読者側のポートへ足すと、読者ページの
 * 組み立てがこの台帳の都合 (保存先の有無) に引きずられる。
 *
 * --- 口を 3 つに絞る理由 ---
 * 受入条件が求めるのは「登録・一覧・再確認 (確認日の更新)」だけである。
 * 削除の口を先回りで作らない。出典は「消す」より「古いと分かる」ほうが
 * 大事で、90 日判定 (`referenceReviewStatus`) が古さを画面に出す。
 */
export type GuidelineReferencePort = {
  list(workspaceId: WorkspaceId): PortResult<readonly GuidelineReference[]>;

  /** 登録。`reference.id` は呼び出し側 (usecase) が採番して渡す。 */
  add(input: {
    readonly workspaceId: WorkspaceId;
    readonly reference: GuidelineReference;
  }): PortResult<GuidelineReference>;

  /**
   * 確認日だけを書き換える。タイトルや URL は動かさない。
   * 「再確認した」という操作を、出典の書き換えと同じ口にすると、
   * 再確認のつもりで URL を消す事故が型の上で可能になる。
   */
  updateCheckedAt(input: {
    readonly workspaceId: WorkspaceId;
    readonly id: string;
    readonly checkedAt: string;
  }): PortResult<GuidelineReference>;
};
