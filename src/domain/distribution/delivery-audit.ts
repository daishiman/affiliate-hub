import { createAuditLogEntry, type AuditLogEntry } from "@/domain/compliance/audit-log";
import type { AuditLogId, DomainError, Result, UserId } from "@/domain/shared";
import { taggedString } from "@/domain/shared";
import type { Publication } from "./publication";

const DISTRIBUTION_SCHEDULER_ID = taggedString<"UserId">(
  "system:distribution-scheduler",
) as UserId;

/**
 * Publication の配信結果と同じ原子境界で outbox へ積む監査記録。
 *
 * 一般の AuditLogEntry をそのまま受けると、別 action・別 publication の
 * 記録を誤って状態更新へ結び付けられる。この狭い型を組み立てる関数を
 * 唯一の入口にし、配信worker由来であることを保存前に確定する。
 */
export type PublicationDeliveryAudit = AuditLogEntry & {
  readonly action: "publication.delivery_changed";
  readonly targetType: "publication";
};

export function createPublicationDeliveryAudit(input: {
  readonly id: AuditLogId;
  readonly before: Publication;
  readonly after: Publication;
  readonly occurredAt: Date;
}): Result<PublicationDeliveryAudit, DomainError> {
  const built = createAuditLogEntry({
    id: input.id,
    workspaceId: input.after.workspaceId,
    action: "publication.delivery_changed",
    actor: {
      userId: DISTRIBUTION_SCHEDULER_ID,
      isAiServiceAccount: false,
      modelId: null,
      // cronは人でもAIでもなく、ログイン主体ではない。名前と未確認印を両方残す。
      identified: false,
    },
    targetType: "publication",
    targetId: String(input.after.id),
    before: { state: input.before.state, attempts: input.before.attempts },
    after: { state: input.after.state, attempts: input.after.attempts },
    reason: null,
    requestId: null,
    occurredAt: input.occurredAt,
  });
  return built as Result<PublicationDeliveryAudit, DomainError>;
}
