import { drizzle } from "drizzle-orm/d1";
import type { PublicationDeliveryAuditFlushResult } from "@/application/ports";
import { executeDuePublications } from "@/application/usecases/distribution/execute-due-publications";
import * as schema from "@/db/schema";
import { createChannelConnectorProvider } from "../channels/channel-registry";
import { createD1ContentVariantRepository } from "../persistence/d1/content-repository";
import {
  createD1ChannelConnectionRepository,
  createD1PublicationRepository,
} from "../persistence/d1/distribution-repository";
import { createD1PublicationDeliveryAuditOutbox } from "../persistence/d1/publication-delivery-audit-outbox";
import { idGenerator } from "./id-generator";
import { createSecretResolver } from "./secret-resolver";

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
 *
 * --- なぜ `createDeps()` を呼ばないのか ---
 * ここは Worker の**入口から直に読まれる**数少ない TypeScript である
 * （`worker-entry.js` → このファイル）。画面と API は OpenNext が別途束ねた
 * `handler.mjs` の中にあるので、この経路が引き込んだものは **Worker の中に
 * もう 1 部増える**。`createDeps()` は組み立ての総目録で、見本実装から
 * 商品・順位・監査まで全部を数珠つなぎに引く。cron が使うのは下の 5 つだけなのに、
 * 226 ファイル・1018 KiB（gzip 換算 239 KiB）が二重に載っていた。
 *
 * Workers の上限は **1 Worker あたり 3 MiB（gzip 後）**で、2026-08-30 の公開は
 * 3065 KiB → 超過で落ちている。つまりこの二重分は、余白そのものだった。
 *
 * **`createDeps()` へ戻さないこと。** 戻しても型は通り、cron も動き、
 * 落ちるのは数か月後に上限へ当たった日の公開である。
 * 引き込みが増えていないことは `tests/architecture/worker-entry-weight.test.ts` が見る。
 *
 * --- 見本実装へ落ちる分岐が要らない理由 ---
 * 呼び出し元（`worker-entry.js`）が `env.DB === undefined` で先に帰る。
 * ここへ来た時点で保存先は必ずある。`createDeps` の `db === null ? 見本 : 本物`
 * は、cron では**通らない側**だけを連れてきていた。
 */
export async function runScheduledDistribution(
  binding: D1Database,
  env: Readonly<Record<string, unknown>>,
  at: Date,
): Promise<ScheduledDistributionResult> {
  const db = drizzle(binding, { schema });
  const result = await executeDuePublications(
    {
      publications: createD1PublicationRepository(db),
      connections: createD1ChannelConnectionRepository(db),
      variants: createD1ContentVariantRepository(db),
      connectors: createChannelConnectorProvider({ secrets: createSecretResolver(env) }),
      deliveryAudits: createD1PublicationDeliveryAuditOutbox(db),
      ids: idGenerator,
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
