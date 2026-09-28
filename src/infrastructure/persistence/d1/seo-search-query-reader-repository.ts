import type {
  SearchQueryBreakdown,
  SearchQueryMetric,
  SeoSearchQueryReadPort,
} from "@/application/ports/seo-measurement";
import { pageKeyOf } from "@/domain/seo/aeo-measurement";
import { err, ok, validationError } from "@/domain/shared";
import type { DrizzleD1 } from "./link-inbox-repository";
import { inclusiveSearchQueryDates } from "./seo-search-query-range";
import { storageFailure } from "./storage-failure";

type Deps = { readonly db: DrizzleD1; readonly workspaceId: string };

/** 画面の確定明細読取。収集cronの工場からは組み立てない。 */
export function createD1SeoSearchQueryReaderRepository({ db, workspaceId }: Deps): SeoSearchQueryReadPort {
  return {
    async recent(input) {
      if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
        return err(validationError("検索語明細は 1〜100 件で取得してください。"));
      }
      const dates = inclusiveSearchQueryDates(input.from, input.to);
      const page = pageKeyOf(`https://${input.pageKey}`);
      if (dates === null || input.siteSlug.trim() === "" || /[\s/\\?#]/u.test(input.siteSlug)
        || !page.ok || page.key !== input.pageKey) {
        return err(validationError("検索語明細のブログ・ページと31日以内の期間を確認してください。"));
      }
      try {
        // One statement sees the same active pointers for both rows and dates, even if a
        // collector publishes concurrently. Empty completed days need no synthetic metric row.
        const result = await db.$client.prepare(`WITH scoped_dates AS (
          SELECT requested.value AS metric_date, sync.active_run_id, sync.status,
            sync.active_may_be_limited, sync.active_completed_at
          FROM json_each(?) AS requested
          LEFT JOIN seo_search_query_sync AS sync ON sync.metric_date=requested.value
            AND sync.workspace_id=? AND sync.site_slug=?
        ), visible_rows AS (
          SELECT metric.site_slug,metric.page_key,metric.metric_date,metric.query,
            metric.impressions,metric.clicks,metric.position
          FROM seo_search_query_metric AS metric
          INNER JOIN scoped_dates AS day ON day.metric_date=metric.metric_date
            AND day.active_run_id=metric.run_id
          WHERE metric.workspace_id=? AND metric.site_slug=? AND metric.page_key=?
            AND metric.metric_date>=? AND metric.metric_date<=?
          ORDER BY metric.metric_date DESC,metric.impressions DESC,metric.query ASC
          LIMIT ?
        ) SELECT
          (SELECT json_group_array(json_object(
            'siteSlug',site_slug,'pageKey',page_key,'metricDate',metric_date,'query',query,
            'impressions',impressions,'clicks',clicks,'position',position
          )) FROM visible_rows) AS rows_json,
          (SELECT json_group_array(json_object(
            'metricDate',metric_date,'active',active_run_id IS NOT NULL,
            'refreshing',COALESCE(status='collecting',0),
            'activeMayBeLimited',active_may_be_limited,'activeCompletedAt',active_completed_at
          )) FROM (SELECT * FROM scoped_dates ORDER BY metric_date DESC)) AS dates_json
        `).bind(JSON.stringify(dates), workspaceId, input.siteSlug,
          workspaceId, input.siteSlug, input.pageKey, input.from, input.to, input.limit + 1)
          .first<{ rows_json: string; dates_json: string }>();
        if (result === null) throw new Error("Missing query snapshot result");
        const rows: SearchQueryMetric[] = JSON.parse(result.rows_json);
        const dateRows: BreakdownDateRow[] = JSON.parse(result.dates_json);
        return ok({
          rows: rows.slice(0, input.limit),
          truncated: rows.length > input.limit,
          dates: dateRows.map((date) => ({
            metricDate: date.metricDate,
            active: date.active === 1,
            refreshing: date.refreshing === 1,
            activeMayBeLimited: date.activeMayBeLimited === null ? null : date.activeMayBeLimited === 1,
            activeCompletedAt: date.activeCompletedAt === null ? null : new Date(date.activeCompletedAt * 1_000).toISOString(),
          })),
        });
      } catch (cause) {
        return storageFailure("検索語明細の取得", cause);
      }
    },
  };
}

type BreakdownDateRow = Omit<SearchQueryBreakdown["dates"][number],
  "active" | "refreshing" | "activeMayBeLimited" | "activeCompletedAt"> & {
  readonly active: number;
  readonly refreshing: number;
  readonly activeMayBeLimited: number | null;
  readonly activeCompletedAt: number | null;
};

