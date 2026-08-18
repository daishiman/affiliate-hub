import { and, eq, gte, lte } from "drizzle-orm";
import type { LlmUsageEntry, LlmUsagePort, LlmUsageSummary } from "@/application/ports/llm-usage";
import type { LlmUsageRecorder } from "@/infrastructure/llm/key-access";
import { llmUsages } from "@/db/schema";
import type { WorkspaceId } from "@/domain/shared";
import { ok } from "@/domain/shared";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * 生成 AI を使った量の記録（D1）。
 *
 * 1 回の呼び出しにつき 1 行。まとめて足し込む形にしないのは、
 * 「先月ぶんの合計が合わない」ときに、どの呼び出しがおかしいのかを
 * 後から見に行けるようにするため。行が増える速さは 1 日数十件で、
 * 集計は索引（作業場所 + 日時）で足りる。
 */
export type LlmUsageDeps = {
  readonly db: DrizzleD1;
  readonly ids: { newId(): string };
  readonly now: () => Date;
};

/** 読み出し（応用層）と書き留め（提供元アダプタ）の両方を満たす 1 つの物。 */
export function createD1LlmUsage(deps: LlmUsageDeps): LlmUsagePort & LlmUsageRecorder {
  return {
    async record(entry: LlmUsageEntry) {
      try {
        await deps.db.insert(llmUsages).values({
          id: `lu_${deps.ids.newId()}`,
          workspaceId: entry.workspaceId,
          providerId: entry.providerId,
          modelId: entry.modelId,
          purpose: entry.purpose,
          inputTokens: entry.inputTokens,
          outputTokens: entry.outputTokens,
          estimatedCostMinor: entry.estimatedCostMinor,
          currency: entry.currency,
          succeeded: entry.succeeded,
          occurredAt: deps.now(),
        });
        return ok(undefined);
      } catch (cause) {
        return storageFailure("生成 AI の利用量の記録", cause);
      }
    },

    async summarize(input: { workspaceId: WorkspaceId; from: Date; to: Date }) {
      try {
        const rows = await deps.db
          .select()
          .from(llmUsages)
          .where(
            and(
              eq(llmUsages.workspaceId, input.workspaceId),
              gte(llmUsages.occurredAt, input.from),
              lte(llmUsages.occurredAt, input.to),
            ),
          );

        // 提供元 + モデルごとにまとめる。SQL 側で集計しないのは、
        // 通貨が混ざったときに黙って足し合わせないため（下で分けて持つ）。
        const buckets = new Map<string, LlmUsageSummary>();
        for (const row of rows) {
          const key = `${row.providerId}/${row.modelId}/${row.currency}`;
          const prev = buckets.get(key);
          buckets.set(key, {
            providerId: row.providerId,
            modelId: row.modelId,
            currency: row.currency,
            calls: (prev?.calls ?? 0) + 1,
            inputTokens: (prev?.inputTokens ?? 0) + row.inputTokens,
            outputTokens: (prev?.outputTokens ?? 0) + row.outputTokens,
            estimatedCostMinor: (prev?.estimatedCostMinor ?? 0) + row.estimatedCostMinor,
          });
        }
        return ok([...buckets.values()]);
      } catch (cause) {
        return storageFailure("生成 AI の利用量の集計", cause);
      }
    },
  };
}
