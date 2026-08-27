import type { SitePattern, StandardPage } from "./site-blueprint";
import {
  SITE_DOCUMENT_KEYS,
  SITE_DOCUMENT_LABEL,
  type SiteDocumentKey,
} from "./site-routes";

/**
 * ブログのテンプレート（feat-blog-ui-builder）。
 *
 * テンプレートは **並び方** だけを決める。記事の中身（ブロック）はテンプレートを
 * 知らないので、テンプレートを差し替えても既存記事は壊れない（受入条件 1）。
 * ここに「このテンプレートでは figure が使えない」の類を書かないこと。
 * 書くと差し替えた瞬間に記事の一部が消える。
 */
export const BLOG_TEMPLATE_IDS = [
  "review_focus",
  "comparison_focus",
  "howto",
  "news",
  "minimal",
  "gadget",
] as const;
export type BlogTemplateId = (typeof BLOG_TEMPLATE_IDS)[number];

export type BlogTemplate = {
  readonly id: BlogTemplateId;
  readonly label: string;
  /** 設計図の型（`SitePattern`）との対応。テンプレートから設計図の既定を引く。 */
  readonly pattern: SitePattern;
  /** トップの区画の並び。 */
  readonly homeSections: readonly ("recent" | "categories" | "ranking" | "comparison" | "guide" | "news")[];
  /** 記事のブロックの推奨順。無いブロックは飛ばす（消さない）。 */
  readonly articleBlockOrder: readonly ExpressionBlockKind[];
  /** サイドバーを既定で出すか（ミニマルは出さない）。 */
  readonly sidebar: boolean;
  /** 追加で薦める固定ページ。信頼ページは常に別枠で必須。 */
  readonly suggestedPages: readonly StandardPage[];
};

/**
 * 記事の表現ブロック。
 *
 * 前半 5 つは AI 検索・AI 引用のための構造（Google「AI 機能での最適化ガイド」は
 * 追加の技術要件を求めないが、引用されやすい構造として結論・要点・FAQ・出典・鮮度を
 * 明示する。system-spec ui-ux 章 §SEO/AI 検索）。後半 5 つは従来の表現ブロック。
 */
export const EXPRESSION_BLOCK_KINDS = [
  "answer",
  "key_points",
  "faq",
  "sources",
  "freshness",
  "figure",
  "comparison",
  "cta",
  "summary",
  "spec_table",
] as const;
export type ExpressionBlockKind = (typeof EXPRESSION_BLOCK_KINDS)[number];

export const EXPRESSION_BLOCK_LABEL: Readonly<Record<ExpressionBlockKind, string>> = {
  answer: "結論（先に答え）",
  key_points: "要点",
  faq: "よくある質問",
  sources: "出典",
  freshness: "最終更新・〜時点",
  figure: "図解",
  comparison: "比較表",
  cta: "行動の呼びかけ",
  summary: "まとめ",
  spec_table: "スペック表",
};

/**
 * ガジェット依存部分の差し替え口（スロット）。
 *
 * `slot` が付いたブロックは、別カテゴリのブログで中身だけ差し替えて再利用できる。
 * 差し替え先が無いときは `fallback` を出す（黙って空にしない）。
 */
export type BlockSlot = {
  readonly name: string;
  readonly fallback: string;
};

export type ExpressionBlock =
  | { readonly kind: "answer"; readonly text: string; readonly slot?: BlockSlot }
  | { readonly kind: "key_points"; readonly items: readonly string[]; readonly slot?: BlockSlot }
  | {
      readonly kind: "faq";
      readonly items: readonly { readonly question: string; readonly answer: string }[];
      readonly slot?: BlockSlot;
    }
  | {
      readonly kind: "sources";
      readonly items: readonly { readonly label: string; readonly url?: string; readonly checkedAt: string }[];
      readonly slot?: BlockSlot;
    }
  | { readonly kind: "freshness"; readonly asOf: string; readonly note?: string; readonly slot?: BlockSlot }
  | { readonly kind: "figure"; readonly caption: string; readonly alt: string; readonly slot?: BlockSlot }
  | { readonly kind: "comparison"; readonly caption: string; readonly slot?: BlockSlot }
  | { readonly kind: "cta"; readonly label: string; readonly href: string; readonly slot?: BlockSlot }
  | { readonly kind: "summary"; readonly text: string; readonly slot?: BlockSlot }
  | {
      readonly kind: "spec_table";
      readonly rows: readonly { readonly label: string; readonly value: string }[];
      readonly slot?: BlockSlot;
    };

const AI_FIRST: readonly ExpressionBlockKind[] = ["answer", "key_points"];
const AI_LAST: readonly ExpressionBlockKind[] = ["faq", "sources", "freshness"];

