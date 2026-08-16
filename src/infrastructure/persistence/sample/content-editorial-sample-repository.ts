import type {
  EditorialContentPackageRepositoryPort,
  EditorialContentVariantRepositoryPort,
  EditorialPersonaRepositoryPort,
} from "@/application/ports/authoring";
import type { Page } from "@/application/ports/common";
import {
  type AudiencePersona,
  type AuthorPersona,
  type ContentPackage,
  type ContentState,
  type ContentVariant,
  createAuthorPersona,
  createContentPackage,
  createContentVariant,
} from "@/domain/authoring";
import { buildVisibleMessage } from "@/domain/compliance";
import {
  type AudiencePersonaId,
  type AuthorPersonaId,
  type ContentPackageId,
  type ContentVariantId,
  type WorkspaceId,
  domainError,
  err,
  markEditorial,
  ok,
  taggedString,
} from "@/domain/shared";
import { registerStub } from "../../stub-registry";
import { SAMPLE_PRODUCTS, SAMPLE_WORKSPACE_ID } from "./ranking-sample-repository";

/**
 * ★ これは仮置きの見本データです（スタブ）。★
 *
 * 記事の進行（かんばん）と自動確認の画面を、実データ無しで通すための見本。
 *
 * **わざと「合格しない下書き」を混ぜてある。**
 * すべて合格の見本しか置かないと、指摘が出たときの画面を
 * 一度も見ないまま公開の仕組みを組むことになる。
 */
const stub = registerStub({
  id: "persistence:content-editorial-sample",
  port: "記事・企画・書き手の保存先",
  label: "記事と書き手（見本データ）",
  blockedBy: "content_packages / content_variants / personas テーブルの追加とマイグレーション",
});

export function sampleEditorialContentNotice(): string {
  return `${stub.label}で表示しています（${stub.blockedBy}が済むまでの仮です）。`;
}

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const AUTHOR_ID = taggedString<"AuthorPersonaId">("ap_editor") as AuthorPersonaId;
const AUDIENCE_ID = taggedString<"AudiencePersonaId">("dp_video_beginner") as AudiencePersonaId;
const PACKAGE_ID = taggedString<"ContentPackageId">("cp_laptop_2026") as ContentPackageId;

function unwrap<T>(built: { ok: boolean; value?: T; error?: { message: string } }, what: string): T {
  if (!built.ok || built.value === undefined) {
    throw new Error(`見本の${what}が不正です: ${built.error?.message ?? "不明"}`);
  }
  return built.value;
}

const AUTHOR: AuthorPersona = unwrap(
  createAuthorPersona({
    id: AUTHOR_ID,
    workspaceId: WS,
    displayName: "編集部",
    personaType: "editorial_team",
    role: "映像編集の道具をためす担当",
    expertise: ["動画編集", "ノートPC"],
    knowledgeLevel: "intermediate",
    firstPersonPronoun: "編集部",
    readerAddress: "あなた",
    tone: {
      formality: 0.6,
      analytical: 0.8,
      emotional: 0.3,
      assertiveness: 0.5,
      humor: 0.1,
      emojiUsage: 0,
    },
    prohibitedPhrases: ["神アプリ", "爆速"],
    disclosureStyle: "本文のはじめに1行で書く",
    ctaStyle: "押しつけない。判断材料を出してから置く",
    // 実測記録がまだ 1 件も無いので、一人称の体験は書けない設定にしてある。
    factBoundary: ["公表仕様の読み解き", "他社比較"],
  }),
  "書き手",
);

const PACKAGE: ContentPackage = unwrap(
  createContentPackage({
    id: PACKAGE_ID,
    workspaceId: WS,
    brandId: "brand_sample",
    primarySubjectId: SAMPLE_PRODUCTS[0]!.id,
    claimIds: [taggedString<"ClaimId">("cl_alpha_export")],
    evidenceIds: [taggedString<"EvidenceId">("ev_export_time")],
    authorPersonaId: AUTHOR_ID,
    audiencePersonaIds: [AUDIENCE_ID],
    objective: "動画編集を始めた人が、書き出しの速さで機種を選べるようにする",
    funnelStage: "consideration",
    contentAngles: ["data_first", "comparison_first"],
  }),
  "企画",
);

/**
 * 広告表示の文言。
 *
 * 見本データでも文言を直接書かない。domain の組み立て関数から取る。
 * ここで手書きすると、法令要件が変わったときに直す場所が増える。
 */
const DISCLOSURE_TEXT = buildVisibleMessage({
  relationshipType: "affiliate",
  advertiserOrSupplier: null,
  editorialInfluence: "none",
  aiAssisted: true,
});

function variant(input: {
  id: string;
  channel: string;
  title: string | null;
  body: string;
  summary: string;
  withClaims: boolean;
  compliance: "pass" | "warning" | "fail";
}): ContentVariant {
  return unwrap(
    createContentVariant({
      id: taggedString<"ContentVariantId">(input.id) as ContentVariantId,
      workspaceId: WS,
      contentPackageId: PACKAGE_ID,
      channel: input.channel,
      format: "article",
      authorPersonaId: AUTHOR_ID,
      audiencePersonaId: AUDIENCE_ID,
      angle: "data_first",
      title: input.title,
      body: input.body,
      summary: input.summary,
      cta: "read_detail",
      disclosure: DISCLOSURE_TEXT,
      claimIds: input.withClaims ? [taggedString<"ClaimId">("cl_alpha_export")] : [],
      evidenceIds: input.withClaims ? [taggedString<"EvidenceId">("ev_export_time")] : [],
      factualityScore: input.withClaims ? 0.9 : 0.4,
      personaFitScore: 0.8,
      channelFitScore: 0.8,
      complianceStatus: input.compliance,
      generationPromptVersion: "sample-v0",
      modelId: "sample-model",
    }),
    "記事",
  );
}

