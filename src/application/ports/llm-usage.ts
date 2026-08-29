import type { WorkspaceId } from "@/domain/shared";
import type { PortResult } from "./common";

/**
 * 生成 AI を使った量の**読み出し**。
 *
 * 書き留める側（`record`）はここに無い。呼ぶのは提供元アダプタだけで、
 * 応用層からは一度も呼ばない口だからである
 * （置き場と理由は `src/infrastructure/llm/key-access.ts`）。
 */
export type LlmUsagePort = {
  /** 期間内の合計。利用量のページに出す。 */
  summarize(input: {
    readonly workspaceId: WorkspaceId;
    readonly from: Date;
    readonly to: Date;
  }): PortResult<readonly LlmUsageSummary[]>;
};

export type LlmUsagePurpose = "draft" | "verification" | "embedding";

export type LlmUsageEntry = {
  readonly workspaceId: WorkspaceId;
  readonly providerId: string;
  readonly modelId: string;
  readonly purpose: LlmUsagePurpose;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostMinor: number;
  readonly currency: string;
  /** 提供元への通信を開始したか。月次枠は `purpose === "draft"` との組で数える。 */
  readonly capacityConsumed: boolean;
  readonly succeeded: boolean;
};

export type LlmUsageSummary = {
  readonly providerId: string;
  readonly modelId: string;
  readonly calls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostMinor: number;
  readonly currency: string;
};
