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
  changeMembershipRoles,
  createMembership,
  isActiveMembership,
  limitsOf,
  missingPublishReadiness,
  normalizeInvitedEmail,
  requireCapability,
  revokeMembership,
} from "@/domain/identity";
import {
  type ActorContext,
  type BrandId,
  type DomainError,
  type MembershipId,
  type Result,
  type Role,
  asBrandId,
  domainError,
  err,
  ok,
  taggedString,
} from "@/domain/shared";
import { type AuditClock, auditWriteFailure, buildAuditEntry } from "@/application/audit";
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
  feedback_admin: "使い勝手の担当",
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
  "improvement.run": "改善ループを回す",
  "improvement.approve": "試作を承認する",
  "audit.read": "操作の記録を見る",
  "feedback.submit": "改善要望を送る",
  "feedback.read": "改善要望を見る",
  "feedback.status_update": "改善要望の対応状況を変える",
  "feedback.manage": "改善要望の扱いを決める",
  "integration_key.manage": "取得用の鍵を管理する",
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
  "feedback_admin",
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
          // 役割の表から引くと、機械の役割にはもともと入っていないため常に空になり、
          // 「AI には何ができないのか」が画面から消える。人が行うと決めた一覧を直接出す。
          humanOnlyBlocked: isMachine
            ? [...HUMAN_ONLY_CAPABILITIES].map((c) => CAPABILITY_LABEL[c])
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
  /**
   * 招待したアドレス。**画面に出す。**
   *
   * 表示名は招待した人が付けた呼び名なので、同じ名前を 2 人に付けられる。
   * どの行がどのアドレス宛かが見えないと、外す相手を取り違える。
   */
  readonly invitedEmail: string;
  /** そのままの役割。役割を変える画面が、いまの状態を選択済みにするために要る。 */
  readonly roles: readonly Role[];
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
          invitedEmail: m.invitedEmail,
          roles: m.roles,
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

// --- 担当者を書く（招待・役割の変更・取り消し） -------------------------------

/**
 * 書く側の依存。読む側（`ManageWorkspaceDeps`）に、ID と時計を足しただけ。
 *
 * 時計を引数で受けるのは、**招待した日と外した日が記録に残る**ため。
 * `new Date()` を中で呼ぶと、その 2 つを検査で固定できない。
 */
export type ManageMembersDeps = ManageWorkspaceDeps & AuditClock;

export type ManageMembersInput =
  /** 招待を出す。まだ `user_id` は決まらない（初回ログインで埋まる）。 */
  | {
      readonly action: "invite";
      readonly invitedEmail: string;
      readonly displayName: string;
      readonly roles: readonly Role[];
      readonly scopedBrandIds?: readonly string[];
    }
  /** 役割を変える。参加済みかどうかに関わらず変えられる。 */
  | {
      readonly action: "change_roles";
      readonly membershipId: string;
      readonly roles: readonly Role[];
      readonly reason?: string;
    }
  /** 担当から外す。行は消さず、外した日が入る。 */
  | {
      readonly action: "revoke";
      readonly membershipId: string;
      readonly reason?: string;
    };

export type ManageMembersOutput = {
  readonly membershipId: string;
  /** 画面に出す一文。何が起き、次に何が起きるかを書く。 */
  readonly message: string;
};

/** 記録に理由が要る操作なので、書かれていなければこちらで埋める。空では記録できない。 */
const DEFAULT_REASON: Readonly<Record<ManageMembersInput["action"], string>> = {
  invite: "担当者を招待した",
  change_roles: "担当者の役割を変えた",
  revoke: "担当から外した",
};

/**
 * 空白だけの理由は「書かれていない」と同じに扱う。
 *
 * 画面の入力欄は未入力でも空文字を送ってくるので、`?? 既定値` では拾えない。
 * 空のまま記録へ渡すと `member.role_changed` は理由が要る操作なので断られ、
 * **保存は済んでいるのに操作全体が失敗したように見える。**
 */
function reasonOr(given: string | undefined, fallback: string): string {
  const trimmed = (given ?? "").trim();
  return trimmed === "" ? fallback : trimmed;
}

/**
 * 担当者の登録を書く。招待の追加・役割の変更・担当の取り消し。
 *
 * --- 3 つを 1 つの口にしている理由 ---
 * どれも「入ってよい人の一覧」を変える操作で、必要な権限（`member.manage`）も、
 * 残す記録（`member.role_changed`）も同じである。画面側だけ 3 つに割ると、
 * 権限の確認と記録の書き出しが 3 か所に散り、どれか 1 つが緩いまま残る。
 *
 * --- ここに「最初に入った人を管理者にする」処理を足さない ---
 * 画面から書けなかった頃の名残で、そういう特例を置きたくなる場面がある。
 * 置くと、**誰でも最初の 1 人になれる口が、認証が入ったあとも残る**。
 * 運営者の最初の 1 行は手で入れる（`docs/product/first-owner-row.md`）。
 *
 * --- 作業場所の上限をここで見ていない ---
 * 担当者の数の上限（プランごと）は `getOverview` が出しているが、招待の側では
 * 見ていない。作業場所そのものの保存先がまだ見本で、実在する作業場所を引くと
 * 「見つかりません」で落ちるためである。**本物の招待を、見本の有無に
 * 依存させない。** 上限の確認は作業場所を本物にするときに足す（残作業）。
 */
