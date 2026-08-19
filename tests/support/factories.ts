import type { Disclosure } from "@/domain/compliance";
import type { ChannelConnection, Publication } from "@/domain/distribution";
import type { Brand, Membership, Workspace } from "@/domain/identity";
import {
  DEFAULT_BRAND_VOICE,
  DEFAULT_CTA,
  DEFAULT_LOCALE,
  DEFAULT_TIME_ZONE,
} from "@/domain/identity";
import type { Conversion } from "@/domain/monetization";
import type { Product } from "@/domain/product/product";
import type { Provenance } from "@/domain/shared/provenance";
import type {
  AffiliateProgramId,
  AssetId,
  BrandId,
  CategoryId,
  ChannelConnectionId,
  ContentVariantId,
  ConversionId,
  DisclosureId,
  MembershipId,
  ProductId,
  PublicationId,
  SourceArtifactId,
  UserId,
  WorkspaceId,
} from "@/domain/shared/ids";
import { WORKSPACE } from "./actors";
import { NOW, daysFrom } from "./clock";

/**
 * テストで使う値の組み立て。
 *
 * **各テストが自前でエンティティを組み立てない。**
 * 組み立てると、型に項目を 1 つ足したとき全テストが型エラーになる。
 * 型に項目を足すのは日常的な変更なので、そのたびに数十ファイルを直す状態は、
 * 「変えやすい設計」をテストが打ち消していることを意味する。
 *
 * 書き方の決まり:
 *   - 既定値は**そのままで正しい**もの（検査を通る値）を入れる
 *   - テストが関心を持つ項目だけを引数で上書きする
 *   - 上書きしなかった項目に意味を持たせない（読む人が「4 という数に意味がある」と誤解する）
 *
 * ```ts
 * const product = aProduct({ name: "Alpha Studio 15" });
 * const stale = aProduct({ provenance: aProvenance({ retrievedAt: daysFrom(NOW, -400) }) });
 * ```
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §4 / docs/architecture/testing-architecture.md §2
 */

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

/** 連番を戻す。テスト間で ID が持ち越されると、比較の期待値が実行順に依存する。 */
export function resetFactories(): void {
  seq = 0;
}

/**
 * 出どころ。
 *
 * **既定は「公式・新しい・利用条件つき」**。
 * 古い出どころや信頼度の低い出どころを既定にすると、
 * 何も指定していないテストが「古いので表示しない」経路に入り、
 * テストが何を確かめているのか読めなくなる。
 */
export function aProvenance(over: Partial<Provenance> = {}): Provenance {
  return {
    sourceType: "official",
    sourceName: "メーカー公式サイト",
    sourceUrl: "https://example.com/official/spec",
    retrievedAt: daysFrom(NOW, -1),
    validUntil: daysFrom(NOW, 30),
    confidence: 0.95,
    permittedUsage: "仕様値の引用可。画像は販売店リンク併記時のみ。",
    ...over,
  } as Provenance;
}

/**
 * 商品。
 *
 * **報酬に関する項目を 1 つも持たない**（`Product` は Editorial 区分）。
 * ここに報酬を足せる形にすると、順位づけへ入り込む経路がテスト側から開く。
 */
export function aProduct(over: Partial<Product> = {}): Product {
  return {
    id: nextId("prod") as ProductId,
    workspaceId: WORKSPACE as WorkspaceId,
    brand: "テストブランド",
    name: `テスト商品 ${seq}`,
    manufacturer: "テスト製作所",
    categoryId: "cat-test" as CategoryId,
    identityKeys: [],
    description: "テスト用の商品です。",
    specifications: { 重さ: "1.2kg", 電池持ち: 12 },
    imageAssetIds: [] as readonly AssetId[],
    releaseDate: daysFrom(NOW, -180),
    discontinuedAt: null,
    officialUrl: "https://example.com/product",
    officialSourceIds: [] as readonly SourceArtifactId[],
    provenance: aProvenance(),
    ...over,
  } as Product;
}

/** 別の作業場所に属する商品。テナント分離の検査に使う。 */
export function aForeignProduct(workspaceId: WorkspaceId, over: Partial<Product> = {}): Product {
  return aProduct({ workspaceId, name: "他の作業場所の商品", ...over });
}

/**
 * 投稿（媒体へ出したもの、または出そうとしたもの）。
 *
 * 既定は**成功して公開済み**。失敗や予約を既定にすると、
 * 何も指定していないテストが「止まっている投稿」として数えられ、
 * 数を見るテストが軒並み読めなくなる。
 */
export function aPublication(over: Partial<Publication> = {}): Publication {
  return {
    id: nextId("pub") as PublicationId,
    workspaceId: WORKSPACE as WorkspaceId,
    variantId: nextId("cv") as ContentVariantId,
    channelKind: "own_site",
    connectionId: null,
    state: "PUBLISHED",
    scheduledAt: null,
    idempotencyKey: nextId("idem"),
    attempts: 1,
    externalId: null,
    externalUrl: null,
    lastError: null,
    publishedAt: NOW,
    ...over,
  } as Publication;
}

/**
 * 媒体とのつながり。
 *
 * 既定は**期限なしで生きている**。切れているものを既定にすると、
 * 「つながっていない媒体」の数え上げが常に 1 から始まってしまう。
 */
export function aChannelConnection(over: Partial<ChannelConnection> = {}): ChannelConnection {
  return {
    id: nextId("conn") as ChannelConnectionId,
    workspaceId: WORKSPACE as WorkspaceId,
    kind: "x",
    accountLabel: "@test",
    connectedAt: daysFrom(NOW, -30),
    expiresAt: null,
    revokedAt: null,
    credentialRef: "kv://test/credential",
    ...over,
  } as ChannelConnection;
}

