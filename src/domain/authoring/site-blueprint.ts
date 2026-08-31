import {
  type DomainError,
  type Result,
  type SiteBlueprintId,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";
import type { ArticleType } from "./article-structure";
import { similarity } from "./quality-check";

/**
 * Site Blueprint = ブログの設計図。
 *
 * 「複数ブログ対応」をコードの分岐やコピーで作らないための中核。
 * ブログを 1 本増やすときに触るのは、この設定値とテーマトークンだけにする。
 * ブログ固有の処理を書きたくなったら、それは Blueprint の項目が
 * 足りていないという合図であり、if 文を足す合図ではない。
 *
 * 参考記事 (参考サイトのまとめ記事 1 本。実ホストと実 slug は
 * docs/spec/feat-reference-blog-admin-ux/evidence/reference-site-profile.json にだけ置く) の構成を
 * 参照しているが、本文・画像は一切複製しない。参照したのは
 * 「ランキング記事の並び方」だけであり、その並びは仕様書
 * (プラットフォーム層 §16.4 / ブログ層 §9.1) の記事構成と一致する。
 * よってコード上の正本は仕様書側の構成 (article-structure.ts) とする。
 */

/** ブログパターン (プラットフォーム層 §16.1)。 */
export const SITE_PATTERNS = [
  "specialist_review", // 専門レビュー型
  "comparison_lab", // 比較研究所型
  "beginner_guide", // 初心者案内型
  "personal_brand", // 個人ブランド型
  "product_discovery", // 商品発見型
  "service_signup", // サービス申込み型
  "tool", // ツール型
  "editorial_media", // メディア編集部型
  "story", // ストーリー型
  "database", // データベース型
] as const;
export type SitePattern = (typeof SITE_PATTERNS)[number];

/**
 * ブログパターンの表示名。**ここが唯一の正本**。
 *
 * 以前は作成ウィザードと一覧画面がそれぞれ別に持っていた。
 * 同じ値に別の呼び名が付くと、利用者は「作るときの言葉」と「見るときの言葉」を
 * 頭の中で対応づけることになる。対応づけを利用者にさせない。
 * 検査: tests/architecture/single-definition.test.ts
 */
export const SITE_PATTERN_LABEL: Readonly<Record<SitePattern, string>> = {
  specialist_review: "専門レビュー型",
  comparison_lab: "比較研究所型",
  beginner_guide: "初心者案内型",
  personal_brand: "個人ブランド型",
  product_discovery: "商品発見型",
  service_signup: "サービス申込み型",
  tool: "ツール型",
  editorial_media: "メディア編集部型",
  story: "ストーリー型",
  database: "データベース型",
};

/** 収益モデル。ブログの構成と CTA の既定値を決める。 */
export const REVENUE_MODELS = ["affiliate", "ad", "lead", "own_product", "mixed"] as const;
export type RevenueModel = (typeof REVENUE_MODELS)[number];

/**
 * 収益モデルの表示名。**ここが唯一の正本**。
 *
 * 「提携販売」より「成果報酬の紹介」を採る。
 * 何が起きたらお金になるのかが言葉に入っている方を選ぶ。
 */
export const REVENUE_MODEL_LABEL: Readonly<Record<RevenueModel, string>> = {
  affiliate: "成果報酬の紹介",
  ad: "広告の掲載",
  lead: "問い合わせの送客",
  own_product: "自社の商品",
  mixed: "組み合わせ",
};

/** 固定ページ (プラットフォーム層 §16.3 / ブログ層 §7)。 */
export const STANDARD_PAGES = [
  "home",
  "category",
  "ranking",
  "review",
  "comparison",
  "how_to_choose",
  "beginner_guide",
  "faq",
  "glossary",
  "tools",
  "authors",
  "experts",
  "methodology",
  "editorial_policy",
  "advertising_policy",
  "ai_policy",
  "corrections",
  "contact",
  "privacy",
  "terms",
  "search",
  "shortlist",
] as const;
export type StandardPage = (typeof STANDARD_PAGES)[number];

/**
 * 信頼のために必ず置くページ。
 *
 * 公開ゲート (compliance) がこの一覧を検査する。
 * 「後で作る」で公開すると、広告表記の説明先が無い記事が世に出る。
 */
export const TRUST_REQUIRED_PAGES: readonly StandardPage[] = [
  "authors",
  "methodology",
  "editorial_policy",
  "advertising_policy",
  "ai_policy",
  "corrections",
  "contact",
  "privacy",
];

/**
 * ブランドテーマの名前。
 *
 * **色そのものをここに持たせない。** 持たせると、
 * 「そのブログだけ AA を割る配色」が設定値として入り込める状態になる。
 *
 * 実体は `src/presentation/ui/tokens/themes.css` にある
 * 「2 段目トークン 10 個の上書き集合」。ここはその名札を指すだけ。
 * 名前が一致していることは `tests/ui/blueprint-theme.test.ts` が確認する。
 */
export const BRAND_THEMES = [
  "graphite-amber",
  "indigo-teal",
  "teal-clay",
  "indigo-clay",
  // 利用者の指定した 5 系統。名札を足すだけで、部品は 1 つも変わらない。
  "blue",
  "pink",
  "white",
  "gray",
  "green",
  "purple",
] as const;
export type BrandTheme = (typeof BRAND_THEMES)[number];

/**
 * 画面に出す配色の名前。
 *
 * **CSS の `--brand-theme-name` と二重に持たない**ようにしたいところだが、
 * CSS の値はサーバー側から読めない（読むには CSS を解析することになる）。
 * そこで正本はこちらに置き、`tests/ui/blueprint-theme.test.ts` が
 * CSS 側の名前と一致していることを機械で見る。ずれたらテストが落ちる。
 */
export const BRAND_THEME_LABELS: Readonly<Record<BrandTheme, string>> = {
  "graphite-amber": "既定（グラファイト × アンバー）",
  "indigo-teal": "インディゴ × ティール",
  "teal-clay": "ティール × クレイ",
  "indigo-clay": "インディゴ × クレイ",
  blue: "青系",
  pink: "ピンク系",
  white: "ホワイト系",
  gray: "グレー系",
  green: "グリーン系",
  purple: "パープル系",
};

/**
 * 明暗の選び方。
 *
 * `auto` は端末の設定に従う。**これを既定にしておく**のは、
 * 利用者が何も選ばないうちから明るい画面を強制すると、
 * 暗い環境で読む人に眩しい画面が出るため。
 */
export const COLOR_MODES = ["auto", "light", "dark"] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

export const COLOR_MODE_LABELS: Readonly<Record<ColorMode, string>> = {
  auto: "端末の設定に合わせる",
  light: "明るい画面",
  dark: "暗い画面",
};

/**
 * 見た目の設定値。
 *
 * 色は名前で持つ。ブログごとに違うのはこの名前と、
 * 余白の詰め具合・角丸・書体だけ。
 * 「操作の色」「実行中の色」という役割そのものは、どのブログでも変えない。
 */
export type ThemeTokens = {
  readonly brandTheme: BrandTheme;
  readonly fontHeading: string;
  readonly fontBody: string;
  readonly radius: "none" | "small" | "medium" | "large";
  readonly density: "compact" | "comfortable";
  readonly colorScheme: ColorMode;
};

/** 既定テーマ (Mode A: Graphite × Amber)。未指定のブログはこれを使う。 */
export const DEFAULT_THEME: ThemeTokens = {
  brandTheme: "graphite-amber",
  fontHeading: "system-ui",
  fontBody: "system-ui",
  radius: "medium",
  density: "comfortable",
  colorScheme: "auto",
};

export type CategoryPlan = {
  readonly slug: string;
  readonly name: string;
  /** このカテゴリーの 1 文説明。カテゴリーページ冒頭にそのまま出す。 */
  readonly oneLine: string;
  /** 最初に用意する記事タイプの組み合わせ。 */
  readonly initialArticleTypes: readonly ArticleType[];
};

/**
 * 差別化の軸 (プラットフォーム層 §16.6)。
 *
 * 同じ商品を複数サイトで扱うとき、ここを変えずに文章だけ変えると
 * 「言い換え記事の量産」になる。Blueprint に持たせて、
 * 新しいサイトを作るときに必ず埋めさせる。
 */
export type DifferentiationAxes = {
  readonly targetReader: string;
  readonly searchIntent: string;
  readonly articlePurpose: string;
  readonly evaluationAxis: string;
  readonly usageScene: string;
  readonly uniqueExperience: string;
  readonly comparisonScope: string;
  readonly conclusionStance: string;
  readonly internalLinkStrategy: string;
  readonly ctaStrategy: string;
};

export type SiteBlueprint = {
  readonly id: SiteBlueprintId;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly pattern: SitePattern;
  readonly purpose: string;
  readonly genre: string;
  readonly revenueModel: RevenueModel;
  readonly pages: readonly StandardPage[];
  readonly categories: readonly CategoryPlan[];
  readonly theme: ThemeTokens;
  readonly differentiation: DifferentiationAxes;
  /** llms.txt を出すか (ブログ層 §18.4。任意)。 */
  readonly emitLlmsTxt: boolean;
};

/**
 * パターンごとの既定ページ構成。
 *
 * ここを表で持つことで、新しいブログパターンを増やすときに
 * 触るのはこの表だけになる (変更容易性シナリオ③)。
 */
const PATTERN_DEFAULT_PAGES: Readonly<Record<SitePattern, readonly StandardPage[]>> = {
  specialist_review: ["home", "category", "review", "ranking", "methodology", "glossary"],
  comparison_lab: ["home", "category", "comparison", "ranking", "methodology", "search"],
  beginner_guide: ["home", "category", "beginner_guide", "how_to_choose", "faq", "glossary"],
  personal_brand: ["home", "category", "review", "authors"],
  product_discovery: ["home", "category", "search", "shortlist"],
  service_signup: ["home", "category", "comparison", "how_to_choose", "faq"],
  tool: ["home", "tools", "how_to_choose", "faq"],
  editorial_media: ["home", "category", "ranking", "review", "authors", "experts", "methodology"],
  story: ["home", "category", "review", "authors"],
  database: ["home", "category", "search", "comparison"],
};

export function createSiteBlueprint(input: {
  id: SiteBlueprintId;
  workspaceId: WorkspaceId;
  name: string;
  pattern: SitePattern;
  purpose: string;
  genre: string;
  revenueModel: RevenueModel;
  extraPages?: readonly StandardPage[];
  categories: readonly CategoryPlan[];
  theme?: Partial<ThemeTokens>;
  differentiation: DifferentiationAxes;
  emitLlmsTxt?: boolean;
}): Result<SiteBlueprint, DomainError> {
  if (input.name.trim() === "") {
    return err(validationError("ブログ名が空です。", "name"));
  }
  if (input.categories.length === 0) {
    return err(
      validationError("カテゴリーが 1 つもありません。読者の入口が作れません。", "categories"),
    );
  }
  const emptyAxes = (Object.entries(input.differentiation) as [string, string][])
    .filter(([, v]) => v.trim() === "")
    .map(([k]) => k);
  if (emptyAxes.length > 0) {
    return err(
      validationError(
        `差別化の軸が空です (${emptyAxes.join(" / ")})。ここを埋めないと、既存ブログの言い換え記事になります。`,
        "differentiation",
      ),
    );
  }

  const slugs = new Set<string>();
  for (const c of input.categories) {
    if (!/^[a-z0-9-]+$/.test(c.slug)) {
      return err(
        validationError(`カテゴリーのURL用の名前「${c.slug}」は半角英小文字・数字・ハイフンで指定してください。`, "categories"),
      );
    }
    if (slugs.has(c.slug)) {
      return err(validationError(`カテゴリー「${c.slug}」が重複しています。`, "categories"));
    }
    slugs.add(c.slug);
    if (c.oneLine.trim() === "") {
      return err(
        validationError(`カテゴリー「${c.name}」の 1 文説明が空です。`, "categories"),
      );
    }
  }

  const pages = new Set<StandardPage>([
    ...PATTERN_DEFAULT_PAGES[input.pattern],
    ...TRUST_REQUIRED_PAGES,
    ...(input.extraPages ?? []),
  ]);

  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    name: input.name,
    pattern: input.pattern,
    purpose: input.purpose,
    genre: input.genre,
    revenueModel: input.revenueModel,
    pages: [...pages],
    categories: input.categories,
    theme: { ...DEFAULT_THEME, ...input.theme },
    differentiation: input.differentiation,
    emitLlmsTxt: input.emitLlmsTxt ?? false,
  });
}

