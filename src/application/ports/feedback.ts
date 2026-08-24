import type {
  CaptureSubmission,
  FeedbackReport,
  FeedbackStatus,
  IntegrationKey,
  KeyUsageRecord,
} from "@/domain/feedback";
import type { FeedbackCaptureId, IntegrationKeyId, WorkspaceId } from "@/domain/shared";
import type { PortResult } from "./common";

/**
 * 改善要望の保存先とのつなぎ目。
 *
 * すべての口が `workspaceId` を第一引数に取る。**省略できる形にしない。**
 * 省略できると、絞り忘れた 1 か所から他のワークスペースの要望が見える。
 * 画像に他社の画面が写り得る以上、ここは型で強制する価値がある。
 */
export type FeedbackRepositoryPort = {
  save(workspaceId: WorkspaceId, report: FeedbackReport): PortResult<true>;

  findById(workspaceId: WorkspaceId, id: string): PortResult<FeedbackReport | null>;

  /**
   * 一覧。絞り込みは重ねられる（状態 × 種類 × 画面 × 払い出しの有無）。
   * 指定しなかった条件は「絞らない」で、空配列とは区別する。
   */
  list(
    workspaceId: WorkspaceId,
    filter?: FeedbackFilter,
  ): PortResult<readonly FeedbackReport[]>;

  /**
   * 保持期限（`DIAGNOSTICS_RETENTION_DAYS`）を過ぎた技術診断を空にする。
   *
   * **要望そのものは消さない。** 消えるのは `technical_json` の中身だけで、
   * 本文・履歴・操作の記録・どの画面から届いたかは残る。
   *
   * 作業場所を引数に取るのは、他の口と同じ理由（絞り忘れた 1 か所が
   * 他社のデータを触ることになる）。**定期実行から全社ぶんを一括で消す口は
   * ここに置かない。** 置くと、画面や道具の側から「他所の分まで消す」入口が
   * できてしまう。作業場所を横断して回すのは infrastructure の
   * `purgeExpiredFeedbackDiagnostics` の仕事である。
   *
   * **何度呼んでも同じ結果になる。** すでに消してある行は数に入らない
   * （`purged` が 0 で返る）。`finished` が false のときは
   * 1 回の上限に達しただけで、続きは次の回が拾う。
   */
  purgeExpiredDiagnostics(
    workspaceId: WorkspaceId,
    now: Date,
  ): PortResult<{ readonly purged: number; readonly finished: boolean }>;
};

export type FeedbackFilter = {
  readonly statuses?: readonly FeedbackStatus[];
  readonly kinds?: readonly string[];
  readonly route?: string;
  /** 払い出し済みかどうか。指定しなければ両方。 */
  readonly handedOff?: boolean;
  /** 廃棄したものを含めるか。既定は含めない。 */
  readonly includeDiscarded?: boolean;
};

/**
 * 画面の写しの置き場。
 *
 * **焼き込み済みの 1 枚しか受け取らない。** 元画像と注釈を別々に置く口を作らない
 * （作れば、いつか「あとで重ねればよい」で使われ、黒塗りが隠したことにならなくなる）。
 */
export type FeedbackCaptureStoragePort = {
  put(
    workspaceId: WorkspaceId,
    id: FeedbackCaptureId,
    image: ArrayBuffer,
    submission: CaptureSubmission,
  ): PortResult<{ readonly key: string }>;

  /** 見るための一時的な URL。期限つき。 */
  signedUrl(
    workspaceId: WorkspaceId,
    id: FeedbackCaptureId,
    expiresInSeconds: number,
  ): PortResult<string>;

  /** 保存期間を過ぎたものを消す。 */
  deleteExpired(workspaceId: WorkspaceId, now: Date): PortResult<{ readonly deleted: number }>;
};

/**
 * 取りに来るときの鍵の置き場。
 *
 * **この口は平文を受け取らないし、返しもしない。** 受け取るのは潰した値だけ。
 * 平文を作るのは infrastructure（`mintSecret`）で、画面へ 1 度だけ返すのは
 * ユースケースの戻り値。保存先を通らないので、保存先の実装をどれだけ増やしても
 * 「うっかり平文を書き込んだ」が起こらない。
 */
export type IntegrationKeyPort = {
  issue(workspaceId: WorkspaceId, key: IntegrationKey): PortResult<true>;

  list(workspaceId: WorkspaceId): PortResult<readonly IntegrationKey[]>;

  revoke(workspaceId: WorkspaceId, id: IntegrationKeyId, at: Date): PortResult<true>;

  /**
   * 渡された平文が、どの鍵かを突き止める。
   *
   * 見つからない場合も**同じ形の失敗**を返す（どの鍵が存在するかを漏らさない）。
   */
  authenticate(plainValue: string): PortResult<IntegrationKey | null>;

  /** 回数制限。超えていれば false。 */
  withinRateLimit(id: IntegrationKeyId, now: Date): PortResult<boolean>;

  recordUsage(workspaceId: WorkspaceId, usage: KeyUsageRecord): PortResult<true>;
};

/**
 * 指示文のひな型。版番号つき。
 *
 * 文面を直したら版が上がる。上がった版で払い出すと指紋も変わるため、
 * 「いつの文面で渡したものか」が履歴から分かる。
 */
export type HandoffTemplatePort = {
  current(): PortResult<{ readonly version: string; readonly template: string }>;
};
