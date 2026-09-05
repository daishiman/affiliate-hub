import { eq, isNull } from "drizzle-orm";
import type { AiSearchReauditRunPort } from "@/application/ports/seo";
import { aiSearchReauditRuns, workspaces } from "@/db/schema";
import type {
  AiSearchReauditFailureCode,
  AiSearchReauditRun,
  AiSearchReauditRunStatus,
} from "@/domain/seo/ai-search-reaudit-run";
import { asWorkspaceId, ok } from "@/domain/shared";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

function toDomain(row: typeof aiSearchReauditRuns.$inferSelect): AiSearchReauditRun {
  return {
    workspaceId: asWorkspaceId(row.workspaceId),
    status: row.status as AiSearchReauditRunStatus,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    scanned: row.scanned,
    recorded: row.recorded,
    failed: row.failed,
    failureCode: row.failureCode as AiSearchReauditFailureCode | null,
  };
}

/**
 * UI 用の読み取りは常に workspaceId 必須。
 * cron だけが停止されていない workspace の ID 列を読み、
 * 記事 0 件の workspace にも succeeded/0 を残す。
 */
export function createD1AiSearchReauditRunRepository(
  db: DrizzleD1,
): AiSearchReauditRunPort {
  return {
    async save(run) {
      try {
        await db
          .insert(aiSearchReauditRuns)
          .values({
            workspaceId: String(run.workspaceId),
            status: run.status,
            startedAt: run.startedAt,
            completedAt: run.completedAt,
            scanned: run.scanned,
            recorded: run.recorded,
            failed: run.failed,
            failureCode: run.failureCode,
          })
          .onConflictDoUpdate({
            target: aiSearchReauditRuns.workspaceId,
            set: {
              status: run.status,
              startedAt: run.startedAt,
              completedAt: run.completedAt,
              scanned: run.scanned,
              recorded: run.recorded,
              failed: run.failed,
              failureCode: run.failureCode,
            },
          });
        return ok(undefined);
      } catch (cause) {
        return storageFailure("AI 検索の定期再点検結果の保存", cause);
      }
    },

    async getLatest(workspaceId) {
      try {
        const [row] = await db
          .select()
          .from(aiSearchReauditRuns)
          .where(eq(aiSearchReauditRuns.workspaceId, String(workspaceId)))
          .limit(1);
        return ok(row === undefined ? null : toDomain(row));
      } catch (cause) {
        return storageFailure("AI 検索の定期再点検結果の読み出し", cause);
      }
    },

    async listKnownWorkspaceIds() {
      try {
        const rows = await db
          .select({ workspaceId: workspaces.id })
          .from(workspaces)
          .where(isNull(workspaces.suspendedAt))
          .orderBy(workspaces.id);
        return ok(rows.map((row) => asWorkspaceId(row.workspaceId)));
      } catch (cause) {
        return storageFailure("定期再点検対象 workspace の取得", cause);
      }
    },
  };
}
