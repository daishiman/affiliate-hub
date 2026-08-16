import type {
  BrandRepositoryPort,
  MembershipRepositoryPort,
  WorkspaceRepositoryPort,
} from "@/application/ports/identity";
import type { AuditLogPort, DisclosureRepositoryPort } from "@/application/ports/compliance";
import type { AuditAction } from "@/domain/compliance";
import {
  DISCLOSURE_SURFACES,
  type DisclosureSurface,
  type RelationshipType,
  relAttributeFor,
  requiresDisclosure,
} from "@/domain/compliance";
import {
  HUMAN_ONLY_CAPABILITIES,
  type Capability,
  capabilitiesOf,
  isActiveMembership,
  limitsOf,
  missingPublishReadiness,
  requireCapability,
} from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  type Role,
  domainError,
  err,
  ok,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 設定（ワークスペース・担当者・ブランド・広告表記）のユースケース。
 *
 * この画面の役目は「誰が何をできるか」を読める形にすること。
 * 権限の判定そのものは domain の 1 枚の表が持っている。
 * 画面側で `if (役割 === "writer")` と書き始めると、
 * 役割を 1 つ足すたびに全画面を直すことになる。
 */
export type ManageWorkspaceDeps = {
  readonly workspaces: WorkspaceRepositoryPort;
  readonly memberships: MembershipRepositoryPort;
  readonly brands: BrandRepositoryPort;
  readonly disclosures: DisclosureRepositoryPort;
  readonly auditLog: AuditLogPort;
};

export const ROLE_LABEL: Readonly<Record<Role, string>> = {
  owner: "オーナー（すべての権限）",
  workspace_admin: "管理担当",
  brand_manager: "ブランド担当",
  researcher: "調査担当",
  writer: "書き手",
  reviewer: "確認担当",
  publisher: "公開担当",
  analyst: "数字の担当",
  contributor: "外部の書き手",
  ai_service_account: "AI（機械）",
};

export const CAPABILITY_LABEL: Readonly<Record<Capability, string>> = {
  "workspace.manage": "設定を変える",
  "brand.manage": "ブランドを管理する",
  "site.manage": "ブログを管理する",
  "site.draft": "新しいブログを作る",
  "member.manage": "担当者を管理する",
  "product.read": "商品を見る",
  "product.write": "商品を登録する",
  "evidence.write": "根拠を登録する",
  "ranking_model.manage": "評価基準を決める",
  "content.read": "記事を見る",
  "content.write": "記事を書く",
  "content.generate": "AI に下書きを作らせる",
  "content.fact_check": "事実確認をする",
  "content.compliance_review": "表記のきまりを確認する",
  "content.approve": "記事を承認する",
  "content.publish": "記事を公開する",
  "affiliate.manage": "提携を管理する",
  "affiliate.read_revenue": "成果の金額を見る",
  "analytics.read": "数字を見る",
  "audit.read": "操作の記録を見る",
  "export.perform": "データを書き出す",
};

const ALL_ROLES: readonly Role[] = [
  "owner",
  "workspace_admin",
  "brand_manager",
  "researcher",
  "writer",
  "reviewer",
  "publisher",
  "analyst",
  "contributor",
  "ai_service_account",
];

// --- 設定の概要 -------------------------------------------------------------

export type CapacityRow = {
  readonly label: string;
  readonly used: number;
  readonly max: number;
  readonly full: boolean;
};

export type GetSettingsOverviewOutput = {
  readonly workspaceName: string;
  readonly planLabel: string;
  readonly timezone: string;
  readonly currency: string;
  readonly suspended: boolean;
  readonly capacities: readonly CapacityRow[];
  readonly blockedReason: string | null;
};

const PLAN_LABEL: Readonly<Record<"solo" | "team" | "business", string>> = {
  solo: "ひとり用",
  team: "チーム用",
  business: "法人用",
};

