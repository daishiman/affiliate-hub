import type { MetricKey, MetricSample } from "@/domain/analytics";
import type { ArticleId, SiteId, WorkspaceId } from "@/domain/shared";
import type { PortResult } from "./common";

/**
 * 指標の読み書き。
 *
 * 収益系の指標も同じポートで扱うが、
 * 編集判断へ戻せるかは domain/analytics/feedback-policy が決める。
 * ポート側で判断しない (判断はドメインの仕事)。
 */
export type MetricsRepositoryPort = {
  record(workspaceId: WorkspaceId, sample: MetricSample, dimensions: MetricDimensions): PortResult<true>;
  query(
    workspaceId: WorkspaceId,
    input: {
      keys: readonly MetricKey[];
      from: Date;
      to: Date;
      dimensions?: Partial<MetricDimensions>;
    },
  ): PortResult<readonly MetricSample[]>;
};

export type MetricDimensions = {
  readonly siteId: SiteId | null;
  readonly articleId: ArticleId | null;
  readonly channel: string | null;
};

/**
 * クリック計測。
 *
 * アフィリエイト URL を書き換えずに測るため、
 * 計測識別子 (trackingRef) とクリックを別で記録する。
 */
export type ClickTrackingPort = {
  recordClick(input: {
    workspaceId: WorkspaceId;
    trackingRef: string;
    articleId: ArticleId | null;
    occurredAt: Date;
  }): PortResult<true>;
};
