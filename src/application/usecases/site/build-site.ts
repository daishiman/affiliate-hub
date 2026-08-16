import type { EditorialSiteDraftRepositoryPort } from "@/application/ports/authoring";
import type { IdGeneratorPort } from "@/application/ports/common";
import {
  ARTICLE_TYPE_LABEL,
  ARTICLE_TYPES,
  BRAND_THEMES,
  type BrandTheme,
  REVENUE_MODEL_LABEL,
  REVENUE_MODELS,
  SITE_PATTERN_LABEL,
  SITE_PATTERNS,
  SITE_WIZARD_STEPS,
  SITE_WIZARD_STEP_LABEL,
  SITE_WIZARD_STEP_QUESTION,
  type SiteDraft,
  type SiteWizardStep,
  createSiteBlueprint,
  createSiteDraft,
  incompleteSteps,
  isStepComplete,
  missingTrustPages,
  toDifferentiationAxes,
  validateSlug,
} from "@/domain/authoring";
import { requireCapability } from "@/domain/identity";
import {
  type DomainError,
  type Result,
  type SiteBlueprintId,
  type SiteDraftId,
  err,
  notFound,
  ok,
  taggedString,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * ブログ作成ウィザード（プラットフォーム層 §16.2・§22.6）。
 *
 * **ブログを 1 本増やすのに、コードは 1 行も書かない。**
 * 増えるのは設計図（Blueprint）のデータだけで、
 * 画面もルートも既存のものをそのまま使う。
 *
 * ここは Editorial 区分。報酬のつなぎ目は受け取らない。
 * 「どのブログを作るか」を報酬額で決めさせないため。
 */
export type BuildSiteDeps = {
  readonly drafts: EditorialSiteDraftRepositoryPort;
  readonly ids: IdGeneratorPort;
  readonly affiliateLinks?: never;
};

export type WizardStepView = {
  readonly step: SiteWizardStep;
  readonly label: string;
  readonly question: string;
  readonly done: boolean;
  /** 何番目か。1 始まり。画面に「3/13」と出すため。 */
  readonly position: number;
};

export type SiteDraftView = {
  readonly draftId: string;
  readonly name: string;
  readonly slug: string;
  readonly steps: readonly WizardStepView[];
  readonly currentStep: SiteWizardStep;
  readonly totalSteps: number;
  readonly doneCount: number;
  /** 作る前に埋める必要がある段階。空なら作れる。 */
  readonly incomplete: readonly SiteWizardStep[];
  readonly incompleteLabels: readonly string[];
  readonly createdSiteSlug: string | null;
  /** いま入っている答え。画面の初期値に使う。 */
  readonly answers: Readonly<Record<string, string>>;
  readonly categoryCount: number;
  readonly articleTypes: readonly string[];
  /** いま開いている段階の入力欄。画面はこれを並べるだけでよい。 */
  readonly fields: readonly WizardFieldSpec[];
};

/**
 * 入力欄の指定。
 *
 * **画面に欄を書き起こさせない。** 書き起こすと、段階を 1 つ足したとき
 * 「保存はできるが画面に欄が無い」「欄はあるが保存されない」が起きる。
 * ここが唯一の正本で、画面はこの並びをそのまま描く。
 */
export type WizardFieldSpec = {
  readonly name: string;
  readonly kind: "text" | "longtext" | "choice" | "multi_choice";
  readonly label: string;
  readonly hint: string;
  readonly value: string;
  /** choice / multi_choice のときだけ入る。 */
  readonly options: readonly { readonly value: string; readonly label: string }[];
  /** すでに選ばれているもの (multi_choice)。 */
  readonly selected: readonly string[];
};

function textField(
  name: string,
  kind: "text" | "longtext",
  label: string,
  hint: string,
  value: string,
): WizardFieldSpec {
  return { name, kind, label, hint, value, options: [], selected: [] };
}

function choiceField(
  name: string,
  label: string,
  hint: string,
  value: string,
  options: readonly { readonly value: string; readonly label: string }[],
): WizardFieldSpec {
  return { name, kind: "choice", label, hint, value, options, selected: [] };
}

/** その段階の入力欄。段階を足すときはここにも 1 行足る（型が要求する）。 */
function fieldsFor(draft: SiteDraft, step: SiteWizardStep): readonly WizardFieldSpec[] {
  switch (step) {
    case "purpose":
      return [
        textField(
          "purpose",
          "longtext",
          "このブログの目的",
          "読んだ人が何をできるようになるかを 1〜2 文で。",
          draft.purpose,
        ),
      ];
    case "genre":
      return [
        textField("genre", "text", "扱う分野", "例: 動画編集向けパソコン・周辺機器", draft.genre),
      ];
    case "audience":
      return [
        textField("targetReader", "text", "誰が読むか", "職業・状況まで書きます。", draft.targetReader),
        textField(
          "searchIntent",
          "text",
          "何を知りたくて来るか",
          "検索するときの言葉に近づけます。",
          draft.searchIntent,
        ),
      ];
    case "author":
      return [
        textField(
          "uniqueExperience",
          "longtext",
          "他にはない経験",
          "自分で測った・自分で使った、と言えることを書きます。",
          draft.uniqueExperience,
        ),
        textField(
          "conclusionStance",
          "text",
          "結論の出し方",
          "1 位を断言するのか、条件で分けるのか。",
          draft.conclusionStance,
        ),
      ];
    case "revenue":
      return [
        choiceField(
          "revenueModel",
          "収益のしかた",
          "順位づけには影響しません。順位は報酬額を受け取らない仕組みです。",
          draft.revenueModel ?? "",
          REVENUE_MODELS.map((v) => ({ value: v, label: REVENUE_MODEL_LABEL[v] })),
        ),
      ];
    case "pattern":
      return [
        choiceField(
          "pattern",
          "ブログの型",
          "型によって、最初に用意されるページの種類が変わります。",
          draft.pattern ?? "",
          SITE_PATTERNS.map((v) => ({ value: v, label: SITE_PATTERN_LABEL[v] })),
        ),
      ];
    case "categories":
      return [
        textField(
          "categoriesText",
          "longtext",
          "カテゴリー（1 行 1 件）",
          "「URL名 / 名前 / 1文説明」の形で。例: laptops / ノートパソコン / 書き出し時間で選ぶ編集機",
          draft.categories.map((c) => `${c.slug} / ${c.name} / ${c.oneLine}`).join("\n"),
        ),
      ];
    case "article_types":
      return [
        {
          name: "articleTypes",
          kind: "multi_choice",
          label: "最初に置く記事の種類",
          hint: "後から画面で変えられます。1 つ以上選んでください。",
          value: "",
          options: ARTICLE_TYPES.map((v) => ({ value: v, label: ARTICLE_TYPE_LABEL[v] })),
          selected: draft.articleTypes.map(String),
        },
      ];
    case "design":
      return [
        choiceField(
          "theme",
          "配色",
          "色の値ではなく名前で選びます。役割（操作の色・実行中の色）はどのブログでも同じです。",
          draft.theme ?? "",
          BRAND_THEMES.map((v) => ({ value: v, label: v })),
        ),
      ];
    case "domain":
      return [
        textField("name", "text", "ブログの名前", "読者に見える名前です。", draft.name),
        textField(
          "slug",
          "text",
          "URL に使う文字列",
          "半角の英小文字・数字・ハイフンだけ。読者から見える住所になります。",
          draft.slug,
        ),
      ];
    case "policy":
      return [
        textField(
          "articlePurpose",
          "text",
          "記事の役割",
          "読者に何をさせる記事なのか。",
          draft.articlePurpose,
        ),
        textField(
          "ctaStrategy",
          "text",
          "成果リンクの出し方",
          "急かさない、価格だけ確認させる、など。",
          draft.ctaStrategy,
        ),
      ];
    case "content_plan":
      return [
        textField("evaluationAxis", "text", "何で比べるか", "測れるものを書きます。", draft.evaluationAxis),
        textField("usageScene", "text", "使う場面", "読者が実際に使う状況。", draft.usageScene),
        textField("comparisonScope", "text", "比べる範囲", "価格帯や条件で区切ります。", draft.comparisonScope),
        textField(
          "internalLinkStrategy",
          "text",
          "記事どうしのつなぎ方",
          "どの記事からどの記事へ送るか。",
          draft.internalLinkStrategy,
        ),
      ];
    case "create":
      return [];
  }
}

/** 選択肢はここから配る。画面が独自の一覧を持つと、片方だけ古くなる。 */
export const WIZARD_CHOICES = {
  revenueModel: REVENUE_MODELS,
  pattern: SITE_PATTERNS,
  theme: BRAND_THEMES,
  articleType: ARTICLE_TYPES,
} as const;

// 選択肢の表示名はここで作らない。正本は domain 側（`@/domain/authoring`）にある。
// 以前はここと一覧画面で別々に持っていて、同じ収益モデルが
// 「成果報酬の紹介」と「提携販売」の 2 通りに見えていた。

function toView(draft: SiteDraft, requested?: SiteWizardStep): SiteDraftView {
  const steps: WizardStepView[] = SITE_WIZARD_STEPS.map((step, i) => ({
    step,
    label: SITE_WIZARD_STEP_LABEL[step],
    question: SITE_WIZARD_STEP_QUESTION[step],
    done: isStepComplete(draft, step),
    position: i + 1,
  }));

  // 指定が無ければ、最初に埋まっていない段階を開く。
  // 毎回 1 段階目に戻すと、続きから再開できない。
  const firstOpen = steps.find((s) => !s.done)?.step ?? "create";
  const incomplete = incompleteSteps(draft);
  const current = requested ?? firstOpen;

  return {
    fields: fieldsFor(draft, current),
    draftId: String(draft.id),
    name: draft.name,
    slug: draft.slug,
    steps,
    currentStep: current,
    totalSteps: SITE_WIZARD_STEPS.length,
    doneCount: steps.filter((s) => s.done).length,
    incomplete,
    incompleteLabels: incomplete.map((s) => SITE_WIZARD_STEP_LABEL[s]),
    createdSiteSlug: draft.createdSiteSlug,
    answers: {
      purpose: draft.purpose,
      genre: draft.genre,
      targetReader: draft.targetReader,
      searchIntent: draft.searchIntent,
      uniqueExperience: draft.uniqueExperience,
      conclusionStance: draft.conclusionStance,
      revenueModel: draft.revenueModel ?? "",
      pattern: draft.pattern ?? "",
      theme: draft.theme ?? "",
      name: draft.name,
      slug: draft.slug,
      articlePurpose: draft.articlePurpose,
      ctaStrategy: draft.ctaStrategy,
      evaluationAxis: draft.evaluationAxis,
      usageScene: draft.usageScene,
      comparisonScope: draft.comparisonScope,
      internalLinkStrategy: draft.internalLinkStrategy,
    },
    categoryCount: draft.categories.length,
    articleTypes: draft.articleTypes.map(String),
  };
}

// --- 下書きの一覧と参照 -----------------------------------------------------

export type ListSiteDraftsOutput = {
  readonly items: readonly SiteDraftView[];
  readonly total: number;
  readonly emptyReason: string | null;
};

export function createListSiteDraftsUseCase(
  deps: BuildSiteDeps,
): UseCase<Record<string, never>, ListSiteDraftsOutput> {
  return {
    async execute(actor): Promise<Result<ListSiteDraftsOutput, DomainError>> {
      const allowed = requireCapability(actor, "site.draft", "作りかけのブログ");
      if (!allowed.ok) return allowed;

      const listed = await deps.drafts.list(actor.workspaceId);
      if (!listed.ok) return listed;

      const items = listed.value.map((d) => toView(d));
      return ok({
        items,
        total: items.length,
        emptyReason:
          items.length === 0 ? "作りかけのブログはありません。新しく始められます。" : null,
      });
    },
  };
}

export type GetSiteDraftInput = {
  readonly draftId: string;
  readonly step?: SiteWizardStep;
};

export function createGetSiteDraftUseCase(deps: BuildSiteDeps): UseCase<GetSiteDraftInput, SiteDraftView> {
  return {
    async execute(actor, input): Promise<Result<SiteDraftView, DomainError>> {
      const allowed = requireCapability(actor, "site.draft", "ブログ作成の下書き");
      if (!allowed.ok) return allowed;

      const found = await deps.drafts.find(
        actor.workspaceId,
        taggedString<"SiteDraftId">(input.draftId) as SiteDraftId,
      );
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("ブログ作成の下書き", input.draftId));
      return ok(toView(found.value, input.step));
    },
  };
}

