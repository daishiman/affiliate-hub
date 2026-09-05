import type { MetricsRollupPort } from "@/application/ports/blog-observability";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { IdGeneratorPort } from "@/application/ports/common";
import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import { validateRollupTargetDay } from "@/domain/analytics/reader-interaction";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  err,
  ok,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 日次集計を、日付を指定してやり直す（運用者の入口）。
 *
 * --- なぜ定期実行と別に要るか ---
 * 定期実行は当日と前日しか見ない (`ROLLUP_DAYS`)。集計が失敗した日が
 * その窓から出てしまうと、二度と拾われない。窓を広げると毎回の実行時間が
 * 伸びるので、**普段は狭く、必要なときだけ手で指す**形にしている。
 *
 * --- やり直してよい日かの判断はドメインが持つ ---
 * 集計は置き換えなので、生イベントが消えた日をやり直すと今ある集計が
 * 0 で潰れる。その線引きは `validateRollupTargetDay` にある（理由もそこ）。
 *
 * --- 対象の選び方 ---
 * 「その日に観測のある組」を `pendingDays` に数え上げさせ、そこから
 * 指定のブログだけを取る。ブログ一覧から回さないのは定期実行と同じ理由で、
 * 観測が 1 件も無い組を集計しに行かないためである。**指定した日に観測が
 * 無ければ 0 件として返す**。無い観測を 0 の行として書きに行かない。
 *
 * --- 記録 ---
 * これは運営者が数字を作り直す操作で、画面に出る値が変わる。読者の自動計測と
 * 違って身元があり、件数も日に数回なので、`audit_logs` に残す。
 */

export type RebuildDailyMetricsDeps = {
  readonly rollup: MetricsRollupPort;
  readonly auditLog: AuditLogPort;
  readonly ids: IdGeneratorPort;
  readonly now: () => Date;
};

export type RebuildDailyMetricsInput = {
  readonly siteSlug: string;
  /** `YYYY-MM-DD`。 */
  readonly day: string;
};

export type RebuildDailyMetricsView = {
  readonly siteSlug: string;
  readonly day: string;
  /** やり直せた件数。0 は「その日に観測が無かった」。 */
  readonly rebuilt: number;
  /** 失敗した件数。1 件でもあれば操作は失敗として返る。 */
  readonly failed: number;
};

/**
 * 1 回で数え上げる上限。
 *
 * 1 日 × 1 ブログなので通常 1 件しか返らない。上限は、作業場所が
 * 増えたときに同じ `site_slug` が複数返る場合の歯止めである。
 */
const REBUILD_SCAN_LIMIT = 200;

export function createRebuildDailyMetricsUseCase(
  deps: RebuildDailyMetricsDeps,
): UseCase<RebuildDailyMetricsInput, RebuildDailyMetricsView> {
  return {
    async execute(
      actor: ActorContext,
      input: RebuildDailyMetricsInput,
    ): Promise<Result<RebuildDailyMetricsView, DomainError>> {
      // 画面に出る数字を作り直す操作なので、記事を書く権限では足りない。
      const allowed = requireCapability(actor, "site.manage", "日次集計のやり直し");
      if (!allowed.ok) return allowed;

      const siteSlug = input.siteSlug.trim();
      if (siteSlug === "") {
        return err(validationError("どのブログをやり直すか指定してください。", "siteSlug"));
      }

      const day = validateRollupTargetDay(input.day, deps.now());
      if (!day.ok) return day;

      const pending = await deps.rollup.pendingDays([day.value], REBUILD_SCAN_LIMIT);
      if (!pending.ok) return pending;

      const targets = pending.value.filter(
        (target) => target.siteSlug === siteSlug && target.workspaceId === actor.workspaceId,
      );

      let rebuilt = 0;
      let failed = 0;
      for (const target of targets) {
        const done = await deps.rollup.rollupDay(target.workspaceId, target.siteSlug, target.day);
        if (done.ok) rebuilt += 1;
        else failed += 1;
      }

      /*
       * 記録は結果が出てから 1 件だけ書く。組ごとに書くと、1 日を
       * やり直しただけで記録が何行も増え、承認や公開の記録が埋もれる。
       */
      const entry = buildAuditEntry(deps, actor, {
        action: "metrics_rollup.rebuilt",
        targetType: "site_daily_metric",
        targetId: `${siteSlug}/${day.value}`,
        after: { day: day.value, rebuilt, failed },
        reason: null,
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(
          auditWriteFailure("日次集計をやり直しました", { targetId: `${siteSlug}/${day.value}` }),
        );
      }

      if (failed > 0) {
        return err(
          validationError(
            `${failed} 件の集計に失敗しました。もう一度同じ日を指定してください（やり直しは何度行っても同じ結果になります）。`,
            "day",
          ),
        );
      }

      return ok({ siteSlug, day: day.value, rebuilt, failed });
    },
  };
}
