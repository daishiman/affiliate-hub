import { and, asc, eq, gte, lte } from "drizzle-orm";
import type {
  SearchQuerySyncTarget,
  SeoSearchQueryCollectionPort,
} from "@/application/ports/seo-measurement";
import {
  seoSearchQuerySyncs,
  type SeoSearchQuerySyncRow,
} from "@/db/schema";
import { domainError, err, ok, validationError } from "@/domain/shared";
import type { DrizzleD1 } from "./link-inbox-repository";
import { jsonArrayChunks } from "./json-array-chunks";
import { storageFailure } from "./storage-failure";
import { inclusiveSearchQueryDates } from "./seo-search-query-range";

const ABANDONED_AFTER_SECONDS = 48 * 60 * 60;
/** Cleanup is bounded so one invocation cannot turn replacement into an unbounded write. */
const CLEANUP_ROWS = 5_000;

type Deps = { readonly db: DrizzleD1; readonly workspaceId: string };

export function createD1SeoSearchQueryMetricRepository({ db, workspaceId }: Deps): SeoSearchQueryCollectionPort {
  async function selectTarget(input: {
    readonly siteSlug: string;
    readonly from: string;
    readonly to: string;
    readonly observedAt: string;
  }, retry = true): Promise<Awaited<ReturnType<SeoSearchQueryCollectionPort["beginOrResume"]>>> {
    const dates = inclusiveSearchQueryDates(input.from, input.to);
    const observed = unixSeconds(input.observedAt);
    if (dates === null || observed === null || input.siteSlug.trim() === "") {
      return err(validationError("検索語の同期範囲を確認できません。"));
    }

    try {
      // Pending/superseded runs are invisible. Reclaim only a bounded slice on every invocation.
      await db.$client.prepare(`DELETE FROM seo_search_query_metric WHERE id IN (
        SELECT metric.id FROM seo_search_query_metric AS metric
        WHERE metric.workspace_id=? AND metric.collected_at<?
          AND NOT EXISTS (
            SELECT 1 FROM seo_search_query_sync AS sync
            WHERE sync.workspace_id=metric.workspace_id
              AND (sync.run_id=metric.run_id OR sync.active_run_id=metric.run_id)
          )
        LIMIT ?
      )`).bind(workspaceId, observed - ABANDONED_AFTER_SECONDS, CLEANUP_ROWS).run();

      // A pending day remains first even after the rolling seven-day window has moved on.
      // Otherwise the sync row itself protects its run from cleanup forever.
      const [pending] = await db.select().from(seoSearchQuerySyncs).where(and(
        eq(seoSearchQuerySyncs.workspaceId, workspaceId),
        eq(seoSearchQuerySyncs.siteSlug, input.siteSlug),
        eq(seoSearchQuerySyncs.status, "collecting"),
      )).orderBy(asc(seoSearchQuerySyncs.updatedAt)).limit(1);
      // Progress already staged means this is a budget continuation, not an abandoned start.
      // With three sites a fair daily rotation returns after 72h, so age alone must not reset 40k to zero.
      if (pending && (pending.nextStartRow > 0
        || observed - unixSecondsDate(pending.updatedAt) <= ABANDONED_AFTER_SECONDS)) {
        return ok(toTarget(pending));
      }
      if (pending) {
        const restarted = await restart(pending, observed);
        if (restarted !== null) return ok(toTarget(restarted));
      }

      const states = await db.select().from(seoSearchQuerySyncs).where(and(
        eq(seoSearchQuerySyncs.workspaceId, workspaceId),
        eq(seoSearchQuerySyncs.siteSlug, input.siteSlug),
        gte(seoSearchQuerySyncs.metricDate, input.from),
        lte(seoSearchQuerySyncs.metricDate, input.to),
      ));

      const byDate = new Map(states.map((state) => [state.metricDate, state]));
      // Fill unseen days oldest-first. A sliding daily window then catches up in seven runs
      // instead of always choosing the newly arrived recent date and starving the older six.
      const metricDate = dates.find((date) => !byDate.has(date))
        ?? states.filter((state) => state.status === "complete")
          .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())[0]?.metricDate
        ?? dates.at(-1)!;
      const existing = byDate.get(metricDate);

      if (!existing) {
        const runId = newRunId();
        try {
          await db.insert(seoSearchQuerySyncs).values({
            workspaceId,
            siteSlug: input.siteSlug,
            metricDate,
            activeRunId: null,
            runId,
            status: "collecting",
            nextStartRow: 0,
            revision: 1,
            mayBeLimited: false,
            startedAt: new Date(observed * 1_000),
            updatedAt: new Date(observed * 1_000),
          });
          return ok({ siteSlug: input.siteSlug, metricDate, runId, startRow: 0, revision: 1 });
        } catch (cause) {
          if (retry) return selectTarget(input, false);
          return storageFailure("検索語同期の開始", cause);
        }
      }

      const restarted = await restart(existing, observed);
      if (restarted !== null) return ok(toTarget(restarted));
      if (retry) return selectTarget(input, false);
      return err(domainError("CONFLICT", "別の検索語取得が先に開始しました。"));
    } catch (cause) {
      return storageFailure("検索語同期の開始", cause);
    }
  }

  async function restart(row: SeoSearchQuerySyncRow, observed: number): Promise<SeoSearchQuerySyncRow | null> {
    const changed = await db.update(seoSearchQuerySyncs).set({
      runId: newRunId(),
      status: "collecting",
      nextStartRow: 0,
      mayBeLimited: false,
      startedAt: new Date(observed * 1_000),
      updatedAt: new Date(observed * 1_000),
      revision: row.revision + 1,
      // activeRunId deliberately stays unchanged while readers use the last complete snapshot.
    }).where(and(
      eq(seoSearchQuerySyncs.workspaceId, workspaceId),
      eq(seoSearchQuerySyncs.siteSlug, row.siteSlug),
      eq(seoSearchQuerySyncs.metricDate, row.metricDate),
      eq(seoSearchQuerySyncs.revision, row.revision),
      lte(seoSearchQuerySyncs.updatedAt, new Date(observed * 1_000)),
    )).returning();
    return changed[0] ?? null;
  }

  return {
    beginOrResume: selectTarget,

    async stagePage(input) {
      const observed = unixSeconds(input.observedAt);
      if (
        observed === null
        || input.target.siteSlug.trim() === ""
        || input.nextStartRow < input.target.startRow
        || input.nextStartRow > 50_000
        || (input.complete && input.mayBeLimited && input.nextStartRow !== 50_000)
        || input.rows.some((row) =>
          row.siteSlug !== input.target.siteSlug || row.metricDate !== input.target.metricDate
          || !Number.isFinite(row.impressions) || !Number.isFinite(row.clicks) || !Number.isFinite(row.position)
          || row.impressions < 0 || row.clicks < 0
        )
      ) {
        return err(validationError("検索語明細の範囲を確認できません。"));
      }

      try {
        const statements: D1PreparedStatement[] = [];
        const payloads = jsonArrayChunks(input.rows.map((row) => ({
            pageKey: row.pageKey,
            query: row.query,
            impressions: row.impressions,
            clicks: row.clicks,
            position: row.position,
          })));
        for (const payload of payloads) {
          statements.push(db.$client.prepare(`INSERT INTO seo_search_query_metric
            (id,run_id,workspace_id,site_slug,page_key,metric_date,query,impressions,clicks,position,collected_at)
            SELECT 'sqm_' || lower(hex(randomblob(16))),?,?,?,json_extract(value,'$.pageKey'),?,
                   json_extract(value,'$.query'),json_extract(value,'$.impressions'),
                   json_extract(value,'$.clicks'),json_extract(value,'$.position'),?
            FROM json_each(?) WHERE EXISTS (
              SELECT 1 FROM seo_search_query_sync AS sync
              WHERE sync.workspace_id=? AND sync.site_slug=? AND sync.metric_date=?
                AND sync.run_id=? AND sync.status='collecting' AND sync.revision=? AND sync.updated_at<=?
            )
            ON CONFLICT(run_id,workspace_id,site_slug,page_key,metric_date,query) DO UPDATE SET
              impressions=excluded.impressions,clicks=excluded.clicks,position=excluded.position,
              collected_at=excluded.collected_at
            WHERE seo_search_query_metric.collected_at<=excluded.collected_at`).bind(
              input.target.runId,
              workspaceId,
              input.target.siteSlug,
              input.target.metricDate,
              observed,
              payload,
              workspaceId,
              input.target.siteSlug,
              input.target.metricDate,
              input.target.runId,
              input.target.revision,
              observed,
            ));
        }
        // Put the pointer CAS in the same D1 transaction as the rows. A concurrent loser
        // sees status/revision change before its INSERT EXISTS and therefore writes zero rows.
        statements.push(db.$client.prepare(`UPDATE seo_search_query_sync SET
          status=?,active_run_id=CASE WHEN ?=1 THEN run_id ELSE active_run_id END,
          active_may_be_limited=CASE WHEN ?=1 THEN ? ELSE active_may_be_limited END,
          active_completed_at=CASE WHEN ?=1 THEN ? ELSE active_completed_at END,
          next_start_row=?,may_be_limited=?,updated_at=?,revision=revision+1
          WHERE workspace_id=? AND site_slug=? AND metric_date=? AND run_id=?
            AND status='collecting' AND revision=? AND updated_at<=?`).bind(
              input.complete ? "complete" : "collecting",
              input.complete ? 1 : 0,
              input.complete ? 1 : 0,
              input.mayBeLimited ? 1 : 0,
              input.complete ? 1 : 0,
              observed,
              input.complete ? 0 : input.nextStartRow,
              input.mayBeLimited ? 1 : 0,
              observed,
              workspaceId,
              input.target.siteSlug,
              input.target.metricDate,
              input.target.runId,
              input.target.revision,
              observed,
            ));
        const results = await db.$client.batch(statements);
        if (Number(results.at(-1)?.meta.changes ?? 0) !== 1) {
          return err(domainError("CONFLICT", "新しい検索語取得が先に保存されました。"));
        }
        return ok(input.rows.length);
      } catch (cause) {
        // storageFailure reports the operation and Error.name only. Bound query text is never surfaced.
        return storageFailure("検索語明細の保存", cause);
      }
    },
  };
}

function newRunId(): string {
  return `sqsync_${crypto.randomUUID()}`;
}

function toTarget(row: SeoSearchQuerySyncRow): SearchQuerySyncTarget {
  return {
    siteSlug: row.siteSlug,
    metricDate: row.metricDate,
    runId: row.runId,
    startRow: row.nextStartRow,
    revision: row.revision,
  };
}


function unixSeconds(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1_000) : null;
}

function unixSecondsDate(value: Date): number {
  return Math.floor(value.getTime() / 1_000);
}