// --- 開始 -------------------------------------------------------------------

export function createStartSiteDraftUseCase(
  deps: BuildSiteDeps,
): UseCase<Record<string, never>, SiteDraftView> {
  return {
    async execute(actor): Promise<Result<SiteDraftView, DomainError>> {
      const allowed = requireCapability(actor, "site.draft", "ブログを作り始める");
      if (!allowed.ok) return allowed;

      const draft = createSiteDraft({
        id: taggedString<"SiteDraftId">(`sd_${deps.ids.newId()}`) as SiteDraftId,
        workspaceId: actor.workspaceId,
      });
      const saved = await deps.drafts.save(draft);
      if (!saved.ok) return saved;
      return ok(toView(saved.value));
    },
  };
}

// --- 1 段階ずつ保存 ---------------------------------------------------------

export type SaveSiteDraftStepInput = {
  readonly draftId: string;
  readonly step: SiteWizardStep;
  /** その段階の答え。段階ごとに使う鍵が違う。 */
  readonly answers: Readonly<Record<string, string>>;
  /** カテゴリー段階だけで使う。「URL名:名前:1文説明」を 1 行 1 件。 */
  readonly categoriesText?: string;
  /** 記事の種類段階だけで使う。 */
  readonly articleTypes?: readonly string[];
};

