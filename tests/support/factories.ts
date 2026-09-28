import type {
  BlogLayoutBandRecord,
  BlogLayoutSlotRecord,
  PublicSiteReader,
  SiteNetworkRecord,
} from "@/application/ports/blog-ops";
import type { ArticleSummary } from "@/application/read-models/published-article";
import type { PublicSiteBlueprint } from "@/application/usecases/site/read-site";
import { toPublicBlueprint } from "@/application/usecases/site/read-site";
import type { SiteBlueprint } from "@/domain/authoring/site-blueprint";
import { DEFAULT_THEME, createSiteBlueprint } from "@/domain/authoring/site-blueprint";
import type { ContentPackage, ContentVariant } from "@/domain/authoring";
import type { AuditLogEntry, Disclosure } from "@/domain/compliance";
import type { Evidence } from "@/domain/evidence";
import type { ChannelConnection, Publication } from "@/domain/distribution";
import type { Brand, Membership, Workspace } from "@/domain/identity";
import {
  DEFAULT_BRAND_VOICE,
  DEFAULT_CTA,
  DEFAULT_LOCALE,
  DEFAULT_TIME_ZONE,
  DEFAULT_WORKSPACE_CURRENCY,
  DEFAULT_WORKSPACE_TIME_ZONE,
} from "@/domain/identity";
import type { Conversion } from "@/domain/monetization";
import type { Product } from "@/domain/product/product";
import type { Provenance } from "@/domain/shared/provenance";
import type {
  AffiliateProgramId,
  AssetId,
  AuditLogId,
  BrandId,
  CategoryId,
  ChannelConnectionId,
  ContentVariantId,
  ConversionId,
  EvidenceId,
  DisclosureId,
  MembershipId,
  ProductId,
  PublicationId,
  SourceArtifactId,
  UserId,
  WorkspaceId,
} from "@/domain/shared/ids";
import { asSiteBlueprintId, asUserId, asWorkspaceId } from "@/domain/shared/ids";
import { ok } from "@/domain/shared/result";
import type { PublicSiteProjection } from "@/presentation/site/public-site-projection";
import type { SiteChrome } from "@/presentation/ui/templates/site-shell";
import {
  SAMPLE_AUDIENCE_PERSONAS,
  SAMPLE_AUTHOR_PERSONAS,
  SAMPLE_CONTENT_PACKAGES,
} from "@/infrastructure/persistence/sample/content-editorial-sample-repository";
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
    // 正本の SourceType は api/manufacturer/merchant/structured_data/manual/test の 6 種。
    // ここは長く `"official"` という**存在しない値**を入れていたが、
    // 戻り値の `as Provenance` がそれを黙らせていた。
    sourceType: "manufacturer",
    sourceName: "メーカー公式サイト",
    sourceUrl: "https://example.com/official/spec",
    retrievedAt: daysFrom(NOW, -1),
    validUntil: daysFrom(NOW, 30),
    confidence: 0.95,
    permittedUsage: "仕様値の引用可。画像は販売店リンク併記時のみ。",
    ...over,
  };
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

/**
 * 根拠（実測・仕様書・第三者検査などの出どころ）。
 *
 * 既定は**引用の要る形が全部埋まっている**もの。出どころ・許諾・
 * 改ざん検出用のハッシュを空にすると、根拠として保存できない状態が
 * 既定になり、何も指定していないテストが「不備のある根拠」を扱うことになる。
 *
 * `{ id } as Evidence` のような形をやめるために置く——あれは 10 項目のうち
 * 1 つしか持たず、**根拠を数えるだけの検査でも別の型**を流していた。
 */
export function anEvidence(over: Partial<Evidence> = {}): Evidence {
  return {
    id: nextId("ev") as EvidenceId,
    workspaceId: WORKSPACE as WorkspaceId,
    type: "test_result",
    title: `テスト根拠 ${seq}`,
    sourceOwner: "テスト計測室",
    capturedAt: daysFrom(NOW, -30),
    urlOrAssetId: "https://example.com/evidence",
    excerptOrSummary: "テスト用の要約です。",
    licenseOrPermission: "許諾済み",
    integrityHash: "sha256:test",
    ...over,
  };
}

/** 別の作業場所に属する商品。テナント分離の検査に使う。 */
export function aForeignProduct(workspaceId: WorkspaceId, over: Partial<Product> = {}): Product {
  return aProduct({ workspaceId, name: "他の作業場所の商品", ...over });
}