/**
 * 見本の記事。
 *
 * 2 本目はわざと欠陥を入れてある（数値はあるのに根拠が無い・デメリットが無い・
 * 誇大表現「最強」を含む）。自動確認が指摘を返す画面を必ず一度は通すため。
 */
const VARIANTS: readonly { readonly state: ContentState; readonly variant: ContentVariant }[] = [
  {
    state: "FACT_CHECK",
    variant: variant({
      id: "cv_alpha_review",
      channel: "own_site",
      title: "書き出しの速さで選ぶノートPC",
      body: [
        DISCLOSURE_TEXT,
        "4K10分の素材を同じ設定で書き出したところ、6分12秒でした。",
        "デメリットもあります。本体が1.68kgあり、毎日持ち歩く人には重く感じます。",
        "詳しい比較はこちら: https://example.com/compare",
      ].join("\n"),
      summary: "書き出し時間の実測をもとに、映像編集向けの機種を比べます。",
      withClaims: true,
      compliance: "pass",
    }),
  },
  {
    state: "GENERATED",
    variant: variant({
      id: "cv_alpha_draft",
      channel: "own_site",
      title: "最強のノートPCを紹介します",
      body: [
        "このノートPCは最強です。書き出しは6分12秒で終わります。",
        "価格は198000円です。",
        "とにかく買って損はありません。購入はこちら。",
      ].join("\n"),
      summary: "下書き。自動確認で指摘が出る状態の見本です。",
      withClaims: false,
      compliance: "fail",
    }),
  },
  {
    state: "COMPLIANCE_REVIEW",
    variant: variant({
      id: "cv_beta_short",
      channel: "x",
      title: null,
      body: [
        `${DISCLOSURE_TEXT}1.29kgで持ち運びやすい機種です。`,
        "弱点は書き出しに8分40秒かかること。",
      ].join("\n"),
      summary: "短文の媒体向け。文字数の上限を確認する見本です。",
      withClaims: true,
      compliance: "warning",
    }),
  },
];

function saveRejected(what: string) {
  return err(
    domainError("NOT_IMPLEMENTED", `${what}の保存はまだできません。`, {
      suggestedAction: "保存先の用意（テーブルの追加）が済むまでお待ちください。",
      details: { blockedBy: stub.blockedBy },
    }),
  );
}

export function createSampleContentVariantRepository(): EditorialContentVariantRepositoryPort {
  return markEditorial({
    async findById(_ws: WorkspaceId, id: ContentVariantId) {
      return ok(VARIANTS.find((v) => v.variant.id === id)?.variant ?? null);
    },
    async listByPackage(_ws: WorkspaceId, packageId: ContentPackageId) {
      return ok(VARIANTS.filter((v) => v.variant.contentPackageId === packageId).map((v) => v.variant));
    },
    async listByState(_ws: WorkspaceId, state: ContentState, page: Page) {
      const items = VARIANTS.filter((v) => v.state === state)
        .map((v) => v.variant)
        .slice(0, page.limit);
      return ok({ items, nextCursor: null });
    },
    async listReviewOverdue() {
      // 見本には公開済みの記事が無いので、見直し対象も無い。
      // 0 件は「無い」であって未実装ではない。
      return ok([]);
    },
    async save() {
      return saveRejected("記事");
    },
  });
}

export function createSampleContentPackageRepository(): EditorialContentPackageRepositoryPort {
  return markEditorial({
    async findById(_ws: WorkspaceId, id: ContentPackageId) {
      return ok(id === PACKAGE_ID ? PACKAGE : null);
    },
    async list(_ws: WorkspaceId, page: Page) {
      return ok({ items: [PACKAGE].slice(0, page.limit), nextCursor: null });
    },
    async save() {
      return saveRejected("企画");
    },
  });
}

export function createSamplePersonaRepository(): EditorialPersonaRepositoryPort {
  return markEditorial({
    async findAuthor(_ws: WorkspaceId, id: AuthorPersonaId) {
      return ok(id === AUTHOR_ID ? AUTHOR : null);
    },
    async findAudience(_ws: WorkspaceId, _id: AudiencePersonaId) {
      // 読者ペルソナの見本はまだ用意していない。
      // null を返して「無い」と伝え、作り話の人物像を返さない。
      return ok(null as AudiencePersona | null);
    },
    async listAuthors(_ws: WorkspaceId, page: Page) {
      return ok({ items: [AUTHOR].slice(0, page.limit), nextCursor: null });
    },
    async listAudiences(_ws: WorkspaceId, _page: Page) {
      return ok({ items: [] as readonly AudiencePersona[], nextCursor: null });
    },
    async saveAuthor() {
      return saveRejected("書き手");
    },
    async saveAudience() {
      return saveRejected("読者像");
    },
  });
}
