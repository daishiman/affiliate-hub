import type {
  AiUsageRollup,
  ConsentChoice,
  ConsentSignals,
  TelemetryEvent,
  TelemetryEventKey,
} from "@/domain/analytics";
import type { WorkspaceId } from "@/domain/shared";
import type { PortResult } from "./common";

/**
 * 計測の記録先とのつなぎ目。
 *
 * **domain は記録先を知らない。** 保存先を D1 から別の仕組みへ替えても、
 * イベントの形 (domain/analytics/telemetry-events.ts) と
 * 同意の決め方 (consent.ts) は 1 文字も変わらない。
 *
 * 記録は**まとめて送る**前提にしてある。1 件ずつ送ると、
 * 読者の画面から出ていく通信が増え、読む体験そのものを重くする。
 * 計測のために読みづらくなるのは本末転倒なので、`recordBatch` を基本形にした。
 */
export type TelemetrySinkPort = {
  /**
   * まとめて記録する。
   *
   * **失敗しても呼び出し側は続行する。** 計測が落ちたときに
   * 記事が読めなくなるのは、計測の側の都合を読者に押し付けている。
   */
  recordBatch(
    workspaceId: WorkspaceId,
    events: readonly TelemetryEvent[],
  ): PortResult<{ readonly accepted: number; readonly rejected: number }>;

  /** AI 利用をブログ × モデルで畳んだ一覧。管理画面が読む。 */
  aiUsage(
    workspaceId: WorkspaceId,
    input: { readonly from: Date; readonly to: Date; readonly siteSlug?: string },
  ): PortResult<readonly AiUsageRollup[]>;

  /**
   * 期間を過ぎた記録を消す。
   *
   * 消す仕組みを最初から置く。後から足すと、足す時点で
   * 「いつのものか分からない記録」が既に貯まっている。
   */
  purgeExpired(workspaceId: WorkspaceId, now: Date): PortResult<{ readonly deleted: number }>;

  /**
   * ある目印の記録を消す。読者からの削除依頼に応じるための口。
   * 口が無いと「消せます」と説明できない。
   */
  forgetReader(workspaceId: WorkspaceId, readerKey: string): PortResult<{ readonly deleted: number }>;
};

/**
 * 読者の同意の保存先。
 *
 * ブラウザ側の cookie に持つのが既定だが、
 * 「どこに持つか」を画面に決めさせないためにポートにしてある。
 */
export type ConsentStorePort = {
  read(): PortResult<ConsentSignals>;
  write(choice: ConsentChoice): PortResult<true>;
};

/** 集計の切り口。画面が数える対象を選ぶときに使う。 */
export type TelemetryQueryPort = {
  countByEvent(
    workspaceId: WorkspaceId,
    input: {
      readonly keys: readonly TelemetryEventKey[];
      readonly from: Date;
      readonly to: Date;
      readonly siteSlug?: string;
    },
  ): PortResult<readonly { readonly key: TelemetryEventKey; readonly count: number }[]>;
};
