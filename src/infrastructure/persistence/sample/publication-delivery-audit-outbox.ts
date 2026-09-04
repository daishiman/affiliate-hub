import type {
  AuditLogPort,
  PublicationDeliveryAuditOutboxPort,
  PublicationRepositoryPort,
} from "@/application/ports";
import type { PublicationDeliveryAudit } from "@/domain/distribution";
import { ok } from "@/domain/shared";

/**
 * 保存先のない開発環境で、本番 outbox と同じ「状態確定→監査だけ再試行」を再現する。
 *
 * この実装の寿命は process 内だけなので、CAS成功直後に同期的に配列へ積めば
 * 観測可能な中間状態は生まれない。本番の永続・原子境界はD1 batchが担う。
 */
export function createSamplePublicationDeliveryAuditOutbox(input: {
  readonly publications: PublicationRepositoryPort;
  readonly auditLog: AuditLogPort;
}): PublicationDeliveryAuditOutboxPort {
  let pending: readonly PublicationDeliveryAudit[] = [];

  return {
    async settle(before, after, audit) {
      const saved = await input.publications.compareAndSwap(before, after);
      if (!saved.ok || saved.value === null) return saved;
      if (!pending.some((item) => item.id === audit.id)) pending = [...pending, audit];
      return saved;
    },

    async flush(limit) {
      const batch = pending.slice(0, limit);
      let delivered = 0;
      for (const audit of batch) {
        const appended = await input.auditLog.append(audit);
        if (!appended.ok) return appended;
        pending = pending.filter((item) => item.id !== audit.id);
        delivered += 1;
      }
      return ok({ scanned: batch.length, delivered, pending: pending.length });
    },
  };
}