/** 信頼ページが揃っているか。サイト公開の前提条件。 */
export function missingTrustPages(blueprint: Pick<SiteBlueprint, "pages">): readonly StandardPage[] {
  return TRUST_REQUIRED_PAGES.filter((p) => !blueprint.pages.includes(p));
}

/**
 * 2 つのブログが十分に差別化されているか。
 *
 * 同じワークスペースで似たブログを増やすときに呼ぶ。
 * 10 軸のうち 3 軸以上が違えば別のブログとして成立すると判断する。
 * この閾値は仕様に無く、こちらで置いた仮の値。運用で調整する。
 */
export const MIN_DIFFERENT_AXES = 3;

/**
 * 2 つの軸を「同じ」と数える近さ。**この値以上なら同じ軸とする。**
 *
 * 仕様 §16.6 を文章まで落とした `docs/spec/05-文章作成メソッド仕様.md` §6-1 の
 * 対象読者の行が「リード文の類似度 < 0.5」を差別化の条件にしている。
 * 軸そのものの近さにも同じ物差しを使う（軸ごとに別の数字を置かない）。
 *
 * **物差しは `similarity()` を借りる。** 新しい近さの測り方を作らない。
 * 2 つあると、片方だけ緩めて通す道ができる。
 */
export const SAME_AXIS_SIMILARITY = 0.5;

