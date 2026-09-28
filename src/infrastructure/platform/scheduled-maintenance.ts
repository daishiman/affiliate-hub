import { runScheduledAiSearchReaudit } from "./ai-search-reaudit-scheduler";
import { sweepUnreferencedThumbnails } from "./blog-thumbnail-sweeper";
import type { ArticleImageBucket } from "./article-image-r2";
import { runArticleImageReclaim } from "./article-image-reclaim";
import { runScheduledDistribution, runPublicationDeliveryAuditFlush } from "./distribution-scheduler";
import { type CaptureBucket, sweepExpiredCaptures } from "./feedback-capture-r2";
import { runFeedbackDiagnosticsPurge } from "./feedback-diagnostics-purge";
import { runReaderMetricsRollup } from "./reader-metrics-scheduler";
import { runScheduledSeoAssessment } from "./seo-assessment-scheduler";
import { runSeoMeasurementCollection } from "./seo-measurement-scheduler";

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

/** 読者の生の記録を日次へたたみ、期限切れの生記録を捨てる。 */
async function runReaderMetricsRollupJob(env: ScheduledMaintenanceEnv, now: Date): Promise<void> {
  if (env.DB === undefined) {
    console.warn("[reader-metrics] 保存先がつながっていないので、集計を行いませんでした");
    return;
  }
  try {
    const result = await runReaderMetricsRollup(env.DB, now);
    console.log(
      `[reader-metrics] 日次集計を ${result.rolled} 件やり直し、` +
        `生の記録を ${result.purged} 件消しました` +
        (result.failed === 0 ? "" : `（失敗 ${result.failed} 件は次の回で拾い直します）`) +
        (result.truncated ? "（上限に達したため、続きは次の回で集計します）" : ""),
    );
  } catch (error) {
    console.error("[reader-metrics] 日次集計に失敗しました", error);
  }
}

/** SEO の月次再診断。日次 cron の中で今月分の未完了だけを拾う。 */
async function runSeoAssessmentJob(env: ScheduledMaintenanceEnv, now: Date): Promise<void> {
  if (env.DB === undefined) {
    console.warn("[seo-assessment] 保存先がつながっていないので、月次再診断を行いませんでした");
    return;
  }
  try {
    const result = await runScheduledSeoAssessment(env.DB, now);
    console.log("[seo-assessment] 月次再診断を処理しました", {
      scanned: result.scanned,
      completed: result.completed,
      failed: result.failed,
      truncated: result.truncated,
    });
  } catch {
    // 対象や DB 応答は出さない。未完了分は次の cron が拾い直す。
    console.error("[seo-assessment] 月次再診断に失敗しました");
  }
}

/** 記事から外れた画像を置き場から回収する。 */
async function runArticleImageReclaimJob(env: ScheduledMaintenanceEnv, now: Date): Promise<void> {
  if (env.DB === undefined || env.BUCKET === undefined) {
    console.warn("[article-image] 置き場か保存先がつながっていないので、回収を行いませんでした");
    return;
  }
  try {
    const result = await runArticleImageReclaim(
      env.DB,
      env.BUCKET as unknown as ArticleImageBucket,
      now,
    );
    console.log("[article-image] 画像の参照を点検しました", {
      scanned: result.scanned,
      reclaimed: result.reclaimed,
      kept: result.kept,
      failed: result.failed,
      deferred: result.deferred,
      orphanScanned: result.orphanScanned,
      orphanReclaimed: result.orphanReclaimed,
      orphanFailed: result.orphanFailed,
    });
  } catch {
    // 記事の中身や置き場の鍵はログへ載せない。残った分は次の回が拾い直す。
    console.error("[article-image] 画像の回収に失敗しました");
  }
}

/**
 * Worker の scheduled handler が呼ぶ、定期メンテナンスの配線。
 *
 * どれも互いに因果のない仕事なので、独立した Promise として登録する。
 * それぞれが自分の失敗を記録して完了し、別の仕事とCloudflare retryへ波及させない。
 */
/**
 * SEO / AEO の計測（受入 A1）。
 *
 * **掃除や配信とは別の待ち行列にする。** 外向きの読み取りを含むので一番落ちやすく、
 * まとめると外部の不調が保持期限の削除を巻き添えにする。
 * 収集は自動反映を止めていても続ける。止めるのは書き換えだけで、
 * 何が起きているかを見せるのは止めない。
 */
async function runSeoMeasurementJob(env: ScheduledMaintenanceEnv, now: Date): Promise<void> {
  if (env.DB === undefined) {
    console.warn("[seo] 保存先がつながっていないので、計測を行いませんでした");
    return;
  }
  try {
    const result = await runSeoMeasurementCollection(env.DB, env, now);
    console.log(`[seo] ${result.sites} 件のブログを計測しました`, {
      collected: result.outcomes.length,
    });
    // 見送った回は、所見が増えないだけで失敗には見えない。
    // 理由を出さないと「動いているのに何も出ない」に見える。
    for (const outcome of result.outcomes) {
      if (outcome.skippedReason !== null) {
        console.warn(`[seo] ${outcome.siteSlug}/${outcome.source}: ${outcome.skippedReason}`);
      }
    }
    for (const failure of result.failures) {
      console.error(`[seo] ${failure.siteSlug}: ${failure.message}`);
    }
  } catch (error) {
    console.error("[seo] 計測に失敗しました", error);
  }
}

/**
 * 参照が外れた古い表紙（サムネイル）の掃除。
 *
 * **置き場と台帳の両方が要る**（消してよいかは台帳が決める）ので、
 * 上のどれとも条件が違う。片方だけ欠けている環境で黙って止まると
 * 「毎晩動いているのに減らない」に見えるため、理由を出す。
 */
async function runThumbnailSweepJob(env: ScheduledMaintenanceEnv, now: Date): Promise<void> {
  if (env.BUCKET === undefined || env.DB === undefined) {
    console.warn("[thumbnail-sweep] 置き場か台帳がつながっていないので、掃除を行いませんでした");
    return;
  }
  try {
    const result = await sweepUnreferencedThumbnails(env.BUCKET, env.DB, now);
    // 見送りは失敗ではないが、黙ると「動いているのに何も消えない」に見える。
    if (result.skipped !== null) {
      console.warn(`[thumbnail-sweep] 掃除を見送りました: ${result.skipped}`);
      return;
    }
    console.log(
      `[thumbnail-sweep] 参照の外れた表紙を ${result.deleted} 枚消しました` +
        `（台帳が参照している世代 ${result.referenced} 件）` +
        (result.finished ? "" : "（上限に達したため、続きは次の回で消します）"),
    );
  } catch (error) {
    console.error("[thumbnail-sweep] 掃除に失敗しました", error);
  }
}

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
  ctx.waitUntil(runReaderMetricsRollupJob(env, now));
  ctx.waitUntil(runSeoAssessmentJob(env, now));
  ctx.waitUntil(runArticleImageReclaimJob(env, now));
  ctx.waitUntil(runSeoMeasurementJob(env, now));
  ctx.waitUntil(runThumbnailSweepJob(env, now));
}
