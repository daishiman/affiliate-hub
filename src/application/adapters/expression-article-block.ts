import {
  EXPRESSION_BLOCK_KINDS,
  EXPRESSION_BLOCK_LABEL,
  fillSlots,
  type ExpressionBlock,
} from "@/domain/authoring/blog-template";
import type { ArticleBlockKind, BlogArticleBlock } from "@/domain/blogops";

const EXPRESSION_CARRIER_PREFIX = "expression-block:v1:";

/**
 * 表現ブロックと記事版面ブロックは意味が違うので、型やテーブルを統合しない。
 * この対応表だけが「どの既存節を運搬に使うか」を知る composition 境界になる。
 */
const ARTICLE_KIND_BY_EXPRESSION: Readonly<Record<ExpressionBlock["kind"], ArticleBlockKind>> = {
  answer: "intro-box",
  key_points: "criterion-section",
  faq: "summary-section",
  sources: "editor-credential-box",
  freshness: "article-meta",
  figure: "featured-image",
  comparison: "pick-section",
  cta: "product-card",
  summary: "summary-section",
  spec_table: "spec-section",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isExpressionBlock(value: unknown): value is ExpressionBlock {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  if (!(EXPRESSION_BLOCK_KINDS as readonly string[]).includes(value.kind)) return false;
  const slot = value.slot;
  if (
    slot !== undefined &&
    (!isRecord(slot) || typeof slot.name !== "string" || typeof slot.fallback !== "string")
  ) {
    return false;
  }
  switch (value.kind) {
    case "answer":
    case "summary":
      return typeof value.text === "string";
    case "key_points":
      return Array.isArray(value.items) && value.items.every((item) => typeof item === "string");
    case "faq":
      return (
        Array.isArray(value.items) &&
        value.items.every(
          (item) =>
            isRecord(item) &&
            typeof item.question === "string" &&
            typeof item.answer === "string",
        )
      );
    case "sources":
      return (
        Array.isArray(value.items) &&
        value.items.every(
          (item) =>
            isRecord(item) &&
            typeof item.label === "string" &&
            typeof item.checkedAt === "string" &&
            (item.url === undefined || typeof item.url === "string"),
        )
      );
    case "freshness":
      return (
        typeof value.asOf === "string" &&
        (value.note === undefined || typeof value.note === "string")
      );
    case "figure":
      return typeof value.caption === "string" && typeof value.alt === "string";
    case "comparison":
      return typeof value.caption === "string";
    case "cta":
      return typeof value.label === "string" && typeof value.href === "string";
    case "spec_table":
      return (
        Array.isArray(value.rows) &&
        value.rows.every(
          (row) =>
            isRecord(row) && typeof row.label === "string" && typeof row.value === "string",
        )
      );
    default:
      return false;
  }
}

export function toExpressionArticleBlock(
  expression: ExpressionBlock,
  id: string,
  position: number,
): BlogArticleBlock {
  return {
    id,
    kind: ARTICLE_KIND_BY_EXPRESSION[expression.kind],
    heading: EXPRESSION_BLOCK_LABEL[expression.kind],
    body: `${EXPRESSION_CARRIER_PREFIX}${JSON.stringify(expression)}`,
    position,
  };
}

/** carrier 本文だけを受ける pure decoder。読み取りモデルが記事集約へ逆依存しない境界。 */
export function expressionBlockOfArticleBody(body: string): ExpressionBlock | null {
  if (!body.startsWith(EXPRESSION_CARRIER_PREFIX)) return null;
  try {
    const value: unknown = JSON.parse(body.slice(EXPRESSION_CARRIER_PREFIX.length));
    return isExpressionBlock(value) ? value : null;
  } catch {
    return null;
  }
}

/** 壊れた carrier は通常本文としても表示せず、境界で不正として扱う。 */
export function expressionBlockOfArticleBlock(block: BlogArticleBlock): ExpressionBlock | null {
  return expressionBlockOfArticleBody(block.body);
}

/** prefix が在る本文は、decode に失敗しても通常本文へ戻さない。 */
export function isExpressionArticleBody(body: string): boolean {
  return body.startsWith(EXPRESSION_CARRIER_PREFIX);
}

export function isExpressionArticleBlock(block: BlogArticleBlock): boolean {
  return isExpressionArticleBody(block.body);
}

/**
 * 保存済み carrier へテンプレート差し替えを適用する production composition。
 * 通常の記事ブロックは一切変えない。
 */
export function composeExpressionArticleBlocks(
  blocks: readonly BlogArticleBlock[],
  replacements: Readonly<Record<string, ExpressionBlock>>,
): readonly BlogArticleBlock[] {
  return blocks.map((block) => {
    const expression = expressionBlockOfArticleBlock(block);
    if (expression === null) return block;
    const [composed] = fillSlots([expression], replacements);
    return toExpressionArticleBlock(composed, block.id, block.position);
  });
}

export function affiliatePlacementArticleBlockId(input: {
  readonly workspaceId: string;
  readonly siteSlug: string;
  readonly articleSlug: string;
  readonly placement: string;
  readonly trackingCode?: string;
}): string {
  // ハッシュにすると衝突時に別 CTA を上書きする。自然 identity を可逆に符号化する。
  return `bab_affiliate:${[
    input.workspaceId,
    input.siteSlug,
    input.articleSlug,
    input.placement,
    input.trackingCode ?? "",
  ].map(encodeURIComponent).join(":")}`;
}

const PLACEMENT_POSITION: Readonly<Record<string, number>> = {
  intro: 100,
  comparison: 500,
  conclusion: 900,
};

export function toAffiliatePlacementArticleBlock(input: {
  readonly workspaceId: string;
  readonly siteSlug: string;
  readonly articleSlug: string;
  readonly placement: string;
  readonly trackingCode?: string;
  readonly position: number;
}): BlogArticleBlock {
  const href = input.trackingCode === undefined
    ? "#"
    : `/go/${encodeURIComponent(input.trackingCode)}`;
  return toExpressionArticleBlock(
    { kind: "cta", label: "詳しく見る", href },
    affiliatePlacementArticleBlockId(input),
    (PLACEMENT_POSITION[input.placement] ?? 700) + input.position,
  );
}
