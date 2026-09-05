import { and, eq, sql } from "drizzle-orm";
import type {
  AiSearchAuditHistoryPort,
  LatestFailingAudit,
  StaleAuditTarget,
} from "@/application/ports";
import type { PublishedArticle } from "@/application/read-models/published-article";
import type { AiSearchCheck } from "@/application/seo/ai-search-audit";
import { aiSearchAuditHistory } from "@/db/schema";
import type { ArticleType } from "@/domain/authoring";
import type { AuditTrigger } from "@/domain/seo/ai-search-audit-trigger";
import { ok, type WorkspaceId } from "@/domain/shared";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * AI 検索適合の点検履歴の保存先（D1）。
 *
 * --- 刈り取りを追記と同じ batch に入れている理由 ---
 * D1 の `batch` は 1 つのトランザクション。追記が通って刈り取りだけ落ちると、
 * その記事だけ保持窓を超えた履歴を持つ。**超えていることは誰にも見えない**ので、
 * 気づかれるのは容量が問題になった日になる。夜間バッチで直す形も採らない
 * （直す仕組みを足すより、ずれない形にするほうが部品が 1 つ少ない）。
 *
 * --- 保持する側を書く理由 ---
 * 「古い 1 件を消す」ではなく「新しい 30 件以外を消す」と書く。
 * 前者は 40 件溜まった行を 1 回では戻せない（10 回呼ぶ必要がある）。
 * 後者は何件溜まっていても 1 回で保持窓へ戻る。
 */

/** unix 秒（D1 の integer timestamp）へ。 */
function toEpochSeconds(at: Date): number {
  return Math.floor(at.getTime() / 1000);
}

function parseChecks(json: string): readonly AiSearchCheck[] {
  return JSON.parse(json) as readonly AiSearchCheck[];
}

