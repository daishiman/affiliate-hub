import {
  type DomainError,
  type Result,
  type SiteDraftId,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";
import type { ArticleType } from "./article-structure";
import {
  type BrandTheme,
  type CategoryPlan,
  type DifferentiationAxes,
  type RevenueModel,
  type SitePattern,
} from "./site-blueprint";

/**
 * ブログ作成ウィザードの下書き (プラットフォーム層 §16.2)。
 *
 * **設計図 (SiteBlueprint) は完成品で、これはその途中の状態。**
 * 完成品に「まだ空でもよい」を許すと、公開されたブログに空欄が出る。
 * そこで、途中を表す型を分けている。
 *
 * ブログを 1 本増やすのに書くのはこの下書きの中身だけで、
 * 画面のコードは 1 行も増えない（変更容易性シナリオ③）。
 */
export type SiteDraft = {
  readonly id: SiteDraftId;
  readonly workspaceId: WorkspaceId;
  /**
   * 保存のたびに 1 ずつ増える版。0 はまだ保存していない新規下書きだけ。
   * 秒精度の更新日時では同時保存を区別できないため、競合判定には使わない。
   */
  readonly revision: number;
  /** 1. ブログの目的 */
  readonly purpose: string;
  /** 2. ジャンル */
  readonly genre: string;
  /** 3. 読者 */
  readonly targetReader: string;
  readonly searchIntent: string;
  /** 4. 書き手 */
  readonly uniqueExperience: string;
  readonly conclusionStance: string;
  /** 5. 収益モデル */
  readonly revenueModel: RevenueModel | null;
  /** 6. ブログパターン */
  readonly pattern: SitePattern | null;
  /** 7. カテゴリー */
  readonly categories: readonly CategoryPlan[];
  /** 8. 記事タイプ（カテゴリー共通の初期構成） */
  readonly articleTypes: readonly ArticleType[];
  /** 9. デザイン */
  readonly theme: BrandTheme | null;
  /** 10. ドメイン */
  readonly name: string;
  readonly slug: string;
  /** 11. 広告・編集ポリシー */
  readonly articlePurpose: string;
  readonly ctaStrategy: string;
  /** 12. 初期コンテンツ計画 */
  readonly evaluationAxis: string;
  readonly usageScene: string;
  readonly comparisonScope: string;
  readonly internalLinkStrategy: string;
  /** 13. 生成（作った結果） */
  readonly createdSiteSlug: string | null;
};

/**
 * ウィザードの手順 (§16.2 の 13 段階)。
 *
 * **順序と中身をここ 1 箇所に持つ。** 画面が独自に手順を並べると、
 * 「画面では 12 段階、AI からは 13 段階」のような食い違いが起きる。
 */
export const SITE_WIZARD_STEPS = [
  "purpose",
  "genre",
  "audience",
  "author",
  "revenue",
  "pattern",
  "categories",
  "article_types",
  "design",
  "domain",
  "policy",
  "content_plan",
  "create",
] as const;
export type SiteWizardStep = (typeof SITE_WIZARD_STEPS)[number];

export const SITE_WIZARD_STEP_LABEL: Readonly<Record<SiteWizardStep, string>> = {
  purpose: "ブログの目的",
  genre: "ジャンル",
  audience: "読者",
  author: "書き手",
  revenue: "収益のしかた",
  pattern: "ブログの型",
  categories: "カテゴリー",
  article_types: "記事の種類",
  design: "見た目",
  domain: "名前とURL",
  policy: "広告と編集の方針",
  content_plan: "最初の記事の計画",
  create: "作る",
};

/** その段階で何を決めるのか。ラベルだけでは何を書けばよいか分からない。 */
export const SITE_WIZARD_STEP_QUESTION: Readonly<Record<SiteWizardStep, string>> = {
  purpose: "このブログを読んだ人が、何をできるようになりますか。",
  genre: "どの分野の商品・サービスを扱いますか。",
  audience: "誰が、どんな言葉で探してたどり着きますか。",
  author: "誰の立場で書きますか。他にはない経験は何ですか。",
  revenue: "どうやって収益にしますか。",
  pattern: "どの型のブログにしますか。型によって最初に用意するページが変わります。",
  categories: "読者の入口になるカテゴリーを決めます。",
  article_types: "各カテゴリーに最初に置く記事の種類を決めます。",
  design: "配色を選びます。色の値ではなく、名前で選びます。",
  domain: "ブログの名前と URL に使う文字列を決めます。",
  policy: "広告の出し方と、記事の役割を決めます。",
  content_plan: "何をどう比べるか、記事同士をどうつなぐかを決めます。",
  create: "ここまでの内容でブログを作ります。",
};

export function createSiteDraft(input: {
  id: SiteDraftId;
  workspaceId: WorkspaceId;
}): SiteDraft {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    revision: 0,
    purpose: "",
    genre: "",
    targetReader: "",
    searchIntent: "",
    uniqueExperience: "",
    conclusionStance: "",
    revenueModel: null,
    pattern: null,
    categories: [],
    articleTypes: [],
    theme: null,
    name: "",
    slug: "",
    articlePurpose: "",
    ctaStrategy: "",
    evaluationAxis: "",
    usageScene: "",
    comparisonScope: "",
    internalLinkStrategy: "",
    createdSiteSlug: null,
  };
}

