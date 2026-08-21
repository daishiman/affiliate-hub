import type { DisclosureRepositoryPort } from "@/application/ports/compliance";
import type {
  BrandRepositoryPort,
  MembershipRepositoryPort,
  WorkspaceRepositoryPort,
} from "@/application/ports/identity";
import type { Disclosure } from "@/domain/compliance";
import { buildVisibleMessage } from "@/domain/compliance";
import type { Brand, Membership, Workspace } from "@/domain/identity";
import {
  DEFAULT_BRAND_VOICE,
  DEFAULT_CTA,
  DEFAULT_LOCALE,
  DEFAULT_TIME_ZONE,
  normalizeInvitedEmail,
} from "@/domain/identity";
import { ok, taggedString } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "./ranking-sample-repository";
import { registerStub, stubCall } from "../../stub-registry";

/**
 * ★ これは仮置きの見本データです（スタブ）。★
 *
 * 設定・担当者・ブランド・広告表記・操作の記録を、画面で確かめられるところまで用意する。
 *
 * **わざと欠けている状態を混ぜてある。**
 *   - 問い合わせ先が未設定のブランド（公開できない理由が出るか）
 *   - 招待したがまだ参加していない担当者
 *   - 解除済みの担当者
 * すべて揃った状態だけを置くと、止まったときの見え方を誰も確かめないまま公開してしまう。
 */
const stub = registerStub({
  id: "persistence:settings-sample",
  // 操作の記録はここから外れた（`./audit-log-sample-repository.ts` の控えへ移った）。
  // 残したままにすると、控えで本当に書けているものを
  // 「保存先が無い」と数え続けることになる。
  port: "作業場所・ブランド・広告表記の保存先",
  label: "設定（見本データ）",
  blockedBy: "workspaces / brands / disclosures テーブルの追加",
});

/**
 * 担当者だけは、ここから外れた（`../d1/membership-repository.ts` の控えへ移った）。
 *
 * 招待の追加・役割の変更・担当の取り消しは D1 に本物がある。
 * まとめたままにすると、**本当に書けるものを「保存先が無い」と数え続ける**ことになり、
 * 台帳の件数が実際より多く見える。
 *
 * それでも見本が残るのは、保存先が供給されない実行（`pnpm dev`・自動テスト）が
 * あるためである。そこでは `save` が失敗を返す——**保存できないのに成功を装わない。**
 */
const membershipStub = registerStub({
  id: "persistence:membership-sample",
  port: "担当者の登録の保存先",
  label: "担当者（見本データ。保存はできません）",
  blockedBy: "済み（保存先は D1 の memberships）",
  fallbackFor: "src/infrastructure/persistence/d1/membership-repository.ts",
});

export function sampleSettingsNotice(): string {
  return `${stub.label}で表示しています（${stub.blockedBy}が済むまでの仮です）。`;
}

export const SAMPLE_BRAND_ID = taggedString<"BrandId">("br_sample");

const WORKSPACE: Workspace = {
  id: SAMPLE_WORKSPACE_ID,
  name: "見本の作業場所",
  plan: "team",
  ownerUserId: taggedString<"UserId">("u_owner"),
  timezone: "Asia/Tokyo",
  currency: "JPY",
  createdAt: new Date("2026-04-01T00:00:00Z"),
  suspendedAt: null,
};

/**
 * 見本の担当者。
 *
 * 役割は 1 人に 1〜2 個までにしてある。全部盛りの利用者を置くと、
 * 「権限が足りないときにどう見えるか」を確かめられなくなる。
 */
