import type {
  EditorialContentPackageRepositoryPort,
  EditorialContentVariantRepositoryPort,
  EditorialPersonaRepositoryPort,
} from "@/application/ports/authoring";
import type { BrandScopeFilter, PageRequest, Paged } from "@/application/ports/common";
import { createAudiencePersona, type AudiencePersona } from "@/domain/authoring/audience-persona";
import { createAuthorPersona, type AuthorPersona } from "@/domain/authoring/author-persona";
import { createContentPackage, type ContentPackage } from "@/domain/authoring/content-package";
import type { ContentState } from "@/domain/authoring/content-state";
import { createContentVariant, type ContentVariant } from "@/domain/authoring/content-variant";
import { buildVisibleMessage } from "@/domain/compliance/disclosure";
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
import { SAMPLE_PRODUCTS, SAMPLE_WORKSPACE_ID } from "./sample-identity";

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
  // 記事本文と進行の現在地は D1（content_variants）へ、書き手と読者像は
  // D1（author_personas / audience_personas）へ、企画は D1（content_packages）へ
  // つないだ。ここに残っているのは、保存先が無い環境（pnpm dev・自動テスト）の
  // 控えと、一覧が空にならないように重ねる見本データだけ。
  blockedBy: "済み（保存先は D1 の content_packages / content_variants / author_personas / audience_personas）",
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
    role: "在宅勤務の机まわりをためす担当",
    expertise: ["オフィスチェア", "作業姿勢"],
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
    factBoundary: ["公表仕様の読み解き", "編集部の連続着座試験の紹介"],
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

/**
 * 見本の書き手。**保存先をつないだあとも残す。**
 *
 * 1 人も登録していない状態で一覧が空になると、「まだ作っていない」のか
 * 「壊れている」のかを画面から見分けられない。D1 版が `mergeWithSamples` で
 * 保存された分の後ろへ重ねるので、ここを外から読めるようにしてある。
 */
export const SAMPLE_AUTHOR_PERSONAS: readonly AuthorPersona[] = [AUTHOR, CHARACTER_AUTHOR];

const AUTHORS: readonly AuthorPersona[] = SAMPLE_AUTHOR_PERSONAS;

/**
 * 読者ペルソナの見本。
 *
 * 知識量を 3 段階そろえている。1 種類しか置かないと、
 * 「誰に向けて書くか」で文章がどう変わるかを画面で比べられない。
 */
function audience(input: Parameters<typeof createAudiencePersona>[0]): AudiencePersona {
  return unwrap(createAudiencePersona(input), `読者像（${input.name}）`);
}

