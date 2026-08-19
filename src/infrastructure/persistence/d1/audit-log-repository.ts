import { and, desc, eq, gte, lt, lte } from "drizzle-orm";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { PageRequest, Paged, PortResult } from "@/application/ports/common";
import type { AuditAction, AuditLogEntry } from "@/domain/compliance";
import { type AuditLogId, type UserId, type WorkspaceId, ok, taggedString } from "@/domain/shared";
import { type AuditLogRow, auditLogs } from "@/db/schema";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * 操作の記録（D1）。
 *
 * **これはスタブではない。** 見本版（`settings-sample-repository.ts` の
 * `createSampleAuditLog`）と同じ契約を満たす、実際に保存する実装。
 *
 * --- 足すだけにしている理由 ---
 * `update` も `delete` も置いていない。後から書き換えられる記録は
 * 「人が承認した」の証明にならない。消す口を 1 つ用意すると、
 * 「消せるが誰も消していない」ことを別に証明しなければならなくなる。
 * 保存期間の都合で古い行を落とす日が来たら、そのときに
 * 「いつからいつまでを落としたか」を残す仕組みごと足す。
 *
 * --- JSON にして入れている列 ---
 * `before` / `after` は操作ごとに形が違うので、列に開かず文字列で持つ。
 * 検索の対象は「いつ・誰が・何を・どの対象に」までで、差分の中身は
 * 読むためのもの。**秘密情報はドメイン側（`redactSensitive`）で
 * すでに落ちている**が、ここでも入れ直さない（落とす場所を 2 つにしない）。
 */

/** 1 度に読む上限。読み口が指定した件数より多く返さない。 */
const MAX_LIST = 200;

/** 行 → ドメイン。 */
function toDomain(row: AuditLogRow): AuditLogEntry {
  return {
    id: taggedString<"AuditLogId">(row.id) as AuditLogId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
    action: row.action as AuditAction,
    actor: {
      userId: row.actorUserId === null ? null : (taggedString<"UserId">(row.actorUserId) as UserId),
      isAiServiceAccount: row.actorIsAi,
      modelId: row.actorModelId,
      identified: row.actorIdentified,
    },
    targetType: row.targetType,
    targetId: row.targetId,
    before: parseJson(row.beforeJson),
    after: parseJson(row.afterJson),
    reason: row.reason,
    occurredAt: row.occurredAt,
  };
}

/**
 * 差分の読み戻し。
 *
 * 壊れた文字列が 1 行あるだけで一覧全体が落ちると、
 * 「記録が読めない」ことと「記録が無い」ことを画面から区別できない。
 * 読めない差分は `null` にして、行そのものは必ず出す。
 */
function parseJson(value: string | null): Readonly<Record<string, unknown>> | null {
  if (value === null) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Readonly<Record<string, unknown>>)
      : null;
  } catch {
    return null;
  }
}

export function createD1AuditLog(db: DrizzleD1): AuditLogPort {
  return {
    async append(entry) {
      try {
        await db.insert(auditLogs).values({
          id: String(entry.id),
          workspaceId: String(entry.workspaceId),
          action: entry.action,
          actorUserId: entry.actor.userId === null ? null : String(entry.actor.userId),
          actorIsAi: entry.actor.isAiServiceAccount,
          actorIdentified: entry.actor.identified,
          actorModelId: entry.actor.modelId,
          targetType: entry.targetType,
          targetId: entry.targetId,
          beforeJson: entry.before === null ? null : JSON.stringify(entry.before),
          afterJson: entry.after === null ? null : JSON.stringify(entry.after),
          reason: entry.reason,
          occurredAt: entry.occurredAt,
        });
      } catch (cause) {
        return storageFailure("操作の記録", cause);
      }
      return ok(entry.id);
    },

    async listByTarget(
      workspaceId: WorkspaceId,
      targetType: string,
      targetId: string,
    ): PortResult<readonly AuditLogEntry[]> {
      try {
        const rows = await db
          .select()
          .from(auditLogs)
          .where(
            and(
              eq(auditLogs.workspaceId, String(workspaceId)),
              eq(auditLogs.targetType, targetType),
              eq(auditLogs.targetId, targetId),
            ),
          )
          .orderBy(desc(auditLogs.occurredAt))
          .limit(MAX_LIST);
        return ok(rows.map(toDomain));
      } catch (cause) {
        return storageFailure("操作の記録の読み出し", cause);
      }
    },

    async search(
      workspaceId: WorkspaceId,
      query: { from?: Date; to?: Date; action?: string },
      page: PageRequest,
    ): PortResult<Paged<AuditLogEntry>> {
      try {
        // カーソルは時刻。件数で切ると、間に 1 件増えたときに同じ行を 2 回返す。
        const cursorAt = page.cursor === null ? null : new Date(Number(page.cursor));
        const conditions = [eq(auditLogs.workspaceId, String(workspaceId))];
        if (query.action !== undefined) conditions.push(eq(auditLogs.action, query.action));
        if (query.from !== undefined) conditions.push(gte(auditLogs.occurredAt, query.from));
        if (query.to !== undefined) conditions.push(lte(auditLogs.occurredAt, query.to));
        if (cursorAt !== null) conditions.push(lt(auditLogs.occurredAt, cursorAt));

        const limit = Math.min(page.limit, MAX_LIST);
        const rows = await db
          .select()
          .from(auditLogs)
          .where(and(...conditions))
          .orderBy(desc(auditLogs.occurredAt))
          .limit(limit + 1);

        // 1 件多く取って「次があるか」を判定する。件数を数える問い合わせを足さない。
        const hasMore = rows.length > limit;
        const items = (hasMore ? rows.slice(0, limit) : rows).map(toDomain);
        const last = items.at(-1);
        return ok({
          items,
          nextCursor: hasMore && last !== undefined ? String(last.occurredAt.getTime()) : null,
        });
      } catch (cause) {
        return storageFailure("操作の記録の検索", cause);
      }
    },
  };
}