const MEMBERSHIPS: readonly Membership[] = [
  {
    id: taggedString<"MembershipId">("m_owner"),
    invitedEmail: "owner@example.com",
    workspaceId: SAMPLE_WORKSPACE_ID,
    userId: taggedString<"UserId">("u_owner"),
    roles: ["owner"],
    scopedBrandIds: [],
    displayName: "運営者（見本）",
    invitedAt: new Date("2026-04-01T00:00:00Z"),
    acceptedAt: new Date("2026-04-01T00:10:00Z"),
    revokedAt: null,
  },
  {
    id: taggedString<"MembershipId">("m_editor"),
    invitedEmail: "editor@example.com",
    workspaceId: SAMPLE_WORKSPACE_ID,
    userId: taggedString<"UserId">("u_sample"),
    roles: ["researcher", "writer", "reviewer"],
    scopedBrandIds: [],
    displayName: "編集担当（見本・いまログイン中）",
    invitedAt: new Date("2026-04-02T00:00:00Z"),
    acceptedAt: new Date("2026-04-02T01:00:00Z"),
    revokedAt: null,
  },
  {
    id: taggedString<"MembershipId">("m_contributor"),
    invitedEmail: "contributor@example.com",
    workspaceId: SAMPLE_WORKSPACE_ID,
    userId: taggedString<"UserId">("u_contrib"),
    roles: ["contributor"],
    // 担当ブランドを絞った例。ここが空でないと「すべてのブランド」にはならない。
    scopedBrandIds: [SAMPLE_BRAND_ID],
    displayName: "外部の書き手（見本）",
    invitedAt: new Date("2026-07-20T00:00:00Z"),
    // まだ参加していない。招待中の見え方を確かめるため。
    acceptedAt: null,
    revokedAt: null,
  },
  {
    id: taggedString<"MembershipId">("m_ai"),
    invitedEmail: "ai@example.com",
    workspaceId: SAMPLE_WORKSPACE_ID,
    userId: taggedString<"UserId">("u_ai"),
    roles: ["ai_service_account"],
    scopedBrandIds: [],
    displayName: "下書き用の AI（機械）",
    invitedAt: new Date("2026-04-03T00:00:00Z"),
    acceptedAt: new Date("2026-04-03T00:00:00Z"),
    revokedAt: null,
  },
  {
    id: taggedString<"MembershipId">("m_left"),
    invitedEmail: "left@example.com",
    workspaceId: SAMPLE_WORKSPACE_ID,
    userId: taggedString<"UserId">("u_left"),
    roles: ["analyst"],
    scopedBrandIds: [],
    displayName: "退任した担当（見本）",
    invitedAt: new Date("2026-05-01T00:00:00Z"),
    acceptedAt: new Date("2026-05-01T02:00:00Z"),
    // 解除済み。記録には残るが、いまは何もできない。
    revokedAt: new Date("2026-07-31T00:00:00Z"),
  },
];

const BRANDS: readonly Brand[] = [
  {
    id: SAMPLE_BRAND_ID,
    workspaceId: SAMPLE_WORKSPACE_ID,
    displayName: "見本ブランド",
    legalName: "見本編集部",
    contactEmail: "contact@example.com",
    positioning: "自分で試した範囲だけを書き、試していないことは試していないと書く。",
    voice: DEFAULT_BRAND_VOICE,
    disclaimer: "価格と仕様は変わることがあります。購入前に販売ページでご確認ください。",
    locale: DEFAULT_LOCALE,
    timeZone: DEFAULT_TIME_ZONE,
    defaultCta: DEFAULT_CTA,
    createdAt: new Date("2026-04-01T00:00:00Z"),
  },
  {
    id: taggedString<"BrandId">("br_second"),
    workspaceId: SAMPLE_WORKSPACE_ID,
    displayName: "2 本目のブランド（見本）",
    // 問い合わせ先が空。公開の前に埋める必要があることが画面に出る。
    legalName: "第二編集部",
    contactEmail: null,
    positioning: "価格の変動を追いかけ、買い時だけを伝える。",
    voice: { ...DEFAULT_BRAND_VOICE, firstPerson: "私たち", vocabulary: "plain" },
    disclaimer: null,
    locale: DEFAULT_LOCALE,
    timeZone: DEFAULT_TIME_ZONE,
    // 標準の行動文言をブランドごとに変えられることを見本で示す。
    defaultCta: "在庫を見る",
    createdAt: new Date("2026-06-15T00:00:00Z"),
  },
];

function disclosureOf(input: {
  id: string;
  relationshipType: Disclosure["relationshipType"];
  advertiserOrSupplier: string | null;
  editorialInfluence: Disclosure["editorialInfluence"];
  aiAssisted: boolean;
}): Disclosure {
  return {
    id: taggedString<"DisclosureId">(input.id),
    workspaceId: SAMPLE_WORKSPACE_ID,
    relationshipType: input.relationshipType,
    advertiserOrSupplier: input.advertiserOrSupplier,
    editorialInfluence: input.editorialInfluence,
    aiAssisted: input.aiAssisted,
    // 文言はドメインに作らせる。ここで手書きすると、画面ごとに表記が食い違う。
    visibleMessage: buildVisibleMessage({
      relationshipType: input.relationshipType,
      advertiserOrSupplier: input.advertiserOrSupplier,
      editorialInfluence: input.editorialInfluence,
      aiAssisted: input.aiAssisted,
    }),
  };
}

