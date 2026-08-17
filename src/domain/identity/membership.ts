import {
  type BrandId,
  type DomainError,
  type MembershipId,
  type Result,
  type Role,
  type UserId,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * Identity & Tenancy コンテキスト / Membership。
 *
 * 「誰が、どのワークスペースで、何をできるか」を持つ。
 * ユーザー本体 (メールアドレス・認証情報) は認証基盤 (Better Auth) 側にあり、
 * ドメインは UserId しか知らない。認証方式が変わってもここは変わらない。
 */
export type Membership = {
  readonly id: MembershipId;
  readonly workspaceId: WorkspaceId;
  readonly userId: UserId;
  readonly roles: readonly Role[];
  /**
   * 権限を及ぼす範囲。空配列は「ワークスペース全体」。
   * ブランド単位で担当を分けるとき (外部ライターなど) に使う。
   */
  readonly scopedBrandIds: readonly BrandId[];
  /** 表示名。監査ログや承認履歴に人の名前を出すため。 */
  readonly displayName: string;
  readonly invitedAt: Date;
  readonly acceptedAt: Date | null;
  readonly revokedAt: Date | null;
};

export function createMembership(input: {
  id: MembershipId;
  workspaceId: WorkspaceId;
  userId: UserId;
  roles: readonly Role[];
  scopedBrandIds?: readonly BrandId[];
  displayName: string;
  invitedAt: Date;
}): Result<Membership, DomainError> {
  if (input.roles.length === 0) {
    return err(validationError("役割を 1 つ以上指定してください。", "roles"));
  }
  if (input.displayName.trim() === "") {
    return err(
      validationError(
        "表示名が必要です。承認履歴に誰の操作か残せなくなります。",
        "displayName",
      ),
    );
  }
  // owner は 1 ワークスペースに 1 人。ここでは単独指定であることだけ確認し、
  // 「既存の owner がいないか」は application 層のユースケースが確認する
  // (ドメインは他のメンバーを知らないため)。
  if (input.roles.includes("owner") && input.roles.length > 1) {
    return err(
      validationError("owner は他の役割と併用できません。", "roles"),
    );
  }
  if (input.roles.includes("ai_service_account") && input.roles.length > 1) {
    return err(
      validationError(
        "AI サービスアカウントに人の役割を併せて付けることはできません。",
        "roles",
      ),
    );
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    userId: input.userId,
    roles: input.roles,
    scopedBrandIds: input.scopedBrandIds ?? [],
    displayName: input.displayName.trim(),
    invitedAt: input.invitedAt,
    acceptedAt: null,
    revokedAt: null,
  });
}

export function isActiveMembership(m: Membership, at: Date): boolean {
  if (m.revokedAt !== null && m.revokedAt <= at) return false;
  return m.acceptedAt !== null;
}

/** そのブランドを扱えるか。scopedBrandIds が空なら全ブランド。 */
export function coversBrand(m: Membership, brandId: BrandId): boolean {
  return m.scopedBrandIds.length === 0 || m.scopedBrandIds.includes(brandId);
}