/**
 * その段階が埋まっているか。
 *
 * **判定を 1 箇所に集める。** 画面と保存処理で別々に判定すると、
 * 「画面では緑なのに保存できない」が起きる。
 */
export function isStepComplete(draft: SiteDraft, step: SiteWizardStep): boolean {
  switch (step) {
    case "purpose":
      return draft.purpose.trim() !== "";
    case "genre":
      return draft.genre.trim() !== "";
    case "audience":
      return draft.targetReader.trim() !== "" && draft.searchIntent.trim() !== "";
    case "author":
      return draft.uniqueExperience.trim() !== "" && draft.conclusionStance.trim() !== "";
    case "revenue":
      return draft.revenueModel !== null;
    case "pattern":
      return draft.pattern !== null;
    case "categories":
      return draft.categories.length > 0;
    case "article_types":
      return draft.articleTypes.length > 0;
    case "design":
      return draft.theme !== null;
    case "domain":
      return draft.name.trim() !== "" && draft.slug.trim() !== "";
    case "policy":
      return draft.articlePurpose.trim() !== "" && draft.ctaStrategy.trim() !== "";
    case "content_plan":
      return (
        draft.evaluationAxis.trim() !== "" &&
        draft.usageScene.trim() !== "" &&
        draft.comparisonScope.trim() !== "" &&
        draft.internalLinkStrategy.trim() !== ""
      );
    case "create":
      return draft.createdSiteSlug !== null;
  }
}

/** まだ埋まっていない段階。作る前の確認に使う。 */
export function incompleteSteps(draft: SiteDraft): readonly SiteWizardStep[] {
  return SITE_WIZARD_STEPS.filter((s) => s !== "create" && !isStepComplete(draft, s));
}

/**
 * 下書きから差別化の 10 軸を組み立てる。
 *
 * 10 軸は設計図が必須で持つ。ウィザードの各段階の答えが
 * どの軸になるかをここで決めておくと、段階を増減させても
 * 「どの軸が埋まらなくなったか」が 1 箇所で分かる。
 */
export function toDifferentiationAxes(draft: SiteDraft): DifferentiationAxes {
  return {
    targetReader: draft.targetReader,
    searchIntent: draft.searchIntent,
    articlePurpose: draft.articlePurpose,
    evaluationAxis: draft.evaluationAxis,
    usageScene: draft.usageScene,
    uniqueExperience: draft.uniqueExperience,
    comparisonScope: draft.comparisonScope,
    conclusionStance: draft.conclusionStance,
    internalLinkStrategy: draft.internalLinkStrategy,
    ctaStrategy: draft.ctaStrategy,
  };
}

/** URL に使う文字列の作法。ブログを増やすたびに書き方が揺れないよう固定する。 */
export function validateSlug(slug: string): Result<string, DomainError> {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return err(
      validationError(
        "URL に使う文字列は、半角の英小文字・数字・ハイフンだけで書いてください。",
        "slug",
      ),
    );
  }
  if (slug.startsWith("-") || slug.endsWith("-")) {
    return err(validationError("URL に使う文字列をハイフンで始めたり終えたりできません。", "slug"));
  }
  return ok(slug);
}