export function createGetSettingsOverviewUseCase(
  deps: ManageWorkspaceDeps,
): UseCase<Record<string, never>, GetSettingsOverviewOutput> {
  return {
    async execute(actor: ActorContext): Promise<Result<GetSettingsOverviewOutput, DomainError>> {
      // 見るだけなら管理権限は要らない。変える操作の側で改めて確認する。
      const allowed = requireCapability(actor, "content.read", "設定の参照");
      if (!allowed.ok) return allowed;

      const found = await deps.workspaces.findById(actor.workspaceId);
      if (!found.ok) return found;
      if (found.value === null) {
        return err(
          domainError("NOT_FOUND", "この作業場所の設定が見つかりません。", {
            suggestedAction: "管理担当に確認してください。",
          }),
        );
      }
      const workspace = found.value;
      const limits = limitsOf(workspace);

      const [brands, sites, members] = await Promise.all([
        deps.workspaces.countBrands(workspace.id),
        deps.workspaces.countSites(workspace.id),
        deps.workspaces.countMembers(workspace.id),
      ]);
      if (!brands.ok) return brands;
      if (!sites.ok) return sites;
      if (!members.ok) return members;

      const capacities: CapacityRow[] = [
        { label: "ブランド", used: brands.value, max: limits.maxBrands, full: brands.value >= limits.maxBrands },
        { label: "ブログ", used: sites.value, max: limits.maxSites, full: sites.value >= limits.maxSites },
        { label: "担当者", used: members.value, max: limits.maxMembers, full: members.value >= limits.maxMembers },
      ];

      return ok({
        workspaceName: workspace.name,
        planLabel: PLAN_LABEL[workspace.plan],
        timezone: workspace.timezone,
        currency: workspace.currency,
        suspended: workspace.suspendedAt !== null,
        capacities,
        blockedReason:
          workspace.suspendedAt !== null
            ? "この作業場所はいま止まっています。新しい記事の公開はできません。"
            : capacities.some((c) => c.full)
              ? `${capacities
                  .filter((c) => c.full)
                  .map((c) => c.label)
                  .join("・")}が上限に達しています。増やすには契約の変更が必要です。`
              : null,
      });
    },
  };
}

// --- 役割と権限の対応表 ------------------------------------------------------

export type RoleRow = {
  readonly role: Role;
  readonly label: string;
  readonly isMachine: boolean;
  readonly capabilities: readonly { readonly key: Capability; readonly label: string }[];
  /** 機械には決して渡さない操作。役割の表からではなく、この一覧が最終判定。 */
  readonly humanOnlyBlocked: readonly string[];
};

export type ListRolesOutput = {
  readonly rows: readonly RoleRow[];
  readonly humanOnlyNote: string;
};

/**
 * 役割ごとにできることを返す。
 *
 * 一覧は domain の権限表から作る。画面で並べ直すと、
 * 表示と実際の判定がずれて「できると書いてあるのにできない」が起きる。
 */
export function createListRolesUseCase(
  _deps: ManageWorkspaceDeps,
): UseCase<Record<string, never>, ListRolesOutput> {
  return {
    async execute(actor: ActorContext): Promise<Result<ListRolesOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "役割の参照");
      if (!allowed.ok) return allowed;

      const rows = ALL_ROLES.map((role): RoleRow => {
        const caps = [...capabilitiesOf([role])];
        const isMachine = role === "ai_service_account";
        return {
          role,
          label: ROLE_LABEL[role],
          isMachine,
          capabilities: caps
            // 機械には、人が行うと決めた操作を出さない。
            .filter((c) => !(isMachine && HUMAN_ONLY_CAPABILITIES.has(c)))
            .map((key) => ({ key, label: CAPABILITY_LABEL[key] })),
          humanOnlyBlocked: isMachine
            ? caps.filter((c) => HUMAN_ONLY_CAPABILITIES.has(c)).map((c) => CAPABILITY_LABEL[c])
            : [],
        };
      });

      return ok({
        rows,
        humanOnlyNote: [...HUMAN_ONLY_CAPABILITIES]
          .map((c) => CAPABILITY_LABEL[c])
          .join("・"),
      });
    },
  };
}

// --- 担当者の一覧 -----------------------------------------------------------

export type MemberRow = {
  readonly membershipId: string;
  readonly displayName: string;
  readonly roleLabels: readonly string[];
  readonly active: boolean;
  readonly stateLabel: string;
  readonly scopeLabel: string;
};

export type ListMembersOutput = {
  readonly rows: readonly MemberRow[];
  readonly total: number;
  readonly ownerMissing: boolean;
  readonly emptyReason: string | null;
};

