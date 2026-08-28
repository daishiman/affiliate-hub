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
 * --- 口を絞る理由 ---
 * 用意するのは「登録・一覧・再確認 (確認日の更新)・原典取得の記録」だけである。
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

  /**
   * 原典の本文を取得したことを記録する。
   *
   * 保存するのは指紋 (sha256) と取得時刻だけで、**本文は保存しない**。
   * 写しを持つと、原典が更新された日から写しのほうが正本に見え始める。
   * 指紋なら「変わったか」は分かり、「何が書いてあるか」は原典を読ませられる。
   *
   * 直前の指紋は保存先が繰り上げる。呼び出し側に渡させると、
   * 前回値を知らない経路から呼ばれたときに履歴が黙って切れる。
   */
  recordSourceFetch(input: {
    readonly workspaceId: WorkspaceId;
    readonly id: string;
    readonly fetchedAt: string;
    readonly contentSha256: string;
    readonly checkedAt: string;
  }): PortResult<GuidelineReference>;

  /**
   * 画面で確認した本文版について、仕様の再評価を完了したことを記録する。
   * `expectedContentSha256` と保存中の最新版が一致するときだけ更新し、表示後に
   * 新しい本文が取得された競合で、未確認の版まで完了扱いにしない。
   */
  acknowledgeReevaluation(input: {
    readonly workspaceId: WorkspaceId;
    readonly id: string;
    readonly expectedContentSha256: string;
    readonly reEvaluatedAt: string;
  }): PortResult<GuidelineReference>;
};