export const SAMPLE_AUDIENCE_PERSONAS: readonly AudiencePersona[] = [
  audience({
    id: AUDIENCE_ID,
    workspaceId: WS,
    name: "在宅勤務で腰が痛くなった人",
    primaryJob: "8時間座っても体を痛めにくい椅子を、予算内で選びたい",
    currentSituation: "簡易な椅子で働き続け、夕方になると腰が痛む",
    desiredOutcome: "机と体格に合う椅子を選び、仕事のあとも痛みを残さずに過ごせる",
    knowledgeLevel: "beginner",
    awarenessStage: "problem_aware",
    painPoints: ["調整できる場所が多くて比べられない", "高い買い物なので外したくない"],
    objections: ["安い椅子にクッションを足せば十分ではないか"],
    decisionCriteria: ["腰の負担", "座面の高さ", "価格"],
    budgetContext: "8万円前後まで",
    trustRequirements: ["実際に測った数字があること", "誰が書いたか分かること"],
    preferredDetailLevel: "standard",
    commonQuestions: ["机の高さに合いますか", "店頭では何を確かめればよいですか"],
    desiredEmotionalState: "これを選べば大丈夫だと思える",
    nextAction: "候補を2つに絞って、店頭か通販で確かめる",
    prohibitedAssumptions: ["座面高と机の高さの関係を知っている", "肘掛けの種類を理解している"],
  }),
  audience({
    id: taggedString<"AudiencePersonaId">("dp_video_intermediate") as AudiencePersonaId,
    workspaceId: WS,
    name: "在宅勤務が長時間になった人",
    primaryJob: "長く座っても集中が切れにくい作業環境へ替えたい",
    currentSituation: "会議と資料作成が続く日に、腰と肩の負担が大きい",
    desiredOutcome: "体格に合わせて調整できる椅子へ替える",
    knowledgeLevel: "intermediate",
    awarenessStage: "solution_aware",
    painPoints: ["短時間の試座では違いが分からない", "机との高さが合うか判断しづらい"],
    objections: ["椅子より先に机を替えるべきではないか"],
    decisionCriteria: ["腰部圧力", "調整範囲", "保証期間"],
    budgetContext: "12万円まで。仕事用の費用として扱う",
    timeContext: "今月中に決めたい",
    trustRequirements: ["同じ条件で測った比較があること"],
    preferredDetailLevel: "detailed",
    commonQuestions: ["同じ人が長時間座った比較はありますか"],
    desiredEmotionalState: "投資として納得できる",
    nextAction: "比較表で上位2脚の調整範囲と価格差を見比べる",
    prohibitedAssumptions: ["正しい着座姿勢を自分で作れる"],
  }),
  audience({
    id: taggedString<"AudiencePersonaId">("dp_video_expert") as AudiencePersonaId,
    workspaceId: WS,
    name: "会社の備品担当",
    primaryJob: "複数脚をまとめて選定し、社内に説明できる根拠をそろえたい",
    currentSituation: "在宅勤務手当の対象品を見直すため、稟議の資料を作っている",
    desiredOutcome: "測定条件つきの比較を選定根拠として使える",
    knowledgeLevel: "expert",
    awarenessStage: "product_aware",
    painPoints: ["記事ごとに着座時間や被験者が違い、比較にならない"],
    objections: ["提携目的の順位づけではないか"],
    decisionCriteria: ["測定条件の明示", "調整範囲", "保守のしやすさ"],
    budgetContext: "1脚あたり15万円。台数で調整する",
    trustRequirements: ["測定条件と日付が書いてあること", "広告表示があること"],
    preferredDetailLevel: "detailed",
    commonQuestions: ["測定した人の体格と机の高さは何ですか"],
    desiredEmotionalState: "社内に説明できる",
    nextAction: "測定条件のページを保存して稟議に添付する",
    prohibitedAssumptions: [],
  }),
];

const AUDIENCES: readonly AudiencePersona[] = SAMPLE_AUDIENCE_PERSONAS;

const PACKAGE: ContentPackage = unwrap(
  createContentPackage({
    id: PACKAGE_ID,
    workspaceId: WS,
    brandId: "brand_sample",
    primarySubjectId: SAMPLE_PRODUCTS[0]!.id,
    // 見本はオフィスチェアの比較なので、法令上の特別な規制は無い。
    // 「分からないので general」ではなく「調べた結果 general」であることに注意。
    domainScope: "general",
    claimIds: [taggedString<"ClaimId">("cl_alpha_pressure")],
    evidenceIds: [taggedString<"EvidenceId">("ev_lumbar_pressure")],
    authorPersonaId: AUTHOR_ID,
    // 生成マトリクスを見るには、読者が 2 人以上いる必要がある。
    // 1 人だけだと「書き分け」の表が 1 行になり、何のための表か分からなくなる。
    audiencePersonaIds: AUDIENCES.map((a) => a.id),
    objective: "在宅勤務で腰に負担を感じる人が、体格と机に合う椅子を選べるようにする",
    funnelStage: "consideration",
    contentAngles: ["data_first", "comparison_first", "drawback"],
  }),
  "企画",
);

/** 保存先（D1）が見本を消さずに重ねるために読む。 */
export const SAMPLE_CONTENT_PACKAGES: readonly ContentPackage[] = [PACKAGE];

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
      claimIds: input.withClaims ? [taggedString<"ClaimId">("cl_alpha_pressure")] : [],
      evidenceIds: input.withClaims ? [taggedString<"EvidenceId">("ev_lumbar_pressure")] : [],
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
 * 誇大表現「絶対」を含む）。自動確認が指摘を返す画面を必ず一度は通すため。
 */
/** 記事 1 本と、その進行の現在地。**現在地は本文とは別に持つ**（§18.1）。 */
export type SampleVariant = { readonly state: ContentState; readonly variant: ContentVariant };

/**
 * 記事一覧の永続カーソル順。D1 と見本で同じ関数を使い、保存先の返却順に依存しない。
 */