/**
 * 成果（売れた記録）。
 *
 * 金額は**取り込んだままの値**だけを既定で持つ。
 * 手修正を既定に入れると、「取込値と手修正を別枠で持つ」という
 * 最も間違えやすい決まりを、テストが素通りさせてしまう。
 */
export function aConversion(over: Partial<Conversion> = {}): Conversion {
  return {
    id: nextId("cv-sale") as ConversionId,
    workspaceId: WORKSPACE as WorkspaceId,
    programId: "prog-test" as AffiliateProgramId,
    linkId: null,
    asp: "a8",
    externalConversionId: nextId("ext"),
    status: "confirmed",
    occurredAt: NOW,
    confirmedAt: NOW,
    ingestedReward: { amountMinor: 100_000, currency: "JPY" },
    adjustedReward: null,
    adjustmentReason: null,
    period: "2026-08",
    periodClosed: false,
    ...over,
  } as Conversion;
}

/**
 * 作業場所（ワークスペース）。
 *
 * 既定は**止まっておらず、上限に余裕のある**状態。
 * 止まっている状態を既定にすると、何も指定していないテストが
 * 「公開できません」の経路に入り、何を確かめているのか読めなくなる。
 */
export function aWorkspace(over: Partial<Workspace> = {}): Workspace {
  return {
    id: WORKSPACE as WorkspaceId,
    name: "テスト編集部",
    plan: "team",
    ownerUserId: "user-owner" as UserId,
    timezone: "Asia/Tokyo",
    currency: "JPY",
    createdAt: daysFrom(NOW, -365),
    suspendedAt: null,
    ...over,
  } as Workspace;
}

/**
 * 担当者。
 *
 * 既定は**参加済みで解除されていない**。招待中を既定にすると、
 * 「参加している人が何人いるか」を数えるテストが常に 0 から始まる。
 */
export function aMembership(over: Partial<Membership> = {}): Membership {
  return {
    id: nextId("mem") as MembershipId,
    workspaceId: WORKSPACE as WorkspaceId,
    userId: nextId("user") as UserId,
    roles: ["writer"],
    scopedBrandIds: [],
    displayName: `担当者 ${seq}`,
    invitedAt: daysFrom(NOW, -60),
    acceptedAt: daysFrom(NOW, -59),
    revokedAt: null,
    ...over,
  } as Membership;
}

/**
 * ブランド。
 *
 * 既定は**公開の準備が整っている**（運営者名と問い合わせ先がある）。
 * 欠けた状態を既定にすると、公開ゲートを見るテストが全部
 * 「準備できていない」側に落ちる。
 */
export function aBrand(over: Partial<Brand> = {}): Brand {
  return {
    id: nextId("brand") as BrandId,
    workspaceId: WORKSPACE as WorkspaceId,
    displayName: "テストブランド",
    legalName: "テスト合同会社",
    contactEmail: "contact@example.com",
    positioning: "実際に使った記録だけを載せます。",
    voice: DEFAULT_BRAND_VOICE,
    disclaimer: "記事の内容は執筆時点のものです。",
    // すぐ上の voice と同じで、ここは「ブランドの既定値」を置いている場所である。
    // 素の字で書くと、既定値が変わった日にこの雛形だけが古い値を配り続ける。
    locale: DEFAULT_LOCALE,
    timeZone: DEFAULT_TIME_ZONE,
    defaultCta: DEFAULT_CTA,
    createdAt: daysFrom(NOW, -300),
    ...over,
  } as Brand;
}

/**
 * 広告表記。
 *
 * 既定は**表示が必要な関係（提携）**。自費購入を既定にすると、
 * 「表示が要るか」の判定が常に false 側になり、抜けに気づけない。
 */
export function aDisclosure(over: Partial<Disclosure> = {}): Disclosure {
  return {
    id: nextId("disc") as DisclosureId,
    workspaceId: WORKSPACE as WorkspaceId,
    relationshipType: "affiliate",
    advertiserOrSupplier: "テスト広告主",
    editorialInfluence: "none",
    visibleMessage: "この記事にはアフィリエイト広告が含まれます。",
    aiAssisted: false,
    ...over,
  } as Disclosure;
}

/**
 * 境界値のための数の並び。
 *
 * 0 / 1 / 上限 / 上限+1 を毎回手で書かない。書くと**上限+1 を書き忘れる**。
 * 抜けるのはいつも「1 つ超えた側」で、そこが壊れたときの被害が最も大きい。
 */
export function boundaryValues(limit: number): readonly {
  value: number;
  label: string;
  inRange: boolean;
}[] {
  return [
    { value: 0, label: "0（下限の外側ちょうど）", inRange: limit >= 0 },
    { value: 1, label: "1（最小）", inRange: limit >= 1 },
    { value: limit, label: `${limit}（上限ちょうど）`, inRange: true },
    { value: limit + 1, label: `${limit + 1}（上限+1）`, inRange: false },
  ];
}

/**
 * 日付の境界。
 *
 * 時差があると「昨日」の判定が国によって変わる。
 * 判定はすべて UTC で行い、表示側だけが地域を持つ、という決まりを固定するために使う。
 */
export function dateBoundaries(base: Date = NOW) {
  return {
    justBefore: new Date(base.getTime() - 1),
    exact: base,
    justAfter: new Date(base.getTime() + 1),
    /** その日の始まり（UTC）。日単位の集計が 1 日ずれる不具合はここで出る。 */
    startOfDayUtc: new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 0, 0, 0, 0),
    ),
    /** 日本時間の同じ日の始まり。UTC と 9 時間ずれる。 */
    startOfDayJst: new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), -9, 0, 0, 0),
    ),
  };
}