/**
 * 操作の記録 1 行。
 *
 * 既定は**人が要求の中で行った、理由の要らない操作**。定期実行や AI の操作を
 * 既定にすると、`requestId` が `null` のまま通る道が既定になり、
 * 「断りの語では `null` を許さない」という正本の決まりを検査が踏まなくなる。
 *
 * `{ action, targetType, targetId } as never` のような 3 欄の形をやめるために置く。
 */
export function anAuditLogEntry(over: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: nextId("aud") as AuditLogId,
    workspaceId: WORKSPACE as WorkspaceId,
    action: "connector.connected",
    actor: {
      userId: asUserId("user-owner"),
      isAiServiceAccount: false,
      modelId: null,
      identified: true,
    },
    targetType: "channel_connection",
    targetId: "conn_1",
    before: null,
    after: null,
    reason: null,
    requestId: "req_test",
    occurredAt: NOW,
    ...over,
  };
}

/**
 * 企画（1 本の記事のもと）。
 *
 * 見本の企画を土台にし、検査の主題に関わる欄だけを上書きする。
 * 以前は所有ブランドを見るだけの検査が
 * `{ workspaceId, brandId } as never` と 2 欄だけの形を流していた。
 * 企画から別の欄を読む変更が入っても、型検査は黙ったままだった。
 */
export function aContentPackage(over: Partial<ContentPackage> = {}): ContentPackage {
  return { ...SAMPLE_CONTENT_PACKAGES[0]!, workspaceId: WORKSPACE as WorkspaceId, ...over };
}

/**
 * 版（企画から書き起こした 1 つの原稿）。
 *
 * 既定は**承認済みで法令検査も通っている**もの。差し戻し中を既定にすると、
 * 何も指定していない検査が「出せない原稿」を扱うことになる。
 */
export function aContentVariant(over: Partial<ContentVariant> = {}): ContentVariant {
  return {
    id: nextId("cv") as ContentVariantId,
    workspaceId: WORKSPACE as WorkspaceId,
    contentPackageId: SAMPLE_CONTENT_PACKAGES[0]!.id,
    channel: "own_site",
    format: "article",
    authorPersonaId: SAMPLE_AUTHOR_PERSONAS[0]!.id,
    audiencePersonaId: SAMPLE_AUDIENCE_PERSONAS[0]!.id,
    angle: "conclusion_first",
    title: "静かなノートパソコンの選び方",
    body: "結論から書く。\n\n書き出しの速さで選ぶ。",
    summary: "書き出しの速さで選ぶ。",
    cta: "check_official",
    disclosure: "この記事には広告が含まれます。",
    affiliateLinkIds: [],
    claimIds: [],
    evidenceIds: [],
    assumptions: [],
    platformWarnings: [],
    factualityScore: 0.9,
    personaFitScore: 0.8,
    channelFitScore: 0.8,
    complianceStatus: "pass",
    generationPromptVersion: "v1",
    modelId: "test",
    status: "approved",
    ...over,
  };
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
    variantRevision: 1,
    channelKind: "own_site",
    connectionId: null,
    state: "PUBLISHED",
    scheduledAt: null,
    retryAt: null,
    deliveryLeaseUntil: null,
    idempotencyKey: nextId("idem"),
    providerIdentity: null,
    providerDeliveryKey: null,
    providerRecordCreatedAt: null,
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
    providerIdentity: null,
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
    // ワークスペースの既定そのもの。素の字で置くと、既定が動いた日に
    // この雛形だけが古い値を配り、それを使う検査は全部そのまま緑になる。
    timezone: DEFAULT_WORKSPACE_TIME_ZONE,
    currency: DEFAULT_WORKSPACE_CURRENCY,
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
    // 招待したアドレス。既定は**参加済み**（`userId` が入っている）状態なので、
    // ここも埋まっている。招待だけの行を作るテストは `userId: null` と一緒に上書きする。
    invitedEmail: `member${seq}@example.com`,
    roles: ["writer"],
    scopedBrandIds: [],
    displayName: `担当者 ${seq}`,
    invitedAt: daysFrom(NOW, -60),
    acceptedAt: daysFrom(NOW, -59),
    revokedAt: null,
    ...over,
  };
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
 * ブログの設計図。
 *
 * **正本の組み立て口 `createSiteBlueprint` を通す。**上の雛形たちのように
 * リテラルを組んで `as SiteBlueprint` で締めると、必須項目が 1 つ増えた日に
 * ここは黙って通り、**壊れるのは実行時の画面**になる。実際 2026-09-08 に
 * `tests/ui/article-page-prose.test.tsx` がその形で落ちた——`vi.mock` の
 * factory が返す値には型検査が効かないため、`name` だけの設計図を渡していて、
 * 関連記事のカードが `theme` を読んだところで描画ごと死んでいた。
 *
 * コンストラクタを通すと 2 つが同時に手に入る:
 *   - 入力に必須項目が増えれば**このファイル 1 か所がコンパイルエラーになる**
 *   - 既定値が「検査を通る値」であることが、毎回実行時に確かめられる
 *     (通らなければ下の `throw` で落ちる。**既定が不正なまま配られない**)
 *
 * 既定は**公開できる状態**。信頼ページが揃い、カテゴリーが 1 つあり、
 * 差別化の 10 軸が全部埋まっている。欠けた状態を既定にすると、
 * 公開ゲートを見るテストが軒並み「まだ出せない」側へ落ちる。
 */