export function createListMembersUseCase(
  deps: ManageWorkspaceDeps,
): UseCase<Record<string, never>, ListMembersOutput> {
  return {
    async execute(actor: ActorContext): Promise<Result<ListMembersOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "担当者の参照");
      if (!allowed.ok) return allowed;

      const listed = await deps.memberships.list(actor.workspaceId, { limit: 100, cursor: null });
      if (!listed.ok) return listed;
      const owner = await deps.memberships.findOwner(actor.workspaceId);
      if (!owner.ok) return owner;

      const now = new Date();
      const rows = listed.value.items.map((m): MemberRow => {
        const active = isActiveMembership(m, now);
        return {
          membershipId: String(m.id),
          displayName: m.displayName,
          roleLabels: m.roles.map((r) => ROLE_LABEL[r]),
          active,
          stateLabel:
            m.revokedAt !== null
              ? "解除済み"
              : m.acceptedAt === null
                ? "招待中（まだ参加していません）"
                : "参加中",
          scopeLabel:
            m.scopedBrandIds.length === 0
              ? "すべてのブランド"
              : `${m.scopedBrandIds.length}件のブランドのみ`,
        };
      });

      return ok({
        rows,
        total: rows.length,
        ownerMissing: owner.value === null,
        emptyReason: rows.length === 0 ? "担当者がまだ登録されていません。" : null,
      });
    },
  };
}

// --- ブランドの公開準備 ------------------------------------------------------

export type BrandRow = {
  readonly brandId: string;
  readonly displayName: string;
  readonly positioning: string;
  readonly legalName: string | null;
  readonly contactEmail: string | null;
  readonly voiceLabel: string;
  readonly avoidPhrases: readonly string[];
  readonly disclaimer: string | null;
  /** 公開の前に埋める必要があるもの。空なら準備できている。 */
  readonly missing: readonly string[];
};

export type ListBrandsOutput = {
  readonly rows: readonly BrandRow[];
  readonly notReadyCount: number;
  readonly emptyReason: string | null;
};

export function createListBrandsUseCase(
  deps: ManageWorkspaceDeps,
): UseCase<Record<string, never>, ListBrandsOutput> {
  return {
    async execute(actor: ActorContext): Promise<Result<ListBrandsOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "ブランドの参照");
      if (!allowed.ok) return allowed;

      const listed = await deps.brands.list(actor.workspaceId, { limit: 100, cursor: null });
      if (!listed.ok) return listed;

      const rows = listed.value.items.map((b): BrandRow => ({
        brandId: String(b.id),
        displayName: b.displayName,
        positioning: b.positioning,
        legalName: b.legalName,
        contactEmail: b.contactEmail,
        voiceLabel: `${b.voice.politeness === "polite" ? "です・ます" : "だ・である"} / 一人称「${b.voice.firstPerson}」`,
        avoidPhrases: b.voice.avoidPhrases,
        disclaimer: b.disclaimer,
        missing: missingPublishReadiness(b),
      }));

      return ok({
        rows,
        notReadyCount: rows.filter((r) => r.missing.length > 0).length,
        emptyReason: rows.length === 0 ? "ブランドがまだ登録されていません。" : null,
      });
    },
  };
}

// --- 広告表記 ---------------------------------------------------------------

export const RELATIONSHIP_SHORT_LABEL: Readonly<Record<RelationshipType, string>> = {
  affiliate: "提携（成果報酬）",
  sponsored: "スポンサー",
  supplied: "商品の提供",
  loaned: "商品の貸与",
  purchased: "自費で購入",
  paid_partnership: "有償の協業",
};

export type DisclosureRow = {
  readonly disclosureId: string;
  readonly relationshipLabel: string;
  readonly required: boolean;
  readonly visibleMessage: string;
  readonly advertiserOrSupplier: string | null;
  readonly aiAssisted: boolean;
  readonly relAttribute: string;
};

export type ListDisclosuresOutput = {
  readonly rows: readonly DisclosureRow[];
  /** 表示が必要な場所。ここ全部に出ていないと公開できない。 */
  readonly surfaces: readonly { readonly key: DisclosureSurface; readonly label: string }[];
  readonly emptyReason: string | null;
};

const SURFACE_LABEL: Readonly<Record<DisclosureSurface, string>> = {
  article_top: "記事の冒頭",
  sns_body: "SNS の本文",
  near_cta: "購入ボタンの近く",
  product_card: "商品のカード",
  ai_answer: "AI の回答",
  webmcp_response: "ページ内 AI の応答",
  comparison_table: "比較表",
  publication_preview: "投稿前の下書き",
};

