import {
  type AuditLogId,
  type DomainError,
  type Result,
  type UserId,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * 監査ログ (プラットフォーム層 §26)。
 *
 * 「誰が・いつ・何を・なぜ」を残す。特に次の 3 つは必ず記録する:
 *   1. 人の承認 (AI が承認していないことを後から証明できるようにする)
 *   2. 公開・取り下げ (読者へ出した内容の履歴)
 *   3. 広告表記・ランキング基準の変更 (規制対応で提出を求められうる)
 *
 * ドメインに置く理由: 「記録する」がアプリケーションの都合ではなく、
 * 業務上の要件そのものだから。実際の保存先は infrastructure の port が担う。
 */
export type AuditAction =
  | "content.created"
  | "content.state_changed"
  | "content.approved"
  | "content.published"
  | "content.unpublished"
  | "content.corrected"
  | "ranking_model.changed"
  | "disclosure.changed"
  | "policy_rule.changed"
  | "affiliate_link.created"
  | "affiliate_link.changed"
  | "connector.connected"
  | "connector.disconnected"
  | "member.role_changed"
  | "export.performed";

/** 操作した主体。AI かどうかを型で残す。後から「人が承認した」を検証するため。 */
export type AuditActor = {
  readonly userId: UserId | null;
  readonly isAiServiceAccount: boolean;
  /** AI の場合のモデル識別子。人の操作なら null。 */
  readonly modelId: string | null;
};

export type AuditLogEntry = {
  readonly id: AuditLogId;
  readonly workspaceId: WorkspaceId;
  readonly action: AuditAction;
  readonly actor: AuditActor;
  /** 対象の種類と ID。文字列で持つ (対象がコンテキストをまたぐため)。 */
  readonly targetType: string;
  readonly targetId: string;
  /** 変更前後。差分が意味を持つ操作だけ入れる。秘密情報は入れない。 */
  readonly before: Readonly<Record<string, unknown>> | null;
  readonly after: Readonly<Record<string, unknown>> | null;
  /** なぜその操作をしたか。承認・取り下げ・訂正では必須。 */
  readonly reason: string | null;
  readonly occurredAt: Date;
};

/** 理由の記録が必須の操作。理由なしの承認・取り下げは後から説明できない。 */
const REASON_REQUIRED: ReadonlySet<AuditAction> = new Set<AuditAction>([
  "content.approved",
  "content.unpublished",
  "content.corrected",
  "ranking_model.changed",
  "disclosure.changed",
  "member.role_changed",
]);

/**
 * 秘密情報を差分に入れないための遮断。
 *
 * before/after は開発者が自由に詰められるため、ここで機械的に落とす。
 * 「入れないように気をつける」は必ず破られる。
 */
const REDACTED_KEY_PATTERN = /secret|token|password|api_?key|credential|authorization|cookie/i;
export const REDACTED_PLACEHOLDER = "[記録しません]";

export function redactSensitive(
  record: Readonly<Record<string, unknown>> | null,
): Readonly<Record<string, unknown>> | null {
  if (record === null) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = REDACTED_KEY_PATTERN.test(key) ? REDACTED_PLACEHOLDER : value;
  }
  return out;
}

export function createAuditLogEntry(input: {
  id: AuditLogId;
  workspaceId: WorkspaceId;
  action: AuditAction;
  actor: AuditActor;
  targetType: string;
  targetId: string;
  before?: Readonly<Record<string, unknown>> | null;
  after?: Readonly<Record<string, unknown>> | null;
  reason?: string | null;
  occurredAt: Date;
}): Result<AuditLogEntry, DomainError> {
  if (input.targetType.trim() === "" || input.targetId.trim() === "") {
    return err(validationError("監査ログには対象の種類と ID が必要です。", "targetId"));
  }
  if (input.actor.userId === null && !input.actor.isAiServiceAccount) {
    return err(
      validationError("操作した主体が特定できません。匿名の操作は記録できません。", "actor"),
    );
  }
  const reason = input.reason?.trim() ?? "";
  if (REASON_REQUIRED.has(input.action) && reason === "") {
    return err(
      validationError(`${input.action} には理由の記録が必要です。`, "reason"),
    );
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    action: input.action,
    actor: input.actor,
    targetType: input.targetType,
    targetId: input.targetId,
    before: redactSensitive(input.before ?? null),
    after: redactSensitive(input.after ?? null),
    reason: reason === "" ? null : reason,
    occurredAt: input.occurredAt,
  });
}

/**
 * 承認が人によって行われたことを、記録から確認する。
 *
 * 公開前の最終確認と、規制対応の説明の両方で使う。
 */
export function wasApprovedByHuman(entries: readonly AuditLogEntry[], targetId: string): boolean {
  return entries.some(
    (e) =>
      e.targetId === targetId &&
      e.action === "content.approved" &&
      !e.actor.isAiServiceAccount &&
      e.actor.userId !== null,
  );
}
