import {
  type DisclosureId,
  type DomainError,
  type Result,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * Compliance コンテキスト / 広告表示。
 *
 * 日本のステルスマーケティング規制 (景品表示法) と、
 * Google が案内する rel="sponsored" を、1 箇所で扱う。
 *
 * 表示文言をここで組み立てる理由: 記事・SNS本文・AI回答・WebMCP応答・
 * 比較表・投稿プレビューの 6 箇所で同じ表記を出す必要があるため
 * (プラットフォーム層 §20.2)。
 */
export type RelationshipType =
  | "affiliate" // アフィリエイト広告を利用
  | "sponsored" // スポンサー
  | "supplied" // 商品提供
  | "loaned" // 商品貸与
  | "purchased" // 自費購入
  | "paid_partnership"; // 有償パートナーシップ

/** スポンサーが編集内容へ関与した範囲。 */
export type EditorialInfluence = "none" | "limited" | "declared";

export type Disclosure = {
  readonly id: DisclosureId;
  readonly workspaceId: WorkspaceId;
  readonly relationshipType: RelationshipType;
  readonly advertiserOrSupplier: string | null;
  readonly editorialInfluence: EditorialInfluence;
  /** 読者に見せる文言。 */
  readonly visibleMessage: string;
  /** AI 生成・AI 補助を使ったか (§20.1)。 */
  readonly aiAssisted: boolean;
};

/** 自費購入以外は必ず表示が要る。 */
const DISCLOSURE_REQUIRED: ReadonlySet<RelationshipType> = new Set<RelationshipType>([
  "affiliate",
  "sponsored",
  "supplied",
  "loaned",
  "paid_partnership",
]);

/**
 * 広告との関係の表示文。**ここが唯一の正本**。
 *
 * 読者へ出す文そのものなので、選ばせる画面もこの文言を使う。
 * 画面側で「アフィリエイト」と短く書き直すと、選んだ言葉と
 * 記事に出る言葉が違ってしまい、何を選んだのかが確かめられなくなる。
 */
export const RELATIONSHIP_LABEL: Record<RelationshipType, string> = {
  affiliate: "アフィリエイト広告を利用しています",
  sponsored: "スポンサー提供の記事です",
  supplied: "商品の提供を受けています",
  loaned: "商品の貸与を受けています",
  purchased: "商品は編集部が自費で購入しています",
  paid_partnership: "有償パートナーシップによる記事です",
};

const INFLUENCE_LABEL: Record<EditorialInfluence, string> = {
  none: "評価内容に広告主は関与していません",
  limited: "広告主は事実確認のみ行い、評価には関与していません",
  declared: "広告主が内容確認を行っています",
};

/**
 * 読者へ出す表示文を組み立てる。
 *
 * 文言を画面側で書かせない。書かせると必ず短縮され、
 * 「PR」とだけ書かれた判別しにくい表示になる。
 */
export function buildVisibleMessage(input: {
  relationshipType: RelationshipType;
  advertiserOrSupplier: string | null;
  editorialInfluence: EditorialInfluence;
  aiAssisted: boolean;
}): string {
  const parts: string[] = [RELATIONSHIP_LABEL[input.relationshipType]];
  if (input.advertiserOrSupplier) {
    parts.push(`提供元: ${input.advertiserOrSupplier}`);
  }
  parts.push(INFLUENCE_LABEL[input.editorialInfluence]);
  if (input.aiAssisted) {
    parts.push("本文の作成に AI を利用し、内容は編集部が確認しています");
  }
  return `${parts.join("。")}。`;
}

export function createDisclosure(input: {
  id: DisclosureId;
  workspaceId: WorkspaceId;
  relationshipType: RelationshipType;
  advertiserOrSupplier?: string | null;
  editorialInfluence: EditorialInfluence;
  aiAssisted?: boolean;
  visibleMessage?: string;
}): Result<Disclosure, DomainError> {
  if (DISCLOSURE_REQUIRED.has(input.relationshipType) && input.editorialInfluence === "declared") {
    if (!input.advertiserOrSupplier) {
      return err(
        validationError(
          "広告主が内容確認を行う場合、提供元の名前が必要です。",
          "advertiserOrSupplier",
        ),
      );
    }
  }
  const aiAssisted = input.aiAssisted ?? false;
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    relationshipType: input.relationshipType,
    advertiserOrSupplier: input.advertiserOrSupplier ?? null,
    editorialInfluence: input.editorialInfluence,
    aiAssisted,
    visibleMessage:
      input.visibleMessage ??
      buildVisibleMessage({
        relationshipType: input.relationshipType,
        advertiserOrSupplier: input.advertiserOrSupplier ?? null,
        editorialInfluence: input.editorialInfluence,
        aiAssisted,
      }),
  });
}

/** 表示が必須の関係かどうか。 */
export function requiresDisclosure(relationshipType: RelationshipType): boolean {
  return DISCLOSURE_REQUIRED.has(relationshipType);
}

/**
 * リンクに付ける rel 属性を決める。
 *
 * 広告・有料掲載のリンクには rel="sponsored" を付ける (Google の案内)。
 * ここを 1 箇所に閉じることで、記事・比較表・AI回答・WebMCP応答で
 * 属性が食い違うことを防ぐ。
 */
export function relAttributeFor(relationshipType: RelationshipType): string {
  return DISCLOSURE_REQUIRED.has(relationshipType)
    ? "sponsored noopener"
    : "noopener";
}

/**
 * 表示が必要な場所 (プラットフォーム層 §20.2)。
 *
 * 実装側は、この一覧のすべてで disclosure を出しているかを検査する。
 */
export const DISCLOSURE_SURFACES = [
  "article_top", // 記事冒頭
  "sns_body", // SNS本文
  "near_cta", // CTA付近
  "product_card", // 商品カード
  "ai_answer", // AI回答
  "webmcp_response", // WebMCP応答
  "comparison_table", // 比較表
  "publication_preview", // 投稿プレビュー
] as const;
export type DisclosureSurface = (typeof DISCLOSURE_SURFACES)[number];