/**
 * 段階を 1 つ保存する。
 *
 * **保存と検査を同じ場所で行う。** 「保存はできたが次へ進めない」を作らない。
 * 埋まっていない項目は、その段階のうちに直せる言葉で返す。
 */
export function createSaveSiteDraftStepUseCase(
  deps: BuildSiteDeps,
): UseCase<SaveSiteDraftStepInput, SiteDraftView> {
  return {
    async execute(actor, input): Promise<Result<SiteDraftView, DomainError>> {
      const allowed = requireCapability(actor, "site.draft", "ブログ作成の入力");
      if (!allowed.ok) return allowed;

      const found = await deps.drafts.find(
        actor.workspaceId,
        taggedString<"SiteDraftId">(input.draftId) as SiteDraftId,
      );
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("ブログ作成の下書き", input.draftId));

      const applied = applyStep(found.value, input);
      if (!applied.ok) return applied;

      if (!isStepComplete(applied.value, input.step)) {
        return err(
          validationError(
            `「${SITE_WIZARD_STEP_LABEL[input.step]}」がまだ埋まっていません。${SITE_WIZARD_STEP_QUESTION[input.step]}`,
            firstEmptyFieldOf(input.step),
          ),
        );
      }

      const saved = await deps.drafts.save(applied.value);
      if (!saved.ok) return saved;

      // 保存できたら次の段階を開く。押したあと同じ画面に留まらせない。
      const i = SITE_WIZARD_STEPS.indexOf(input.step);
      const next = SITE_WIZARD_STEPS[Math.min(i + 1, SITE_WIZARD_STEPS.length - 1)]!;
      return ok(toView(saved.value, next));
    },
  };
}

