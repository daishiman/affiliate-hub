import { drizzle } from "drizzle-orm/d1";
import type { PublicationDeliveryAuditFlushResult } from "@/application/ports";
import { executeDuePublications } from "@/application/usecases/distribution/execute-due-publications";
import * as schema from "@/db/schema";
import { createDeps } from "../composition";
import { createD1PublicationDeliveryAuditOutbox } from "../persistence/d1/publication-delivery-audit-outbox";

export type ScheduledDistributionResult = {
  readonly scanned: number;
  readonly claimed: number;
  readonly published: number;
  readonly retryScheduled: number;
  readonly failed: number;
  readonly skipped: number;
};

/**
 * Blueskyは認証と投稿の2通信を行い、各通信のtimeoutは10秒。
 * 20件なら最悪400秒で、Scheduled Workerの15分枠に余裕を残せる。
 * 件数を増やす場合は逐次HTTPのまま増やさず、Queue/Workflowへ分離する。
 */
export const SCHEDULED_DISTRIBUTION_BATCH_LIMIT = 20;

/**
 * cronから呼ぶproduction composition。
 * request actorは作らず、due Publication自身のworkspaceを唯一のtenant入力にする。
 */
export async function runScheduledDistribution(
  binding: D1Database,
  env: Readonly<Record<string, unknown>>,
  at: Date,
): Promise<ScheduledDistributionResult> {
  const db = drizzle(binding, { schema });
  const deps = createDeps({ db, env });
  const deliveryAudits = createD1PublicationDeliveryAuditOutbox(db);
  const result = await executeDuePublications(
    {
      publications: deps.publications,
      connections: deps.channelConnections,
      variants: deps.contentVariants,
      connectors: deps.channelConnectors,
      deliveryAudits,
      ids: deps.ids,
    },
    { at, limit: SCHEDULED_DISTRIBUTION_BATCH_LIMIT },
  );
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

export const SCHEDULED_DISTRIBUTION_AUDIT_BATCH_LIMIT = 100;

/**
 * 外部投稿と独立した監査outboxの配送。
 * 投稿処理が失敗しても既存outboxを進め、監査障害時は外部へ再送せず次cronで再試行する。
 */
export async function runPublicationDeliveryAuditFlush(
  binding: D1Database,
): Promise<PublicationDeliveryAuditFlushResult> {
  const deliveryAudits = createD1PublicationDeliveryAuditOutbox(
    drizzle(binding, { schema }),
  );
  const result = await deliveryAudits.flush(SCHEDULED_DISTRIBUTION_AUDIT_BATCH_LIMIT);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