/**
 * 広告表記の設定を返す。
 *
 * 文言はここでも画面でも作らない。domain が組み立てたものをそのまま出す。
 * 画面で書かせると必ず短縮され、「PR」だけの分かりにくい表示になる。
 */
export function createListDisclosuresUseCase(
  deps: ManageWorkspaceDeps,
): UseCase<Record<string, never>, ListDisclosuresOutput> {
  return {
    async execute(actor: ActorContext): Promise<Result<ListDisclosuresOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "広告表記の参照");
      if (!allowed.ok) return allowed;

      const listed = await deps.disclosures.list(actor.workspaceId, { limit: 100, cursor: null });
      if (!listed.ok) return listed;

      const rows = listed.value.items.map((d): DisclosureRow => ({
        disclosureId: String(d.id),
        relationshipLabel: RELATIONSHIP_SHORT_LABEL[d.relationshipType],
        required: requiresDisclosure(d.relationshipType),
        visibleMessage: d.visibleMessage,
        advertiserOrSupplier: d.advertiserOrSupplier,
        aiAssisted: d.aiAssisted,
        relAttribute: relAttributeFor(d.relationshipType),
      }));

      return ok({
        rows,
        surfaces: DISCLOSURE_SURFACES.map((key) => ({ key, label: SURFACE_LABEL[key] })),
        emptyReason: rows.length === 0 ? "広告表記がまだ登録されていません。" : null,
      });
    },
  };
}

// --- 操作の記録 -------------------------------------------------------------

export type AuditRow = {
  readonly action: string;
  readonly actorLabel: string;
  /** 人の操作かどうか。承認が機械で済まされていないことを、ここで見分ける。 */
  readonly byHuman: boolean;
  readonly occurredAt: Date;
  readonly targetLabel: string;
  readonly reason: string | null;
};

export const AUDIT_ACTION_LABEL: Readonly<Record<AuditAction, string>> = {
  "content.created": "記事を作った",
  "content.state_changed": "記事の状態を進めた",
  "content.approved": "記事を承認した",
  "content.published": "記事を公開した",
  "content.unpublished": "記事を取り下げた",
  "content.corrected": "記事を訂正した",
  "ranking_model.changed": "評価基準を変えた",
  "disclosure.changed": "広告表記を変えた",
  "policy_rule.changed": "表記のきまりを変えた",
  "affiliate_link.created": "提携リンクを作った",
  "affiliate_link.changed": "提携リンクを変えた",
  "connector.connected": "外部サービスにつないだ",
  "connector.disconnected": "外部サービスとの接続を切った",
  "member.role_changed": "担当者の役割を変えた",
  "export.performed": "データを書き出した",
};

export type ListAuditLogInput = { readonly limit?: number };
export type ListAuditLogOutput = {
  readonly rows: readonly AuditRow[];
  readonly emptyReason: string | null;
};

/**
 * 操作の記録を返す。
 *
 * 「人が承認した」を後から確かめるための記録なので、書き換えはできない。
 * 秘密の値は記録の時点で伏せられており、ここには届かない。
 */
export function createListAuditLogUseCase(
  deps: ManageWorkspaceDeps,
): UseCase<ListAuditLogInput, ListAuditLogOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: ListAuditLogInput,
    ): Promise<Result<ListAuditLogOutput, DomainError>> {
      const allowed = requireCapability(actor, "audit.read", "操作の記録の参照");
      if (!allowed.ok) return allowed;

      const searched = await deps.auditLog.search(
        actor.workspaceId,
        {},
        { limit: input.limit ?? 50, cursor: null },
      );
      if (!searched.ok) return searched;

      const rows = searched.value.items.map((e): AuditRow => ({
        action: AUDIT_ACTION_LABEL[e.action] ?? e.action,
        actorLabel: e.actor.isAiServiceAccount
          ? `AI（${e.actor.modelId ?? "機械"}）`
          : (e.actor.userId ?? "不明"),
        byHuman: !e.actor.isAiServiceAccount && e.actor.userId !== null,
        occurredAt: e.occurredAt,
        targetLabel: `${e.targetType} / ${e.targetId}`,
        reason: e.reason,
      }));

      return ok({
        rows,
        emptyReason: rows.length === 0 ? "まだ記録がありません。" : null,
      });
    },
  };
}
