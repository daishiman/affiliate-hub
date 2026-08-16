import {
  type DomainError,
  type Result,
  type UserId,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * Identity & Tenancy コンテキスト / Workspace 集約。
 *
 * Workspace は課金・権限・データ分離の単位 (プラットフォーム層 §7.1)。
 * すべてのエンティティが workspaceId を持ち、この境界の外へは出ない。
 *
 * 階層: Workspace > Brand > Site / Channel / Affiliate / Campaign > ContentPackage
 */
export type WorkspacePlan = "solo" | "team" | "business";

/**
 * プランごとの上限。
 *
 * 値をコードに持つ理由: 上限を超えたときの挙動 (作成拒否・案内文) が業務ルールであり、
 * 画面や API ごとに書き分けると必ず食い違うため。
 * 実際の金額や課金処理はここに置かない (契約の話であってドメインではない)。
 */
export type WorkspaceLimits = {
  readonly maxBrands: number;
  readonly maxSites: number;
  readonly maxMembers: number;
  /** 1 か月あたりの AI 生成回数。0 は生成不可。 */
  readonly monthlyGenerations: number;
};

export const PLAN_LIMITS: Readonly<Record<WorkspacePlan, WorkspaceLimits>> = {
  solo: { maxBrands: 1, maxSites: 3, maxMembers: 1, monthlyGenerations: 200 },
  team: { maxBrands: 5, maxSites: 20, maxMembers: 10, monthlyGenerations: 2000 },
  business: { maxBrands: 50, maxSites: 200, maxMembers: 100, monthlyGenerations: 20000 },
};

export type Workspace = {
  readonly id: WorkspaceId;
  readonly name: string;
  readonly plan: WorkspacePlan;
  readonly ownerUserId: UserId;
  /** 既定のタイムゾーン。公開予約と締め処理の基準になる。 */
  readonly timezone: string;
  /** 既定の通貨。価格表示の基準。 */
  readonly currency: string;
  readonly createdAt: Date;
  readonly suspendedAt: Date | null;
};

export function createWorkspace(input: {
  id: WorkspaceId;
  name: string;
  plan: WorkspacePlan;
  ownerUserId: UserId;
  timezone?: string;
  currency?: string;
  createdAt: Date;
}): Result<Workspace, DomainError> {
  if (input.name.trim() === "") {
    return err(validationError("ワークスペース名が必要です。", "name"));
  }
  return ok({
    id: input.id,
    name: input.name.trim(),
    plan: input.plan,
    ownerUserId: input.ownerUserId,
    timezone: input.timezone ?? "Asia/Tokyo",
    currency: input.currency ?? "JPY",
    createdAt: input.createdAt,
    suspendedAt: null,
  });
}

export function limitsOf(workspace: Workspace): WorkspaceLimits {
  return PLAN_LIMITS[workspace.plan];
}

/**
 * 上限に達しているか確認する。
 *
 * 「作らせてから怒る」のではなく、作る前に理由と次の行動を返す。
 */
export function checkCapacity(
  workspace: Workspace,
  kind: "brand" | "site" | "member" | "generation",
  currentCount: number,
): Result<true, DomainError> {
  const limits = limitsOf(workspace);
  const max = {
    brand: limits.maxBrands,
    site: limits.maxSites,
    member: limits.maxMembers,
    generation: limits.monthlyGenerations,
  }[kind];
  const label = { brand: "ブランド", site: "サイト", member: "メンバー", generation: "AI生成" }[kind];

  if (currentCount < max) return ok(true);
  return err(
    validationError(
      `${label}の上限 (${max}) に達しています。`,
      kind,
    ),
  );
}

export function isActive(workspace: Workspace): boolean {
  return workspace.suspendedAt === null;
}