/**
 * 軸の文字列を、**表記のゆれを落とした形**にする。
 *
 * `trim()` では両端しか落ちない。全角と半角、間に入れた空白は残る。
 * 「10 万円台のノート 5 機種」と「10万円台のノート5機種」が
 * 別の軸として数えられると、空白を消すだけで差別化したことになる。
 */
function normalizeAxis(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, "");
}

/**
 * 2 つの軸が、**読んで得られるものとして違うか**。
 *
 * 文字列の一致では見ない。§16.6 が禁じているのは「単なる言い換え」なので、
 * 語尾・送り仮名・同義語だけを変えたものは同じ軸として数える。
 *
 * **短い軸（正規化して 3 文字未満）では近さが測れない。** `similarity()` は
 * 3-gram の重なりなので、3 文字に満たない文字列からは gram が 1 つも作れず、
 * 必ず 0（＝違う）になる。その場合は正規化した文字列の一致だけで見る。
 * 短い軸（「速さ」「安さ」など）は言い換えの余地も小さいので実害は小さいが、
 * **測れていないことは知っておくこと**（0 は「違う」の意味ではなく「測れない」である）。
 */
function axisDiffers(left: string, right: string): boolean {
  const a = normalizeAxis(left);
  const b = normalizeAxis(right);
  if (a === b) return false;
  return similarity(a, b) < SAME_AXIS_SIMILARITY;
}

/**
 * --- 文字列の一致で数えていた頃のこと（2026-08-19 に直した） ---
 * ここは `a[k].trim() !== b[k].trim()` だった。文字列としては違うので、
 * **軸を 3 つ言い換えるだけで `sufficient: true` になった**。
 * §16.6 の本文 1 行目が「単なる言い換え記事を量産しない」なので、
 * 要件が名指しで禁じているものが、要件を満たす手順になっていた。
 *
 * `docs/product/traceability.md` の REQ-W10 は「言い換え本文は
 * `similarity()` ≥0.85 で停止」と書いているが、それは記事本文の話で、
 * 軸の側には物差しが無かった。**同じ要件の中で、片側にだけ道具があった。**
 */
export function differentiationGap(
  a: DifferentiationAxes,
  b: DifferentiationAxes,
): { differentAxes: readonly string[]; sufficient: boolean } {
  const keys = Object.keys(a) as (keyof DifferentiationAxes)[];
  const different = keys.filter((k) => axisDiffers(a[k], b[k]));
  return { differentAxes: different, sufficient: different.length >= MIN_DIFFERENT_AXES };
}
