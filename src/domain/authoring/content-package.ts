import {
  type AudiencePersonaId,
  type AuthorPersonaId,
  type CampaignId,
  type ClaimId,
  type ComparisonSetId,
  type ContentPackageId,
  type ContentVariantId,
  type DomainError,
  type EvidenceId,
  type MasterBriefId,
  type ProductId,
  type Result,
  type WorkspaceId,
  domainError,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * Content Package (プラットフォーム層 §7.3)。
 *
 * 「1 つの情報から複数の成果物を作る」の中核。
 * 商品 × 根拠 × 書き手 × 読者 × 媒体 × 切り口 × 購買段階 × CTA が
 * 1 つの媒体別文章 (ContentVariant) を決める。
 * Package は左側 (媒体より前) をまとめて持ち、Variant が右側を持つ。
 */
export type FunnelStage = "awareness" | "consideration" | "decision" | "retention";

/** 切り口 (§15.3)。 */
export const CONTENT_ANGLES = [
  "conclusion_first", // 結論先出し
  "problem_first", // 悩み起点
  "experience_first", // 体験起点
  "data_first", // データ起点
  "comparison_first", // 比較起点
  "beginner", // 初心者向け
  "expert", // 専門家向け
  "budget", // 予算重視
  "drawback", // デメリット重視
  "surprise", // 意外性
  "story", // ストーリー
  "seasonal", // 季節
  "use_case", // 用途
  "faq", // FAQ
  "paradox", // 逆説
  "checklist", // チェックリスト
] as const;
export type ContentAngle = (typeof CONTENT_ANGLES)[number];

/** 文章の長さ (§15.3)。 */
export const CONTENT_LENGTHS = [
  "one_sentence",
  "short",
  "standard",
  "long",
  "thread",
  "article",
  "script",
] as const;
export type ContentLength = (typeof CONTENT_LENGTHS)[number];

/** CTA (§15.3)。 */
export const CTA_TYPES = [
  "read_detail",
  "view_comparison",
  "check_official",
  "check_price_at_merchant",
  "save",
  "comment",
  "follow",
  "email_signup",
  "free_diagnosis",
  "request_material",
] as const;
export type CtaType = (typeof CTA_TYPES)[number];

export type ContentPackageStatus =
  | "researching"
  | "ready"
  | "generating"
  | "review"
  | "approved"
  | "published"
  | "refresh_due";

export type ContentPackage = {
  readonly id: ContentPackageId;
  readonly workspaceId: WorkspaceId;
  readonly brandId: string;
  readonly campaignId: CampaignId | null;
  readonly primarySubjectId: ProductId;
  readonly comparisonSetId: ComparisonSetId | null;
  readonly claimIds: readonly ClaimId[];
  readonly evidenceIds: readonly EvidenceId[];
  readonly authorPersonaId: AuthorPersonaId;
  readonly audiencePersonaIds: readonly AudiencePersonaId[];
  readonly objective: string;
  readonly funnelStage: FunnelStage;
  readonly contentAngles: readonly ContentAngle[];
  readonly masterBriefId: MasterBriefId | null;
  readonly variantIds: readonly ContentVariantId[];
  readonly status: ContentPackageStatus;
};

export function createContentPackage(input: {
  id: ContentPackageId;
  workspaceId: WorkspaceId;
  brandId: string;
  campaignId?: CampaignId | null;
  primarySubjectId: ProductId;
  comparisonSetId?: ComparisonSetId | null;
  claimIds: readonly ClaimId[];
  evidenceIds: readonly EvidenceId[];
  authorPersonaId: AuthorPersonaId;
  audiencePersonaIds: readonly AudiencePersonaId[];
  objective: string;
  funnelStage: FunnelStage;
  contentAngles: readonly ContentAngle[];
}): Result<ContentPackage, DomainError> {
  if (input.objective.trim() === "") {
    return err(validationError("この企画で達成したいことが空です。", "objective"));
  }
  if (input.audiencePersonaIds.length === 0) {
    return err(validationError("読者ペルソナが選ばれていません。", "audiencePersonaIds"));
  }
  if (input.contentAngles.length === 0) {
    return err(validationError("切り口が選ばれていません。", "contentAngles"));
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    campaignId: input.campaignId ?? null,
    primarySubjectId: input.primarySubjectId,
    comparisonSetId: input.comparisonSetId ?? null,
    claimIds: input.claimIds,
    evidenceIds: input.evidenceIds,
    authorPersonaId: input.authorPersonaId,
    audiencePersonaIds: input.audiencePersonaIds,
    objective: input.objective,
    funnelStage: input.funnelStage,
    contentAngles: input.contentAngles,
    masterBriefId: null,
    variantIds: [],
    status: "researching",
  });
}

/**
 * 生成に進んでよいか (§15.1 生成前の必須入力)。
 *
 * 「主題・承認済み商品情報・承認済み主張・根拠・書き手・読者・媒体・目的・
 *  購買段階・切り口・長さ・CTA・アフィリエイト表示・禁止表現」が揃っていること。
 * Package の段階で揃うのは媒体より前まで。媒体以降は生成要求で揃える。
 */
export function canStartGeneration(pkg: ContentPackage): Result<true, DomainError> {
  const missing: string[] = [];
  if (pkg.claimIds.length === 0) missing.push("承認済みの主張");
  if (pkg.evidenceIds.length === 0) missing.push("根拠");
  if (pkg.audiencePersonaIds.length === 0) missing.push("読者ペルソナ");
  if (pkg.contentAngles.length === 0) missing.push("切り口");
  if (missing.length > 0) {
    return err(
      domainError("EVIDENCE_REQUIRED", `生成に必要な入力が足りません: ${missing.join(" / ")}`, {
        suggestedAction: "不足している項目を登録してから生成してください。",
      }),
    );
  }
  return ok(true);
}

/**
 * 生成マトリクスの候補を作る (§15.4)。
 *
 * 読者 × 書き手 × 媒体 × 切り口 の全組み合わせは容易に 100 を超えるため、
 * 「目的が重複しない代表パターン」を選び、利用者が指定した上限で切る。
 *
 * 代表の選び方: 読者を最優先で分散させ、次に切り口、最後に媒体。
 * 同じ読者に別の切り口で当てるより、別の読者へ届くほうが価値が高いため。
 */
export type MatrixCell = {
  readonly audiencePersonaId: AudiencePersonaId;
  readonly channel: string;
  readonly angle: ContentAngle;
};

export function selectRepresentativeCells(
  pkg: ContentPackage,
  channels: readonly string[],
  limit: number,
): Result<readonly MatrixCell[], DomainError> {
  if (limit <= 0) {
    return err(validationError("生成数の上限は 1 以上で指定してください。", "limit"));
  }
  if (channels.length === 0) {
    return err(validationError("媒体が 1 つも選ばれていません。", "channels"));
  }

  const cells: MatrixCell[] = [];
  const audiences = pkg.audiencePersonaIds;
  const angles = pkg.contentAngles;

  // ラウンドロビンで読者→切り口→媒体の順に回す。先頭に偏らせない。
  const total = audiences.length * angles.length * channels.length;
  for (let i = 0; i < Math.min(limit, total); i += 1) {
    cells.push({
      audiencePersonaId: audiences[i % audiences.length],
      angle: angles[Math.floor(i / audiences.length) % angles.length],
      channel: channels[Math.floor(i / (audiences.length * angles.length)) % channels.length],
    });
  }
  return ok(cells);
}