export function createManageMembersUseCase(
  deps: ManageMembersDeps,
): UseCase<ManageMembersInput, ManageMembersOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: ManageMembersInput,
    ): Promise<Result<ManageMembersOutput, DomainError>> {
      // 人だけが行える操作（`HUMAN_ONLY_CAPABILITIES`）。AI からは通らない。
      const allowed = requireCapability(actor, "member.manage", "担当者の管理");
      if (!allowed.ok) return allowed;

      const now = deps.now();

      if (input.action === "invite") {
        const invitedEmail = normalizeInvitedEmail(input.invitedEmail);
        // 先に引く。引かずに保存すると、二重の招待が保存先の一意制約で落ち、
        // 「保存できませんでした」という**直しようのない断り**になる。
        const existing = await deps.memberships.findByInvitedEmail(
          actor.workspaceId,
          invitedEmail,
        );
        if (!existing.ok) return existing;
        if (existing.value !== null) {
          return err(
            domainError("CONFLICT", `${invitedEmail} には、すでに行があります。`, {
              field: "invitedEmail",
              suggestedAction:
                "一覧のその行から役割を変えてください。外した人を戻す場合も同じ行を使います。",
            }),
          );
        }

        if (input.roles.includes("owner")) {
          // 運営者は 1 作業場所に 1 人。domain は他の行を知らないので、ここで見る。
          const owner = await deps.memberships.findOwner(actor.workspaceId);
          if (!owner.ok) return owner;
          if (owner.value !== null) {
            return err(
              domainError("CONFLICT", "運営者はすでにいます。", {
                field: "roles",
                suggestedAction:
                  "運営者を引き継ぐときは、先にいまの運営者の役割を変えてください。",
              }),
            );
          }
        }

        const built = createMembership({
          id: taggedString<"MembershipId">(`mb_${deps.ids.newId()}`) as MembershipId,
          workspaceId: actor.workspaceId,
          invitedEmail,
          roles: input.roles,
          scopedBrandIds: (input.scopedBrandIds ?? []).map(
            (id) => asBrandId(id) as BrandId,
          ),
          displayName: input.displayName,
          invitedAt: now,
        });
        if (!built.ok) return built;

        const saved = await deps.memberships.save(built.value);
        if (!saved.ok) return saved;

        const entry = buildAuditEntry(deps, actor, {
          action: "member.role_changed",
          targetType: "membership",
          targetId: String(built.value.id),
          before: null,
          after: { invitedEmail, roles: [...input.roles], state: "invited" },
          reason: DEFAULT_REASON.invite,
        });
        if (!entry.ok) return entry;
        const appended = await deps.auditLog.append(entry.value);
        if (!appended.ok) {
          return err(
            auditWriteFailure(`${invitedEmail} への招待は保存されています`, {
              membershipId: String(built.value.id),
            }),
          );
        }

        return ok({
          membershipId: String(built.value.id),
          message:
            `${invitedEmail} を招待しました。` +
            "この人が Google で初めてログインしたときに参加が成立します（名簿にも載っている必要があります）。",
        });
      }

      // --- ここから先は、既にある行を変える ---------------------------------
      const found = await deps.memberships.findById(
        actor.workspaceId,
        taggedString<"MembershipId">(input.membershipId) as MembershipId,
      );
      if (!found.ok) return found;
      if (found.value === null) {
        return err(
          domainError("NOT_FOUND", "その担当者の行が見つかりません。", {
            suggestedAction: "画面を開き直してください。すでに変更されている可能性があります。",
          }),
        );
      }
      const target = found.value;
      const before = { roles: [...target.roles], revoked: target.revokedAt !== null };

      if (input.action === "change_roles") {
        // **最後の運営者から運営者を外させない。** 外せると、契約と支払いに関する
        // 操作を誰も行えない作業場所ができる。しかもそれを直す操作自体が
        // 運営者の権限を要るので、画面からは戻せなくなる。
        if (target.roles.includes("owner") && !input.roles.includes("owner")) {
          return err(
            domainError("INVARIANT_VIOLATED", "いまの運営者から運営者の役割を外せません。", {
              field: "roles",
              suggestedAction:
                "先に別の人を運営者として招待し、引き継いでから外してください。",
            }),
          );
        }
        if (input.roles.includes("owner") && !target.roles.includes("owner")) {
          const owner = await deps.memberships.findOwner(actor.workspaceId);
          if (!owner.ok) return owner;
          if (owner.value !== null && String(owner.value.id) !== String(target.id)) {
            return err(
              domainError("CONFLICT", "運営者はすでにいます。", {
                field: "roles",
                suggestedAction: "運営者は 1 人だけです。先にいまの運営者の役割を変えてください。",
              }),
            );
          }
        }

        const changed = changeMembershipRoles(target, input.roles);
        if (!changed.ok) return changed;
        const saved = await deps.memberships.save(changed.value);
        if (!saved.ok) return saved;

        const entry = buildAuditEntry(deps, actor, {
          action: "member.role_changed",
          targetType: "membership",
          targetId: String(target.id),
          before,
          after: { roles: [...input.roles], revoked: false },
          reason: reasonOr(input.reason, DEFAULT_REASON.change_roles),
        });
        if (!entry.ok) return entry;
        const appended = await deps.auditLog.append(entry.value);
        if (!appended.ok) {
          return err(
            auditWriteFailure(`${target.displayName} の役割は変わっています`, {
              membershipId: String(target.id),
            }),
          );
        }

        return ok({
          membershipId: String(target.id),
          message: `${target.displayName} の役割を ${input.roles
            .map((r) => ROLE_LABEL[r])
            .join("・")} にしました。次に画面を開いたときから効きます。`,
        });
      }

      // --- 取り消し ---------------------------------------------------------
      if (target.revokedAt !== null) {
        return ok({
          membershipId: String(target.id),
          message: `${target.displayName} はすでに担当から外れています。`,
        });
      }
      if (target.roles.includes("owner")) {
        return err(
          domainError("INVARIANT_VIOLATED", "運営者は担当から外せません。", {
            suggestedAction:
              "先に別の人を運営者にしてから、この人の役割を変えて外してください。",
          }),
        );
      }
      // 自分の行を自分で外させない。外した瞬間に、戻すための権限も無くなる。
      if (target.userId !== null && String(target.userId) === actor.userId) {
        return err(
          domainError("INVARIANT_VIOLATED", "自分を担当から外すことはできません。", {
            suggestedAction: "別の管理担当に外してもらってください。",
          }),
        );
      }

      const revoked = revokeMembership(target, now);
      const saved = await deps.memberships.save(revoked);
      if (!saved.ok) return saved;

      const entry = buildAuditEntry(deps, actor, {
        action: "member.role_changed",
        targetType: "membership",
        targetId: String(target.id),
        before,
        after: { roles: [...target.roles], revoked: true },
        reason: reasonOr(input.reason, DEFAULT_REASON.revoke),
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(
          auditWriteFailure(`${target.displayName} は担当から外れています`, {
            membershipId: String(target.id),
          }),
        );
      }

      return ok({
        membershipId: String(target.id),
        message:
          `${target.displayName} を担当から外しました。` +
          "次のログインから入れなくなります（いま開いている画面は、通行証の期限までは動きます）。",
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
  /** 言語・時間帯・標準の行動文言。記事ごとに書き起こさないための既定値。 */
  readonly locale: string;
  readonly timeZone: string;
  readonly defaultCta: string;
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
        locale: b.locale,
        timeZone: b.timeZone,
        defaultCta: b.defaultCta,
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
  "content.state_changed": "記事の状態を進めた",
  "content.approved": "記事を承認した",
  "content.published": "記事を公開した",
  "content.unpublished": "記事を取り下げた",
  "content.corrected": "記事を訂正した",
  "ranking_model.changed": "評価基準を変えた",
  "disclosure.changed": "広告表記を変えた",
  "policy_rule.changed": "表記のきまりを変えた",
  // 受信箱の 3 語。読む人が「受け取り → 宛先決め → 対象外」の順で追えるようにする。
  "affiliate_link.created": "成果リンクを受け取った",
  "affiliate_link.changed": "成果リンクの宛先を決めた",
  "affiliate_link.rejected": "成果リンクを対象外にした",
  "connector.connected": "外部サービスにつないだ",
  "connector.disconnected": "外部サービスとの接続を切った",
  "member.role_changed": "担当者の役割を変えた",
  "export.performed": "データを書き出した",
  "llm_credential.registered": "生成 AI の API キーを登録した",
  "llm_credential.revoked": "生成 AI の API キーを失効させた",
  "publication.schedule_changed": "配信の予定を変えた",
  "integration_key.issued": "取得用の鍵を発行した",
  "integration_key.revoked": "取得用の鍵を止めた",
  "site.created": "サイトを作った",
  // 作る前の下書き。「始めた → 段階を埋めた」で、作るまでの道のりが追える。
  "site_draft.started": "ブログを作り始めた",
  "site_draft.step_saved": "ブログ作成の入力を保存した",
  "conversion.adjusted": "成果の数字を手で直した",
  // 改善要望の 3 語。「届いた → 扱いを決めた → 外へ出した」の順で追える。
  "feedback.submitted": "改善要望が届いた",
  "feedback.status_changed": "改善要望の扱いを変えた",
  "feedback.handed_off": "改善要望を指示文として払い出した",
  // 改善ループの 6 語。「試作を作る → 承認する」と「始める → 測る → 決める／やめる」。
  "variant_spec.drafted": "見せ方の試作を登録した",
  "variant_spec.approved": "見せ方の試作を承認した",
  "loop_run.started": "見せ方の比較を始めた",
  "loop_run.observed": "比較の観測値を記録した",
  "loop_run.concluded": "比較を判定した",
  "loop_run.stopped": "比較を打ち切った",
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