export const BLOG_TEMPLATES: readonly BlogTemplate[] = [
  {
    id: "review_focus",
    label: "レビュー特化",
    pattern: "specialist_review",
    homeSections: ["recent", "ranking", "categories"],
    articleBlockOrder: [...AI_FIRST, "figure", "spec_table", "summary", "cta", ...AI_LAST],
    sidebar: true,
    suggestedPages: ["review", "ranking", "authors"],
  },
  {
    id: "comparison_focus",
    label: "比較特化",
    pattern: "comparison_lab",
    homeSections: ["comparison", "ranking", "recent", "categories"],
    articleBlockOrder: [...AI_FIRST, "comparison", "spec_table", "figure", "summary", "cta", ...AI_LAST],
    sidebar: true,
    suggestedPages: ["comparison", "ranking", "methodology"],
  },
  {
    id: "howto",
    label: "ハウツー",
    pattern: "beginner_guide",
    homeSections: ["guide", "recent", "categories"],
    articleBlockOrder: [...AI_FIRST, "figure", "summary", "cta", ...AI_LAST],
    sidebar: true,
    suggestedPages: ["how_to_choose", "authors"],
  },
  {
    id: "news",
    label: "ニュース",
    pattern: "editorial_media",
    homeSections: ["news", "recent", "categories"],
    articleBlockOrder: [...AI_FIRST, "summary", "figure", ...AI_LAST, "cta"],
    sidebar: false,
    suggestedPages: ["corrections", "editorial_policy"],
  },
  {
    id: "minimal",
    label: "ミニマル",
    pattern: "personal_brand",
    homeSections: ["recent"],
    articleBlockOrder: [...AI_FIRST, "summary", ...AI_LAST],
    sidebar: false,
    suggestedPages: [],
  },
  {
    id: "gadget",
    label: "ガジェット寄り",
    pattern: "specialist_review",
    homeSections: ["ranking", "comparison", "recent", "categories"],
    articleBlockOrder: [...AI_FIRST, "spec_table", "figure", "comparison", "cta", "summary", ...AI_LAST],
    sidebar: true,
    suggestedPages: ["review", "comparison", "ranking"],
  },
];

export function findBlogTemplate(id: string): BlogTemplate | null {
  return BLOG_TEMPLATES.find((t) => t.id === id) ?? null;
}

/**
 * テンプレートの並びで記事のブロックを並べ直す。
 *
 * **ブロックは 1 つも落とさない。** テンプレートの並びに無い種類は末尾へ
 * 元の順のまま付ける。これが「差し替えても既存記事が壊れない」の中身。
 */
export function orderBlocksForTemplate(
  template: Pick<BlogTemplate, "articleBlockOrder">,
  blocks: readonly ExpressionBlock[],
): readonly ExpressionBlock[] {
  const rank = new Map<ExpressionBlockKind, number>(
    template.articleBlockOrder.map((k, i) => [k, i]),
  );
  return [...blocks]
    .map((b, i) => ({ b, i }))
    .sort((x, y) => {
      const rx = rank.get(x.b.kind) ?? Number.MAX_SAFE_INTEGER;
      const ry = rank.get(y.b.kind) ?? Number.MAX_SAFE_INTEGER;
      return rx === ry ? x.i - y.i : rx - ry;
    })
    .map(({ b }) => b);
}

/**
 * スロットの差し替え。差し替え先が無い名前は `fallback` を本文にした
 * summary ブロックへ落とす。空にしない。
 */
export function fillSlots(
  blocks: readonly ExpressionBlock[],
  replacements: Readonly<Record<string, ExpressionBlock>>,
): readonly ExpressionBlock[] {
  return blocks.map((b) => {
    if (b.slot === undefined) return b;
    const r = replacements[b.slot.name];
    if (r !== undefined) return r;
    return { kind: "summary", text: b.slot.fallback };
  });
}

/** @deprecated 固定ページの正本は blogops/fixed-page。旧 import 名だけを保つ。 */
export {
  FIXED_PAGE_KINDS as LEGAL_PAGE_KINDS,
  FIXED_PAGE_LABEL as LEGAL_PAGE_LABEL,
  type FixedPageKind as LegalPageKind,
} from "../blogops/fixed-page";

/**
 * 配色の 2 層。ブログ既定（blog_theme）とページ単位の上書き（page_theme_override）。
 * 値は `tokens.css` の `light-dark()` を選ぶ data 属性の名前であって、色そのものではない
 * （decision-ui-theme-implementation）。
 */
export type BlogTheme = {
  readonly brandTheme: string;
  readonly colorMode: "auto" | "light" | "dark";
};

export type PageThemeOverride = Partial<BlogTheme>;

/** ページに効く配色。上書きを外す（`null`）とブログ既定へ戻る（受入条件 2）。 */
export function resolvePageTheme(
  blogTheme: BlogTheme,
  override: PageThemeOverride | null,
): BlogTheme {
  if (override === null) return blogTheme;
  return {
    brandTheme: override.brandTheme ?? blogTheme.brandTheme,
    colorMode: override.colorMode ?? blogTheme.colorMode,
  };
}