export function aSiteBlueprint(
  over: Partial<Parameters<typeof createSiteBlueprint>[0]> = {},
): SiteBlueprint {
  const built = createSiteBlueprint({
    /*
      **ここだけ `as` を使わない。**上の雛形群が `as ProductId` の形なのは
      歴史的なもので、正しくは印付き文字列の変換関数を通す。`as` は
      「印が付いていない文字列」も黙って通すので、印の意味が消える。
    */
    id: asSiteBlueprintId(nextId("site")),
    workspaceId: asWorkspaceId(WORKSPACE),
    name: "机まわり研究室",
    pattern: "specialist_review",
    purpose: "実際に使った机まわりの道具だけを記録する。",
    genre: "デスク環境",
    revenueModel: "affiliate",
    categories: [
      {
        slug: "keyboard",
        name: "キーボード",
        oneLine: "毎日打つ人が、打鍵感と静かさで選ぶための記録。",
        initialArticleTypes: ["review"],
      },
    ],
    differentiation: {
      targetReader: "在宅で 1 日 8 時間打つ人",
      searchIntent: "静かで疲れないものを 1 本に絞りたい",
      articlePurpose: "長期間使った後の状態を見せる",
      evaluationAxis: "静音性と打鍵の疲れにくさ",
      usageScene: "集合住宅の夜間",
      uniqueExperience: "同じ機種を 2 年使った記録",
      comparisonScope: "実際に買った 6 機種のみ",
      conclusionStance: "1 つだけ推す",
      internalLinkStrategy: "用途別の入口から個別レビューへ",
      ctaStrategy: "本文の結論の直後に 1 つだけ置く",
    },
    ...over,
  });
  if (!built.ok) {
    throw new Error(
      `aSiteBlueprint の既定値が正本の検査を通りません: ${built.error.message}`,
    );
  }
  return built.value;
}

/**
 * 読者へ出す設計図（作業場所の識別子が落ちた形）。
 *
 * **落とし方を写さない。** `toPublicBlueprint` が唯一の落とし口という決まりが
 * あるので、テストの雛形もそこを通す。ここで `workspaceId` を手で消すと、
 * 「消し忘れた 1 経路」を検出するはずのテストが、自前の消し方で緑になる。
 */
export function aPublicSiteBlueprint(
  over: Partial<Parameters<typeof createSiteBlueprint>[0]> = {},
): PublicSiteBlueprint {
  return toPublicBlueprint(aSiteBlueprint(over));
}

/**
 * 公開一覧に並ぶ記事の要約。
 *
 * 既定は**公開済みで、既定の設計図のカテゴリーに属する**。
 * `{ id: "article-1" } as never` のような形をやめるために置く——
 * あれは `ArticleSummary` の項目を 1 つも持っておらず、
 * 件数しか見ないテストでも**型としては別物**を流していた。
 */
export function anArticleSummary(over: Partial<ArticleSummary> = {}): ArticleSummary {
  const slug = nextId("article");
  return {
    slug,
    siteSlug: "kizukai",
    type: "review",
    title: `記事 ${slug}`,
    summary: `${slug} の要約。`,
    categorySlug: "keyboard",
    updatedAt: "2026-09-01T00:00:00.000Z",
    authorName: "編集部",
    ...over,
  };
}

/** ヘッダー・脇・フッターに置く枠 1 つ。既定は**表示される**。 */
export function aLayoutSlot(over: Partial<BlogLayoutSlotRecord> = {}): BlogLayoutSlotRecord {
  const id = nextId("slot");
  return {
    id,
    siteSlug: "kizukai",
    region: "sidebar",
    slotKey: id,
    title: "枠",
    body: "",
    position: 0,
    enabled: true,
    ...over,
  };
}

