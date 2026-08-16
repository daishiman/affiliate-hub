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
  createAudiencePersona,
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

/**
 * もう 1 人の書き手（ブランドキャラクター）。
 *
 * **わざと資格も経験年数も持たせていない。**
 * 架空の人物に資格を名乗らせないという決まりが、
 * 見本を作る時点で効いていることを画面で確かめられるようにするため。
 */
const CHARACTER_AUTHOR: AuthorPersona = unwrap(
  createAuthorPersona({
    id: taggedString<"AuthorPersonaId">("ap_navi") as AuthorPersonaId,
    workspaceId: WS,
    displayName: "ナビ（案内役）",
    personaType: "brand_character",
    role: "はじめての人に手順を案内する役",
    expertise: ["用語の言いかえ"],
    knowledgeLevel: "beginner",
    firstPersonPronoun: "ぼく",
    readerAddress: "きみ",
    tone: {
      formality: 0.3,
      analytical: 0.4,
      emotional: 0.6,
      assertiveness: 0.3,
      humor: 0.4,
      emojiUsage: 0.2,
    },
    prohibitedPhrases: ["絶対", "確実に"],
    disclosureStyle: "会話の前に1行で書く",
    ctaStyle: "急がせない。迷ったら見送る選択も示す",
    // 架空の人物なので、自分で試した話は書けない。
    factBoundary: ["編集部が測った記録の紹介", "用語の説明"],
  }),
  "書き手（案内役）",
);

const AUTHORS: readonly AuthorPersona[] = [AUTHOR, CHARACTER_AUTHOR];

/**
 * 読者ペルソナの見本。
 *
 * 知識量を 3 段階そろえている。1 種類しか置かないと、
 * 「誰に向けて書くか」で文章がどう変わるかを画面で比べられない。
 */
function audience(input: Parameters<typeof createAudiencePersona>[0]): AudiencePersona {
  return unwrap(createAudiencePersona(input), `読者像（${input.name}）`);
}

const AUDIENCES: readonly AudiencePersona[] = [
  audience({
    id: AUDIENCE_ID,
    workspaceId: WS,
    name: "動画編集を始めたばかりの人",
    primaryJob: "はじめての動画編集用ノートPCを、失敗せずに選びたい",
    currentSituation: "手持ちのPCで書き出しに時間がかかり、作業が止まっている",
    desiredOutcome: "予算のなかで、書き出しを待たずに編集できる機種を選べる",
    knowledgeLevel: "beginner",
    awarenessStage: "problem_aware",
    painPoints: ["専門用語が多くて比べられない", "高い買い物なので外したくない"],
    objections: ["安い機種でも足りるのではないか"],
    decisionCriteria: ["書き出しの速さ", "価格", "重さ"],
    budgetContext: "15万円前後まで",
    trustRequirements: ["実際に測った数字があること", "誰が書いたか分かること"],
    preferredDetailLevel: "standard",
    commonQuestions: ["メモリは何GB必要ですか", "中古でも大丈夫ですか"],
    desiredEmotionalState: "これを選べば大丈夫だと思える",
    nextAction: "候補を2つに絞って、店頭か通販で確かめる",
    prohibitedAssumptions: ["CPUの型番の読み方を知っている", "動画の書き出し設定を理解している"],
  }),
  audience({
    id: taggedString<"AudiencePersonaId">("dp_video_intermediate") as AudiencePersonaId,
    workspaceId: WS,
    name: "副業で受注を始めた編集者",
    primaryJob: "納期に間に合う作業環境へ買い替えたい",
    currentSituation: "案件が増え、書き出し待ちが利益を圧迫している",
    desiredOutcome: "1日の作業本数を増やせる機種に替える",
    knowledgeLevel: "intermediate",
    awarenessStage: "solution_aware",
    painPoints: ["書き出し待ちの時間が読めない", "外出先での作業が続かない"],
    objections: ["デスクトップの方が費用対効果が高いのでは"],
    decisionCriteria: ["書き出しの速さ", "電源なしで使える時間", "静かさ"],
    budgetContext: "25万円まで。経費で落とす",
    timeContext: "今月中に決めたい",
    trustRequirements: ["同じ条件で測った比較があること"],
    preferredDetailLevel: "detailed",
    commonQuestions: ["同じ書き出し設定での比較はありますか"],
    desiredEmotionalState: "投資として納得できる",
    nextAction: "比較表で上位2機種の差額と時間短縮を見比べる",
    prohibitedAssumptions: ["色の管理まで理解している"],
  }),
  audience({
    id: taggedString<"AudiencePersonaId">("dp_video_expert") as AudiencePersonaId,
    workspaceId: WS,
    name: "制作会社の機材担当",
    primaryJob: "複数台をまとめて選定し、社内に説明できる根拠をそろえたい",
    currentSituation: "更新時期が来ており、稟議の資料を作っている",
    desiredOutcome: "測定条件つきの比較を根拠として使える",
    knowledgeLevel: "expert",
    awarenessStage: "product_aware",
    painPoints: ["記事ごとに測定条件が違い、比較にならない"],
    objections: ["提携目的の順位づけではないか"],
    decisionCriteria: ["測定条件の明示", "書き出しの速さ", "保守のしやすさ"],
    budgetContext: "1台あたり30万円。台数で調整する",
    trustRequirements: ["測定条件と日付が書いてあること", "広告表示があること"],
    preferredDetailLevel: "detailed",
    commonQuestions: ["測定に使った素材と設定は何ですか"],
    desiredEmotionalState: "社内に説明できる",
    nextAction: "測定条件のページを保存して稟議に添付する",
    prohibitedAssumptions: [],
  }),
];

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
      return ok(AUTHORS.find((a) => a.id === id) ?? null);
    },
    async findAudience(_ws: WorkspaceId, id: AudiencePersonaId) {
      return ok(AUDIENCES.find((a) => a.id === id) ?? null);
    },
    async listAuthors(_ws: WorkspaceId, page: Page) {
      return ok({ items: AUTHORS.slice(0, page.limit), nextCursor: null });
    },
    async listAudiences(_ws: WorkspaceId, page: Page) {
      return ok({ items: AUDIENCES.slice(0, page.limit), nextCursor: null });
    },
    async saveAuthor() {
      return saveRejected("書き手");
    },
    async saveAudience() {
      return saveRejected("読者像");
    },
  });
}
