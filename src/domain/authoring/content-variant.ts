import {
  type AffiliateLinkId,
  type AudiencePersonaId,
  type AuthorPersonaId,
  type ClaimId,
  type ContentPackageId,
  type ContentVariantId,
  type DomainError,
  type EvidenceId,
  type Result,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";
import type { ContentAngle, CtaType } from "./content-package";

/**
 * 媒体別の文章 1 本。
 *
 * AI 出力契約 (§15.5 `generated_variant`) をそのまま型にしている。
 * LLM へ渡す出力スキーマ (infrastructure/llm) はこの型から導出する。
 * スキーマと型を別々に書くと、片方だけ直して静かに壊れる。
 */
export type ComplianceStatus = "pass" | "warning" | "fail";
export type ContentVariantStatus = "generated" | "review" | "approved" | "rejected" | "published";

export type ContentVariant = {
  readonly id: ContentVariantId;
  readonly workspaceId: WorkspaceId;
  readonly contentPackageId: ContentPackageId;
  readonly channel: string;
  readonly format: string;
  readonly authorPersonaId: AuthorPersonaId;
  readonly audiencePersonaId: AudiencePersonaId;
  readonly angle: ContentAngle;
  readonly title: string | null;
  readonly body: string;
  readonly summary: string;
  readonly cta: CtaType;
  readonly disclosure: string;
  readonly affiliateLinkIds: readonly AffiliateLinkId[];
  readonly claimIds: readonly ClaimId[];
  readonly evidenceIds: readonly EvidenceId[];
  /** AI が置いた仮定。読者へ「仮定」として表示する (§13.3 AI回答ルール)。 */
  readonly assumptions: readonly string[];
  readonly platformWarnings: readonly string[];
  readonly factualityScore: number;
  readonly personaFitScore: number;
  readonly channelFitScore: number;
  readonly complianceStatus: ComplianceStatus;
  /** どのプロンプト版・どのモデルで作ったか。再現と原因追跡に必須。 */
  readonly generationPromptVersion: string;
  readonly modelId: string;
  readonly status: ContentVariantStatus;
};

export function createContentVariant(input: {
  id: ContentVariantId;
  workspaceId: WorkspaceId;
  contentPackageId: ContentPackageId;
  channel: string;
  format: string;
  authorPersonaId: AuthorPersonaId;
  audiencePersonaId: AudiencePersonaId;
  angle: ContentAngle;
  title?: string | null;
  body: string;
  summary: string;
  cta: CtaType;
  disclosure: string;
  affiliateLinkIds?: readonly AffiliateLinkId[];
  claimIds?: readonly ClaimId[];
  evidenceIds?: readonly EvidenceId[];
  assumptions?: readonly string[];
  platformWarnings?: readonly string[];
  factualityScore: number;
  personaFitScore: number;
  channelFitScore: number;
  complianceStatus: ComplianceStatus;
  generationPromptVersion: string;
  modelId: string;
}): Result<ContentVariant, DomainError> {
  if (input.body.trim() === "") {
    return err(validationError("本文が空です。", "body"));
  }
  for (const [key, value] of [
    ["factualityScore", input.factualityScore],
    ["personaFitScore", input.personaFitScore],
    ["channelFitScore", input.channelFitScore],
  ] as const) {
    if (value < 0 || value > 1) {
      return err(validationError(`${key} は 0.0〜1.0 で指定してください。`, key));
    }
  }
  if (input.generationPromptVersion.trim() === "") {
    return err(
      validationError(
        "プロンプトのバージョンが空です。どの指示で作った文章か追えなくなります。",
        "generationPromptVersion",
      ),
    );
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    contentPackageId: input.contentPackageId,
    channel: input.channel,
    format: input.format,
    authorPersonaId: input.authorPersonaId,
    audiencePersonaId: input.audiencePersonaId,
    angle: input.angle,
    title: input.title ?? null,
    body: input.body,
    summary: input.summary,
    cta: input.cta,
    disclosure: input.disclosure,
    affiliateLinkIds: input.affiliateLinkIds ?? [],
    claimIds: input.claimIds ?? [],
    evidenceIds: input.evidenceIds ?? [],
    assumptions: input.assumptions ?? [],
    platformWarnings: input.platformWarnings ?? [],
    factualityScore: input.factualityScore,
    personaFitScore: input.personaFitScore,
    channelFitScore: input.channelFitScore,
    complianceStatus: input.complianceStatus,
    generationPromptVersion: input.generationPromptVersion,
    modelId: input.modelId,
    status: "generated",
  });
}

/** AI が単独で承認へ進めてはならない (§13.4)。承認は必ず人間の操作。 */
export function approveVariant(
  variant: ContentVariant,
  approvedByHuman: boolean,
): Result<ContentVariant, DomainError> {
  if (!approvedByHuman) {
    return err(
      validationError(
        "AI だけで承認することはできません。人が内容を確認してから承認してください。",
        "status",
      ),
    );
  }
  if (variant.complianceStatus === "fail") {
    return err(
      validationError(
        "自動チェックで不適合と判定された文章は承認できません。指摘を直してから再確認してください。",
        "complianceStatus",
      ),
    );
  }
  return ok({ ...variant, status: "approved" });
}