/** トップに積む帯 1 つ。既定は**表示され、5 件まで並べる**。 */
export function aLayoutBand(over: Partial<BlogLayoutBandRecord> = {}): BlogLayoutBandRecord {
  return {
    id: nextId("band"),
    siteSlug: "kizukai",
    band: "latest_posts",
    title: "新着",
    enabled: true,
    position: 0,
    itemLimit: 5,
    ...over,
  };
}

/** サイト網の節点 1 つ。既定は**運用中の子サイト**。 */
export function aSiteNetworkNode(over: Partial<SiteNetworkRecord> = {}): SiteNetworkRecord {
  const slug = nextId("site-node");
  return {
    id: `snn_${slug}`,
    siteSlug: slug,
    role: "sub",
    parentSlug: null,
    name: slug,
    oneLine: "",
    position: 0,
    status: "active",
    ...over,
  };
}

/**
 * 画面の枠（ヘッダーとフッターの導線）。
 *
 * 既定は**導線が 1 本も無い**。空の一覧を既定にするのは、
 * 「この検査は導線に関心が無い」を読める形にするため。
 * 何か入れておくと、読む人が「この 3 本に意味がある」と受け取る。
 */
export function aSiteChrome(over: Partial<SiteChrome> = {}): SiteChrome {
  return {
    siteName: "机まわり研究室",
    tagline: "実際に使った机まわりの道具だけを記録する。",
    brandTheme: DEFAULT_THEME.brandTheme,
    colorMode: DEFAULT_THEME.colorScheme,
    nav: [],
    categoryNav: [],
    homeHref: "/s/kizukai",
    searchHref: "/s/kizukai/search",
    allArticlesHref: "/s/kizukai/articles",
    aboutHref: "/s/kizukai/about",
    footer: [],
    footerCategories: [],
    feedHref: "/s/kizukai/feed.xml",
    ...over,
  };
}

/**
 * 公開サイトの読み口。**空だが正しい**状態が既定。
 *
 * 記事も枠も帯も 0 件で、どの読み取りも `ok` を返す。「読めなかった」を
 * 既定にすると、画面のテストが軒並み失敗表示の経路へ落ちて、
 * 主題を測る前に終わる。
 *
 * **`as unknown as PublicSiteReader` で作らない。**この形の痩せたモックが、
 * 実装が必須項目を足したときに素通りして実行時に落ちる原因だった。
 * 全メソッドをここで 1 度だけ埋めておけば、口が 1 つ増えた日に
 * **このファイルだけがコンパイルエラーになる**。
 */
export function aPublicSiteReader(over: Partial<PublicSiteReader> = {}): PublicSiteReader {
  return {
    blueprint: aPublicSiteBlueprint(),
    findArticleBySlug: async () => ok(null),
    listPublished: async () => ok([]),
    listFeaturedArticles: async () => ok({ selectedCount: 0, articles: [] }),
    findSourceArticleId: async () => ok(null),
    summarizeReaderRatings: async () => ok({}),
    listLayoutSlots: async () => ok([]),
    listProvisionedLayoutSlots: async () => ok([]),
    listLayoutBands: async () => ok([]),
    listProvisionedLayoutBands: async () => ok([]),
    listDeliveryParts: async () => ok([]),
    listNetwork: async () => ok([]),
    listTags: async () => ok([]),
    listDocuments: async () => ok([]),
    ...over,
  };
}

/**
 * `SiteFrame` が 1 回読んで画面全体へ配る投影。
 *
 * 既定は**実データ源の空のブログ**。`sample` を既定にすると、
 * 「見本を出しているか」を見るテストと区別がつかなくなる。
 *
 * `reader` を差し替えるときは `aPublicSiteReader({...})` を渡す。
 * 部分オブジェクトを直に置くと、この型の意味が消える。
 */
export function aPublicSiteProjection(
  over: Partial<PublicSiteProjection> = {},
): PublicSiteProjection {
  return {
    source: "live",
    reader: aPublicSiteReader(),
    slots: [],
    provisionedSlots: [],
    bands: [],
    provisionedBands: [],
    articles: [],
    featuredArticles: { selectedCount: 0, articles: [] },
    network: [],
    tags: [],
    documents: [],
    deliveryParts: [],
    chrome: { headerSlots: [], footerSlots: [] },
    ...over,
  };
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