/** 段階ごとの入力欄。画面の組み立てにも、誤りの位置指定にも使う。 */
export const STEP_FIELDS: Readonly<Record<SiteWizardStep, readonly string[]>> = {
  purpose: ["purpose"],
  genre: ["genre"],
  audience: ["targetReader", "searchIntent"],
  author: ["uniqueExperience", "conclusionStance"],
  revenue: ["revenueModel"],
  pattern: ["pattern"],
  categories: ["categoriesText"],
  article_types: ["articleTypes"],
  design: ["theme"],
  domain: ["name", "slug"],
  policy: ["articlePurpose", "ctaStrategy"],
  content_plan: ["evaluationAxis", "usageScene", "comparisonScope", "internalLinkStrategy"],
  create: [],
};

function firstEmptyFieldOf(step: SiteWizardStep): string | undefined {
  return STEP_FIELDS[step][0];
}

function applyStep(draft: SiteDraft, input: SaveSiteDraftStepInput): Result<SiteDraft, DomainError> {
  const a = input.answers;
  const text = (key: string): string => (a[key] ?? "").trim();

  switch (input.step) {
    case "purpose":
      return ok({ ...draft, purpose: text("purpose") });
    case "genre":
      return ok({ ...draft, genre: text("genre") });
    case "audience":
      return ok({
        ...draft,
        targetReader: text("targetReader"),
        searchIntent: text("searchIntent"),
      });
    case "author":
      return ok({
        ...draft,
        uniqueExperience: text("uniqueExperience"),
        conclusionStance: text("conclusionStance"),
      });
    case "revenue": {
      const v = text("revenueModel");
      const found = REVENUE_MODELS.find((r) => r === v);
      if (found === undefined) {
        return err(validationError("収益のしかたを選んでください。", "revenueModel"));
      }
      return ok({ ...draft, revenueModel: found });
    }
    case "pattern": {
      const v = text("pattern");
      const found = SITE_PATTERNS.find((p) => p === v);
      if (found === undefined) {
        return err(validationError("ブログの型を選んでください。", "pattern"));
      }
      return ok({ ...draft, pattern: found });
    }
    case "categories":
      return applyCategories(draft, input.categoriesText ?? "");
    case "article_types": {
      const chosen = ARTICLE_TYPES.filter((t) => (input.articleTypes ?? []).includes(t));
      if (chosen.length === 0) {
        return err(
          validationError("記事の種類を 1 つ以上選んでください。", "articleTypes"),
        );
      }
      // カテゴリーにも同じ構成を配る。カテゴリーごとに別々に選ばせるのは、
      // 最初の 1 本を作る段階では細かすぎる。後から画面で変えられる。
      return ok({
        ...draft,
        articleTypes: chosen,
        categories: draft.categories.map((c) => ({ ...c, initialArticleTypes: chosen })),
      });
    }
    case "design": {
      const v = text("theme");
      const found = BRAND_THEMES.find((t) => t === v);
      if (found === undefined) {
        return err(validationError("配色を選んでください。", "theme"));
      }
      return ok({ ...draft, theme: found as BrandTheme });
    }
    case "domain": {
      const slug = text("slug");
      const checked = validateSlug(slug);
      if (!checked.ok) return checked;
      if (text("name") === "") {
        return err(validationError("ブログの名前を入れてください。", "name"));
      }
      return ok({ ...draft, name: text("name"), slug: checked.value });
    }
    case "policy":
      return ok({
        ...draft,
        articlePurpose: text("articlePurpose"),
        ctaStrategy: text("ctaStrategy"),
      });
    case "content_plan":
      return ok({
        ...draft,
        evaluationAxis: text("evaluationAxis"),
        usageScene: text("usageScene"),
        comparisonScope: text("comparisonScope"),
        internalLinkStrategy: text("internalLinkStrategy"),
      });
    case "create":
      return err(
        validationError(
          "この段階は入力ではなく実行です。「このブログを作る」を押してください。",
          "step",
        ),
      );
  }
}

