import type { AuditLogEntry, Disclosure, PolicyRule } from "@/domain/compliance";
import type { AuditLogId, DisclosureId, PolicyRuleId, WorkspaceId } from "@/domain/shared";
import type { Page, Paged, PortResult } from "./common";

export type DisclosureRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: DisclosureId): PortResult<Disclosure | null>;
  list(workspaceId: WorkspaceId, page: Page): PortResult<Paged<Disclosure>>;
  save(disclosure: Disclosure): PortResult<Disclosure>;
};

export type PolicyRuleRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: PolicyRuleId): PortResult<PolicyRule | null>;
  listEnabled(workspaceId: WorkspaceId): PortResult<readonly PolicyRule[]>;
  save(rule: PolicyRule): PortResult<PolicyRule>;
};

/**
 * 監査ログ。
 *
 * 書き込み専用にする理由: 後から書き換えられる記録は、
 * 「人が承認した」の証明にならない。
 */
export type AuditLogPort = {
  append(entry: AuditLogEntry): PortResult<AuditLogId>;
  listByTarget(
    workspaceId: WorkspaceId,
    targetType: string,
    targetId: string,
  ): PortResult<readonly AuditLogEntry[]>;
  search(
    workspaceId: WorkspaceId,
    query: { from?: Date; to?: Date; action?: string },
    page: Page,
  ): PortResult<Paged<AuditLogEntry>>;
};
