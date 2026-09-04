import { runScheduledAiSearchReaudit } from "./ai-search-reaudit-scheduler";
import { runScheduledDistribution, runPublicationDeliveryAuditFlush } from "./distribution-scheduler";
import { type CaptureBucket, sweepExpiredCaptures } from "./feedback-capture-r2";
import { runFeedbackDiagnosticsPurge } from "./feedback-diagnostics-purge";

type ScheduledMaintenanceEnv = Readonly<Record<string, unknown>> & {
  readonly BUCKET?: CaptureBucket;
  readonly DB?: D1Database;
};

type ScheduledMaintenanceContext = Pick<ExecutionContext, "waitUntil">;

/** 期限切れの画面の写しを消す。ほかの定期処理の成否には波及させない。 */
async function runCaptureSweepJob(env: ScheduledMaintenanceEnv, now: Date): Promise<void> {
  if (env.BUCKET === undefined) {
    console.warn("[sweep] 置き場がつながっていないので、掃除を行いませんでした");
    return;
  }
  try {
    const result = await sweepExpiredCaptures(env.BUCKET, now);
    console.log(
      `[sweep] 期限切れの画面の写しを ${result.deleted} 件消しました` +
        (result.finished ? "" : "（上限に達したため、続きは次の回で消します）"),
    );
  } catch (error) {
    // 掃除できなくても、読み出し側が期限切れを渡さないので外へは出ない。
    console.error("[sweep] 掃除に失敗しました", error);
  }
}

/** 保存済みの配信監査outboxだけを再送する。外部投稿は再実行しない。 */
async function runDistributionAuditJob(env: ScheduledMaintenanceEnv): Promise<void> {
  if (env.DB === undefined) {
    console.warn("[distribution-audit] 保存先がつながっていないので、監査を再送できませんでした");
    return;
  }
  try {
    const result = await runPublicationDeliveryAuditFlush(env.DB);
    console.log("[distribution-audit] 配信監査を処理しました", result);
  } catch {
    // outboxには完全payloadが残る。秘密やDB応答は出さず、次のcronで同じIDを再試行する。
    console.error("[distribution-audit] 配信監査の処理に失敗しました");
  }
}

/** 期限を迎えた外部媒体の予約配信を処理する。 */
async function runDistributionJob(env: ScheduledMaintenanceEnv, now: Date): Promise<void> {
  if (env.DB === undefined) {
    console.warn("[distribution] 保存先がつながっていないので、予約配信を行いませんでした");
    return;
  }
  try {
    const result = await runScheduledDistribution(env.DB, env, now);
    console.log("[distribution] 予約配信を処理しました", {
      scanned: result.scanned,
      claimed: result.claimed,
      published: result.published,
      retryScheduled: result.retryScheduled,
      failed: result.failed,
      skipped: result.skipped,
    });
  } catch {
    // 秘密やprovider応答を出さない。詳細はPublicationの安全化済みlastErrorへ残る。
    console.error("[distribution] 予約配信の処理に失敗しました");
  }
}

/** 保持期限を過ぎた技術診断を消す。作業場所ごとの失敗は結果として記録する。 */
async function runDiagnosticsRetentionJob(
  env: ScheduledMaintenanceEnv,
  now: Date,
): Promise<void> {
  if (env.DB === undefined) {
    console.warn("[retention] 保存先がつながっていないので、技術情報を消せませんでした");
    return;
  }
  try {
    const result = await runFeedbackDiagnosticsPurge(env.DB, now);
    console.log(
      `[retention] 技術情報を ${result.purged} 件消しました` +
        `（作業場所 ${result.workspaces} 件）` +
        (result.unfinished.length === 0
          ? ""
          : `（上限に達したため、続きは次の回で消します：${result.unfinished.join(", ")}）`),
    );
    // 失敗した作業場所は、消えずに残っている。次の回が同じ行を拾い直す。
    // 黙っていると「消えたはず」のまま何年も残るので、必ず出す。
    for (const failure of result.failures) {
      console.error(`[retention] ${failure.workspaceId}: ${failure.message}`);
    }
  } catch (error) {
    console.error("[retention] 技術情報の削除に失敗しました", error);
  }
}

/** AI 検索適合の対象記事を再点検する。 */
async function runAiSearchReauditJob(env: ScheduledMaintenanceEnv, now: Date): Promise<void> {
  if (env.DB === undefined) {
    console.warn("[ai-search-reaudit] 保存先がつながっていないので、再点検を行いませんでした");
    return;
  }
  try {
    const result = await runScheduledAiSearchReaudit(env.DB, now);
    console.log("[ai-search-reaudit] 記事を再点検しました", {
      scanned: result.scanned,
      recorded: result.recorded,
      failed: result.failed,
    });
  } catch {
    // 入口で握るためCron Triggerは成功扱いとなり、失敗記事は次のcronが拾い直す。
    // 固定文だけを出し、DB応答や記事の内容をログへ載せない。
    console.error("[ai-search-reaudit] 再点検に失敗しました");
  }
}

/**
 * Worker の scheduled handler が呼ぶ、定期メンテナンスの配線。
 *
 * 5 つは因果のない仕事なので、独立した Promise として登録する。
 * それぞれが自分の失敗を記録して完了し、別の仕事とCloudflare retryへ波及させない。
 */
export function scheduleMaintenanceJobs(
  env: ScheduledMaintenanceEnv,
  ctx: ScheduledMaintenanceContext,
  now: Date,
): void {
  ctx.waitUntil(runCaptureSweepJob(env, now));
  ctx.waitUntil(runDistributionAuditJob(env));
  ctx.waitUntil(runDistributionJob(env, now));
  ctx.waitUntil(runDiagnosticsRetentionJob(env, now));
  ctx.waitUntil(runAiSearchReauditJob(env, now));
}