/**
 * カテゴリーの入力。
 *
 * 1 行 1 件で「URL名 / 名前 / 1 文説明」。表を作らせるより速く、
 * 貼り付けでも入れられる。区切りは全角半角どちらのスラッシュでも受ける。
 */
function applyCategories(draft: SiteDraft, raw: string): Result<SiteDraft, DomainError> {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
  if (lines.length === 0) {
    return err(
      validationError(
        "カテゴリーを 1 行 1 件で入れてください（例: laptops / ノートパソコン / 書き出し時間で選ぶ編集機）。",
        "categoriesText",
      ),
    );
  }

  const categories = [];
  for (const line of lines) {
    const parts = line.split(/[/／]/).map((p) => p.trim());
    if (parts.length < 3 || parts.some((p) => p === "")) {
      return err(
        validationError(
          `「${line}」の形が違います。「URL名 / 名前 / 1文説明」の 3 つをスラッシュで区切ってください。`,
          "categoriesText",
        ),
      );
    }
    const slug = validateSlug(parts[0]!);
    if (!slug.ok) {
      return err(
        validationError(
          `カテゴリーの URL 名「${parts[0]}」は、半角の英小文字・数字・ハイフンで書いてください。`,
          "categoriesText",
        ),
      );
    }
    categories.push({
      slug: slug.value,
      name: parts[1]!,
      oneLine: parts.slice(2).join(" / "),
      initialArticleTypes: draft.articleTypes,
    });
  }
  return ok({ ...draft, categories });
}

