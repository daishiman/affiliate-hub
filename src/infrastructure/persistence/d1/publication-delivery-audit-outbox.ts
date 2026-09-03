import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import type { PublicationDeliveryAuditOutboxPort } from "@/application/ports";
import {
  auditLogs,
  publicationDeliveryAuditOutbox,
  publications,
} from "@/db/schema";
import { ok } from "@/domain/shared";
import {
  publicationVersionConditions,
  toPublication,
  toPublicationRow,
} from "./distribution-repository";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * D1 transactional outbox。
 *
 * settleの3文はD1 batchの同一transactionで逐次実行される。
 * intentを先に置き、Publication CASのtriggerがworkspace/targetを照合してcommitし、
 * CAS敗者の未commit intentだけを最後に除く。どの文が失敗しても全体がrollbackする。
 */
export function createD1PublicationDeliveryAuditOutbox(
  db: DrizzleD1,
): PublicationDeliveryAuditOutboxPort {
  return {
    async settle(before, after, audit) {
      try {
        const intent = {
          id: String(audit.id),
          workspaceId: String(audit.workspaceId),
          action: audit.action,
          actorUserId: audit.actor.userId === null ? null : String(audit.actor.userId),
          actorIsAi: audit.actor.isAiServiceAccount,
          actorIdentified: audit.actor.identified,
          actorModelId: audit.actor.modelId,
          targetType: audit.targetType,
          targetId: audit.targetId,
          beforeJson: audit.before === null ? null : JSON.stringify(audit.before),
          afterJson: audit.after === null ? null : JSON.stringify(audit.after),
          reason: audit.reason,
          requestId: audit.requestId,
          occurredAt: audit.occurredAt,
          committedAt: null,
          deliveredAt: null,
        } as const;
        const [, updated] = await db.batch([
          db.insert(publicationDeliveryAuditOutbox).values(intent),
          db
            .update(publications)
            .set({
              ...toPublicationRow(after),
              lastDeliveryAuditId: String(audit.id),
            })
            .where(
              and(
                eq(publications.workspaceId, String(before.workspaceId)),
                ...publicationVersionConditions(before),
              ),
            )
            .returning(),
          db
            .delete(publicationDeliveryAuditOutbox)
            .where(
              and(
                eq(
                  publicationDeliveryAuditOutbox.workspaceId,
                  String(before.workspaceId),
                ),
                eq(publicationDeliveryAuditOutbox.id, String(audit.id)),
                isNull(publicationDeliveryAuditOutbox.committedAt),
              ),
            ),
        ] as const);
        return ok(updated[0] === undefined ? null : toPublication(updated[0]));
      } catch (cause) {
        return storageFailure("配信状態と監査待ち行列の保存", cause);
      }
    },

    async flush(limit) {
      try {
        const pending = await db
          .select()
          .from(publicationDeliveryAuditOutbox)
          .where(
            and(
              isNotNull(publicationDeliveryAuditOutbox.committedAt),
              isNull(publicationDeliveryAuditOutbox.deliveredAt),
            ),
          )
          .orderBy(asc(publicationDeliveryAuditOutbox.occurredAt))
          .limit(limit);

        let delivered = 0;
        for (const item of pending) {
          const [, marked] = await db.batch([
            db
              .insert(auditLogs)
              .values({
                id: item.id,
                workspaceId: item.workspaceId,
                action: item.action,
                actorUserId: item.actorUserId,
                actorIsAi: item.actorIsAi,
                actorIdentified: item.actorIdentified,
                actorModelId: item.actorModelId,
                targetType: item.targetType,
                targetId: item.targetId,
                beforeJson: item.beforeJson,
                afterJson: item.afterJson,
                reason: item.reason,
                requestId: item.requestId,
                occurredAt: item.occurredAt,
              })
              .onConflictDoNothing(),
            db
              .update(publicationDeliveryAuditOutbox)
              .set({ deliveredAt: new Date() })
              .where(
                and(
                  eq(publicationDeliveryAuditOutbox.id, item.id),
                  isNull(publicationDeliveryAuditOutbox.deliveredAt),
                ),
              )
              .returning({ id: publicationDeliveryAuditOutbox.id }),
          ] as const);
          if (marked.length > 0) delivered += 1;
        }

        const remaining = await db
          .select({ id: publicationDeliveryAuditOutbox.id })
          .from(publicationDeliveryAuditOutbox)
          .where(
            and(
              isNotNull(publicationDeliveryAuditOutbox.committedAt),
              isNull(publicationDeliveryAuditOutbox.deliveredAt),
            ),
          );
        return ok({ scanned: pending.length, delivered, pending: remaining.length });
      } catch (cause) {
        return storageFailure("配信監査待ち行列の再送", cause);
      }
    },
  };
}
