import type { PublicationDeliveryAudit, Publication } from "@/domain/distribution";
import type { PortResult } from "./common";

export type PublicationDeliveryAuditFlushResult = {
  readonly scanned: number;
  readonly delivered: number;
  readonly pending: number;
};

/**
 * 外部配信の状態確定と監査配送をつなぐ transactional outbox。
 *
 * settle は Publication の CAS と outbox 追記を同時に確定する。
 * flush は外部投稿を一切呼ばず、未配送の監査だけを audit_logs へ移す。
 */
export type PublicationDeliveryAuditOutboxPort = {
  settle(
    before: Publication,
    after: Publication,
    audit: PublicationDeliveryAudit,
  ): PortResult<Publication | null>;
  flush(limit: number): PortResult<PublicationDeliveryAuditFlushResult>;
};