export function createD1AiSearchAuditHistoryRepository(
  db: DrizzleD1,
): AiSearchAuditHistoryPort {
  return {
    async record(entry, window) {
      try {
        await db.batch([
          db.insert(aiSearchAuditHistory).values({
            id: entry.id,
            workspaceId: String(entry.workspaceId),
            siteSlug: entry.siteSlug,
            slug: entry.slug,
            trigger: entry.trigger,
            passedCount: entry.checks.filter((check) => check.ok).length,
            totalCount: entry.checks.length,
            checksJson: JSON.stringify(entry.checks),
            analyzerVersion: entry.analyzerVersion,
            checkedAt: entry.checkedAt,
          }),
          /*
            `id DESC` を第 2 キーにするのは決定性のため。同じ秒に 2 行入ると
            `checked_at` だけでは順序が決まらず、どちらが消えるかが実行ごとに
            変わりうる。テストが「たまに落ちる」形になる。

            **`db.run(sql`DELETE ...`)` を batch に入れてはならない。**
            `run()` はその場で実行を始めるので、batch が要求する「まだ組み立て途中の
            問い合わせ」ではなくなり、実行時に `Cannot read properties of undefined
            (reading 'bind')` で落ちる。型検査は通ってしまう
            （`tests/integration/d1-ai-search-audit-history.test.ts` が見張っている）。

            `workspace_id` も条件に入れる。今は `(site_slug, slug)` が全体で一意なので
            結果は変わらないが、**刈り取りは消す操作**なので、その一意性が崩れた日に
            他人の履歴を消す形にはしておかない。

            外側の絞りだけ `eq(aiSearchAuditHistory.workspaceId, ...)` と式で書く。
            意味は生 SQL の `workspace_id = ...` と同じだが、
            `tests/architecture/tenant-scoped-schema.test.ts` は AST を歩いて
            **`aiSearchAuditHistory.workspaceId` という式が現れるか**を見ている。
            文字列に埋めた条件はその見張りには映らない——「絞っているのに赤い」
            ではなく、**絞り忘れた日に赤くならない**のが問題になる。
          */
          db.delete(aiSearchAuditHistory).where(
            and(
              eq(aiSearchAuditHistory.workspaceId, String(entry.workspaceId)),
              sql`
                site_slug = ${entry.siteSlug} AND slug = ${entry.slug}
                  AND id NOT IN (
                    SELECT id FROM ai_search_audit_history
                    WHERE workspace_id = ${String(entry.workspaceId)}
                      AND site_slug = ${entry.siteSlug} AND slug = ${entry.slug}
                    ORDER BY checked_at DESC, id DESC
                    LIMIT ${window}
                  )
              `,
            ),
          ),
        ] as const);
        return ok(undefined);
      } catch (cause) {
        return storageFailure("AI 検索点検の履歴の保存", cause);
      }
    },

    async listStale({ before, limit }) {
      try {
        /*
          並びの第 1 キーが `last_checked IS NOT NULL` なのは、
          一度も点検していない記事を最優先にするため（0 が先に来る）。
          SQLite の NULL は ORDER BY で最小として扱われるが、それに頼ると
          方言が変わったときに黙って順序が入れ替わる。明示して書く。
        */
        const rows = await db.all<{
          readonly workspace_id: string;
          readonly article_json: string;
        }>(sql`
          SELECT p.workspace_id AS workspace_id, p.article_json AS article_json
          FROM published_articles p
          LEFT JOIN (
            SELECT workspace_id, site_slug, slug, max(checked_at) AS last_checked
            FROM ai_search_audit_history
            GROUP BY workspace_id, site_slug, slug
          ) h ON h.workspace_id = p.workspace_id
             AND h.site_slug = p.site_slug AND h.slug = p.slug
          WHERE p.archived_at IS NULL
            AND (h.last_checked IS NULL OR h.last_checked <= ${toEpochSeconds(before)})
          ORDER BY h.last_checked IS NOT NULL, h.last_checked ASC, p.slug ASC
          LIMIT ${limit}
        `);
        return ok(
          rows.map(
            (row): StaleAuditTarget => ({
              workspaceId: row.workspace_id as WorkspaceId,
              article: JSON.parse(row.article_json) as PublishedArticle,
            }),
          ),
        );
      } catch (cause) {
        return storageFailure("再点検が要る記事の取得", cause);
      }
    },

    async listLatestFailing({ workspaceId, siteSlug, limit }) {
      try {
        /*
          「その記事の**最新の**点検が落ちている」を見る。
          `passed_count < total_count` を先に絞ってしまうと、
          「先週落ちて今週直った記事」が今週の行を無視して出続ける。
        */
        const rows = await db.all<{
          readonly site_slug: string;
          readonly slug: string;
          readonly title: string;
          readonly type: string;
          readonly checked_at: number;
          readonly trigger: string;
          readonly passed_count: number;
          readonly total_count: number;
          readonly checks_json: string;
        }>(sql`
          SELECT h.site_slug AS site_slug, h.slug AS slug,
                 p.title AS title, p.type AS type,
                 h.checked_at AS checked_at, h.trigger AS trigger,
                 h.passed_count AS passed_count, h.total_count AS total_count,
                 h.checks_json AS checks_json
          FROM ai_search_audit_history h
          INNER JOIN published_articles p
            ON p.workspace_id = h.workspace_id
           AND p.site_slug = h.site_slug AND p.slug = h.slug
          WHERE h.workspace_id = ${String(workspaceId)}
            AND p.workspace_id = ${String(workspaceId)}
            AND p.archived_at IS NULL
            ${siteSlug === undefined ? sql`` : sql`AND h.site_slug = ${siteSlug}`}
            AND h.id = (
              SELECT latest.id FROM ai_search_audit_history latest
              WHERE latest.workspace_id = h.workspace_id
                AND latest.site_slug = h.site_slug AND latest.slug = h.slug
              ORDER BY latest.checked_at DESC, latest.id DESC
              LIMIT 1
            )
            AND h.passed_count < h.total_count
          ORDER BY h.checked_at DESC, h.slug ASC
          LIMIT ${limit}
        `);
        return ok(
          rows.map(
            (row): LatestFailingAudit => ({
              siteSlug: row.site_slug,
              slug: row.slug,
              title: row.title,
              type: row.type as ArticleType,
              checkedAt: new Date(row.checked_at * 1000).toISOString(),
              trigger: row.trigger as AuditTrigger,
              passedCount: row.passed_count,
              totalCount: row.total_count,
              checks: parseChecks(row.checks_json),
            }),
          ),
        );
      } catch (cause) {
        return storageFailure("点検で落ちている記事の取得", cause);
      }
    },

    async getCoverage({ workspaceId, siteSlug }) {
      try {
        const rows = await db.all<{
          readonly published_count: number;
          readonly audited_count: number;
        }>(sql`
          SELECT count(*) AS published_count,
                 sum(CASE WHEN EXISTS (
                   SELECT 1 FROM ai_search_audit_history h
                   WHERE h.workspace_id = p.workspace_id
                     AND h.site_slug = p.site_slug AND h.slug = p.slug
                 ) THEN 1 ELSE 0 END) AS audited_count
          FROM published_articles p
          WHERE p.workspace_id = ${String(workspaceId)}
            AND p.archived_at IS NULL
            ${siteSlug === undefined ? sql`` : sql`AND p.site_slug = ${siteSlug}`}
        `);
        const row = rows[0];
        return ok({
          publishedCount: row?.published_count ?? 0,
          auditedCount: row?.audited_count ?? 0,
        });
      } catch (cause) {
        return storageFailure("AI 検索点検の範囲の取得", cause);
      }
    },
  };
}