const DISCLOSURES: readonly Disclosure[] = [
  disclosureOf({
    id: "dc_affiliate",
    relationshipType: "affiliate",
    advertiserOrSupplier: null,
    editorialInfluence: "none",
    aiAssisted: true,
  }),
  disclosureOf({
    id: "dc_supplied",
    relationshipType: "supplied",
    advertiserOrSupplier: "見本メーカー株式会社",
    editorialInfluence: "limited",
    aiAssisted: false,
  }),
  disclosureOf({
    id: "dc_purchased",
    relationshipType: "purchased",
    advertiserOrSupplier: null,
    editorialInfluence: "none",
    aiAssisted: false,
  }),
];

export function createSampleWorkspaceRepository(): WorkspaceRepositoryPort {
  return {
    async findById(id) {
      return ok(String(id) === String(WORKSPACE.id) ? WORKSPACE : null);
    },
    async findByOwner(userId) {
      return ok(String(userId) === String(WORKSPACE.ownerUserId) ? [WORKSPACE] : []);
    },
    save: () => stubCall(stub, "作業場所の保存"),
    async countBrands() {
      return ok(BRANDS.length);
    },
    async countSites() {
      // 見本のブログは 2 本。site 側の見本と数を合わせてある。
      return ok(2);
    },
    async countMembers() {
      return ok(MEMBERSHIPS.length);
    },
    async countGenerationsThisMonth() {
      return ok(37);
    },
  };
}

export function createSampleMembershipRepository(): MembershipRepositoryPort {
  return {
    async findById(_workspaceId, id) {
      return ok(MEMBERSHIPS.find((m) => String(m.id) === String(id)) ?? null);
    },
    async findByUser(_workspaceId, userId) {
      return ok(
        MEMBERSHIPS.find(
          (m) => m.userId !== null && String(m.userId) === String(userId),
        ) ?? null,
      );
    },
    async findByInvitedEmail(_workspaceId, invitedEmail) {
      const normalized = normalizeInvitedEmail(invitedEmail);
      return ok(MEMBERSHIPS.find((m) => m.invitedEmail === normalized) ?? null);
    },
    async list(_workspaceId, page) {
      return ok({ items: MEMBERSHIPS.slice(0, page.limit), nextCursor: null });
    },
    save: () => stubCall(membershipStub, "担当者の保存"),
    async findOwner() {
      return ok(MEMBERSHIPS.find((m) => m.roles.includes("owner")) ?? null);
    },
  };
}

export function createSampleBrandRepository(): BrandRepositoryPort {
  return {
    async findById(_workspaceId, id) {
      return ok(BRANDS.find((b) => String(b.id) === String(id)) ?? null);
    },
    async list(_workspaceId, page) {
      return ok({ items: BRANDS.slice(0, page.limit), nextCursor: null });
    },
    save: () => stubCall(stub, "ブランドの保存"),
  };
}

export function createSampleDisclosureRepository(): DisclosureRepositoryPort {
  return {
    async findById(_workspaceId, id) {
      return ok(DISCLOSURES.find((d) => String(d.id) === String(id)) ?? null);
    },
    async list(_workspaceId, page) {
      return ok({ items: DISCLOSURES.slice(0, page.limit), nextCursor: null });
    },
    save: () => stubCall(stub, "広告表記の保存"),
  };
}

/*
 * 操作の記録は `./audit-log-sample-repository.ts` へ移した。
 *
 * ここから読み直せるようにしてあるのは、**取り込み経路を変えないため**。
 * `composition.ts` と試験の差し替えはこのファイルを指しており、
 * 経路を動かすと、控えの実装を入れた回に「差し替えが効かなくなった」という
 * 別の壊れ方が混ざる。中身の移動と経路の移動は同じ回にやらない。
 */
export {
  createSampleAuditLog,
  createUnavailableAuditLog,
  resetSampleAuditLog,
} from "./audit-log-sample-repository";