// --- 作る -------------------------------------------------------------------

export type CreateSiteInput = { readonly draftId: string };
export type CreateSiteOutput = {
  readonly slug: string;
  readonly name: string;
  /** 読者から見える住所。作った直後にここを開いて確かめられる。 */
  readonly readerPath: string;
  readonly pageCount: number;
  readonly categoryCount: number;
  /** 信頼のために必要なページのうち、まだ無いもの。 */
  readonly missingTrustPages: readonly string[];
  readonly summary: string;
};

/**
 * 下書きからブログを作る。
 *
 * **ここで作られるのはデータだけ。** 画面もルートも既存のものを使う。
 * 作った直後に `/s/<URL名>` を開けば、そのまま読者向けの画面が出る。
 */
export function createCreateSiteFromDraftUseCase(
  deps: BuildSiteDeps,
): UseCase<CreateSiteInput, CreateSiteOutput> {
  return {
    async execute(actor, input): Promise<Result<CreateSiteOutput, DomainError>> {
      const allowed = requireCapability(actor, "site.draft", "ブログを作る");
      if (!allowed.ok) return allowed;

      const found = await deps.drafts.find(
        actor.workspaceId,
        taggedString<"SiteDraftId">(input.draftId) as SiteDraftId,
      );
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("ブログ作成の下書き", input.draftId));
      const draft = found.value;

      const missing = incompleteSteps(draft);
      if (missing.length > 0) {
        return err(
          validationError(
            `まだ埋まっていない段階があります: ${missing.map((s) => SITE_WIZARD_STEP_LABEL[s]).join(" / ")}`,
            "draftId",
          ),
        );
      }

      // 型の上では null になり得るが、上の検査を通った時点で入っている。
      if (draft.pattern === null || draft.revenueModel === null || draft.theme === null) {
        return err(validationError("選択項目が空のままです。前の段階に戻って選んでください。", "draftId"));
      }

      const blueprint = createSiteBlueprint({
        id: taggedString<"SiteBlueprintId">(`sb_${draft.slug.replace(/-/g, "_")}`) as SiteBlueprintId,
        workspaceId: actor.workspaceId,
        name: draft.name,
        pattern: draft.pattern,
        purpose: draft.purpose,
        genre: draft.genre,
        revenueModel: draft.revenueModel,
        categories: draft.categories,
        // 見た目の違いは色の名前だけ。役割（操作の色・実行中の色）は変えない。
        theme: { brandTheme: draft.theme },
        differentiation: toDifferentiationAxes(draft),
      });
      if (!blueprint.ok) return blueprint;

      const published = await deps.drafts.publishBlueprint(draft.slug, blueprint.value);
      if (!published.ok) return published;

      const saved = await deps.drafts.save({ ...draft, createdSiteSlug: draft.slug });
      if (!saved.ok) return saved;

      const trustGaps = missingTrustPages(blueprint.value);
      return ok({
        slug: draft.slug,
        name: draft.name,
        readerPath: `/s/${draft.slug}`,
        pageCount: blueprint.value.pages.length,
        categoryCount: blueprint.value.categories.length,
        missingTrustPages: trustGaps.map(String),
        summary: `「${draft.name}」を作りました。${blueprint.value.pages.length}種類のページと${blueprint.value.categories.length}個のカテゴリーが用意されています。`,
      });
    },
  };
}
