import { type DomainError, domainError } from "./errors";
import { type Result, err, ok } from "./result";
import type { WorkspaceId } from "./ids";

/**
 * テナント境界 (プラットフォーム層 §26.4)。
 *
 * すべてのデータは workspace_id で分離する。
 * 「読み出し時に where を書き忘れる」が最も起きやすい漏洩経路なので、
 * ドメイン側に「所属テナントを名乗る」契約を置き、application 層の
 * ユースケース入口で必ず照合する。
 */
export type TenantScoped = {
  readonly workspaceId: WorkspaceId;
};

/**
 * 実行主体の文脈。ユースケースは必ずこれを第一引数で受け取る。
 * ここに含まれない権限で処理を進めてはならない。
 */
export type ActorContext = {
  readonly workspaceId: WorkspaceId;
  readonly userId: string;
  readonly roles: readonly Role[];
  /** AI サービスアカウントかどうか。原則として公開操作を許可しない (§25)。 */
  readonly isAiServiceAccount: boolean;
};

/** 権限ロール (プラットフォーム層 §25)。公開権限と編集権限を分ける。 */
export type Role =
  | "owner"
  | "workspace_admin"
  | "brand_manager"
  | "researcher"
  | "writer"
  | "reviewer"
  | "publisher"
  | "analyst"
  | "contributor"
  | "ai_service_account";

/** 取り出したデータが実行主体のテナントに属するか照合する。 */
export function assertSameTenant<T extends TenantScoped>(
  actor: ActorContext,
  entity: T,
  what: string,
): Result<T, DomainError> {
  if (entity.workspaceId !== actor.workspaceId) {
    // 他テナントの存在を推測させないため、「見つからない」と同じ語調にする。
    return err(
      domainError("TENANT_MISMATCH", `${what} が見つかりません。`, {
        suggestedAction: "ワークスペースを切り替えているか確認してください。",
      }),
    );
  }
  return ok(entity);
}

export function hasRole(actor: ActorContext, ...roles: readonly Role[]): boolean {
  return actor.roles.some((r) => roles.includes(r));
}

export function requireRole(
  actor: ActorContext,
  what: string,
  ...roles: readonly Role[]
): Result<true, DomainError> {
  if (hasRole(actor, "owner") || hasRole(actor, ...roles)) return ok(true);
  return err(
    domainError("FORBIDDEN", `${what} を行う権限がありません。`, {
      suggestedAction: `必要な権限: ${roles.join(" / ")}`,
    }),
  );
}