export function compareContentVariantPageOrder(
  left: ContentVariant,
  right: ContentVariant,
): number {
  const leftId = String(left.id);
  const rightId = String(right.id);
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

export function orderContentVariantsForPaging(
  variants: readonly ContentVariant[],
): readonly ContentVariant[] {
  return [...variants].sort(compareContentVariantPageOrder);
}

export function pageContentVariants(
  variants: readonly ContentVariant[],
  page: PageRequest,
): Paged<ContentVariant> {
  const ordered = orderContentVariantsForPaging(variants);
  const cursor = page.cursor;
  const remaining =
    cursor === null
      ? ordered
      : ordered.filter((variant) => String(variant.id) > cursor);
  const items = remaining.slice(0, page.limit);
  return {
    items,
    nextCursor:
      items.length > 0 && items.length < remaining.length ? String(items.at(-1)?.id) : null,
  };
}

/*
 * 見本の記事。**書き換えない。**
 *
 * その場だけ覚えておく作りにもできるが、そうすると承認や段階の変更が
 * 「押した直後は通り、立ち上げ直すと消える」という一番ややこしい形になる。
 * 保存先が無い環境では、成功を装わずに断るほうが読み手を惑わせない。
 * 保存先（D1）がある環境では、そちらが正で、ここは重ね置きにしか使わない。
 */
const VARIANTS: readonly SampleVariant[] = [
  {
    state: "FACT_CHECK",
    variant: variant({
      id: "cv_alpha_review",
      channel: "own_site",
      title: "8時間座った負担で選ぶオフィスチェア",
      body: [
        DISCLOSURE_TEXT,
        "同じ人が同じ机で8時間座ったところ、腰部圧力は平均38kPaでした。",
        "デメリットもあります。座面の奥行きが広く、小柄な人は膝裏が当たることがあります。",
        "詳しい比較はこちら: https://example.com/compare",
      ].join("\n"),
      summary: "連続着座の実測をもとに、在宅勤務向けの椅子を比べます。",
      withClaims: true,
      compliance: "pass",
    }),
  },
  {
    state: "GENERATED",
    variant: variant({
      id: "cv_alpha_draft",
      channel: "own_site",
      title: "絶対に腰が痛くならない椅子を紹介します",
      body: [
        "この椅子なら絶対に腰が痛くなりません。腰部圧力は38kPaです。",
        "価格は98000円です。",
        "とにかく買って損はありません。購入はこちら。",
      ].join("\n"),
      summary: "下書き。自動確認で指摘が出る状態の見本です。",
      withClaims: false,
      compliance: "fail",
    }),
  },
  {
    // 承認まで進んだ 1 本。
    //
    // これが無いと、**配信を作る操作を誰も試せない**（承認前は断られるため）。
    // 見本に承認済みが 1 本も無いせいで「承認から先の道が無い」ように見えていた。
    // 承認は人が行うものなので、見本では承認済みの状態を最初から置いておく。
    state: "APPROVED",
    variant: {
      ...variant({
        id: "cv_alpha_approved",
        channel: "own_site",
        title: "体格と机の高さで選ぶオフィスチェア",
        body: [
          DISCLOSURE_TEXT,
          "同じ人が同じ机で8時間座ったところ、腰部圧力は平均44kPaでした。",
          "デメリットもあります。座面の奥行きを変えられず、体格によっては合わせづらいです。",
          "詳しい比較はこちら: https://example.com/compare",
        ].join("\n"),
        summary:
          "承認まで済んだ見本です。配信を作る欄はここに出ますが、実際に作るには公開の担当の権限が要ります。",
        withClaims: true,
        compliance: "pass",
      }),
      status: "approved",
    },
  },
  {
    state: "COMPLIANCE_REVIEW",
    variant: variant({
      id: "cv_beta_short",
      channel: "x",
      title: null,
      body: [
        `${DISCLOSURE_TEXT}座面を39cmまで下げられる、小柄な人向けの椅子です。`,
        "弱点は座面の奥行きを変えられないこと。",
      ].join("\n"),
      summary: "短文の媒体向け。文字数の上限を確認する見本です。",
      withClaims: true,
      compliance: "warning",
    }),
  },
];

/** 見本本文の保存版。見本は不変なので全件同じ初版を持つ。 */
export const SAMPLE_CONTENT_VARIANT_REVISION = 1;

export function sampleContentVariantVersion(
  workspaceId: WorkspaceId,
  id: ContentVariantId,
): {
  readonly variant: ContentVariant;
  readonly revision: number;
  readonly persisted: false;
} | null {
  const found = VARIANTS.find(
    ({ variant }) => variant.workspaceId === workspaceId && variant.id === id,
  );
  return found === undefined
    ? null
    : {
        variant: found.variant,
        revision: SAMPLE_CONTENT_VARIANT_REVISION,
        persisted: false,
      };
}

function saveRejected(what: string) {
  return err(
    domainError("NOT_IMPLEMENTED", `${what}の保存はまだできません。`, {
      suggestedAction: "保存先の用意（テーブルの追加）が済むまでお待ちください。",
      details: { blockedBy: stub.blockedBy },
    }),
  );
}

/**
 * 見本の記事と、その進行の現在地。**保存先（D1）版もこれを重ねて返す。**
 *
 * 消すと、まだ 1 本も作っていない状態でかんばんの列が全部空になり、
 * 「まだ作っていない」のか「壊れている」のかを見分けられなくなる。
 */
export function sampleContentVariants(): readonly SampleVariant[] {
  return VARIANTS;
}

export function createSampleContentVariantRepository(): EditorialContentVariantRepositoryPort {
  return markEditorial({
    async findById(_ws: WorkspaceId, id: ContentVariantId) {
      return ok(VARIANTS.find((v) => v.variant.id === id)?.variant ?? null);
    },
    async findVersionedById(workspaceId: WorkspaceId, id: ContentVariantId) {
      return ok(sampleContentVariantVersion(workspaceId, id));
    },
    async findState(_ws: WorkspaceId, id: ContentVariantId) {
      return ok(VARIANTS.find((v) => v.variant.id === id)?.state ?? null);
    },
    async saveState() {
      return saveRejected("記事の進行");
    },
    async listByPackage(_ws: WorkspaceId, packageId: ContentPackageId) {
      return ok(
        orderContentVariantsForPaging(
          VARIANTS.filter((v) => v.variant.contentPackageId === packageId).map((v) => v.variant),
        ),
      );
    },
    async listByState(
      _ws: WorkspaceId,
      state: ContentState,
      page: PageRequest,
      brandScope?: BrandScopeFilter,
    ) {
      const candidates = VARIANTS.filter(
        (v) => v.state === state && v.variant.workspaceId === _ws,
      )
        .map((v) => v.variant)
        .filter((variant) => {
          if (brandScope === undefined) return true;
          const pkg = SAMPLE_CONTENT_PACKAGES.find((item) => item.id === variant.contentPackageId);
          return (
            pkg !== undefined &&
            brandScope.brandIds.some((brandId) => String(brandId) === pkg.brandId)
          );
        });
      return ok(pageContentVariants(candidates, page));
    },
    async listReviewOverdue() {
      // 見本には公開済みの記事が無いので、見直し対象も無い。
      // 0 件は「無い」であって未実装ではない。
      return ok([]);
    },
    async save() {
      return saveRejected("記事");
    },
    /** 見本はコードの中にある。消したと返しても次に開けばまた居るので断る。 */
    async remove() {
      return saveRejected("記事");
    },
  });
}

export function createSampleContentPackageRepository(): EditorialContentPackageRepositoryPort {
  return markEditorial({
    async findById(_ws: WorkspaceId, id: ContentPackageId) {
      return ok(id === PACKAGE_ID ? PACKAGE : null);
    },
    async list(
      _ws: WorkspaceId,
      page: PageRequest,
      brandScope?: BrandScopeFilter,
    ) {
      const candidates =
        PACKAGE.workspaceId === _ws &&
        (brandScope === undefined ||
          brandScope.brandIds.some((brandId) => String(brandId) === PACKAGE.brandId))
          ? [PACKAGE]
          : [];
      const cursorIndex =
        page.cursor === null
          ? -1
          : candidates.findIndex((pkg) => String(pkg.id) === page.cursor);
      const start = cursorIndex + 1;
      const items = candidates.slice(start, start + page.limit);
      return ok({
        items,
        nextCursor:
          items.length > 0 && start + items.length < candidates.length
            ? String(items.at(-1)?.id)
            : null,
      });
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
    async listAuthors(_ws: WorkspaceId, page: PageRequest) {
      return ok({ items: AUTHORS.slice(0, page.limit), nextCursor: null });
    },
    async listAudiences(_ws: WorkspaceId, page: PageRequest) {
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
