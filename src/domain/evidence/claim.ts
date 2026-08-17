import {
  type ClaimId,
  type DomainError,
  type EvidenceId,
  type Result,
  type WorkspaceId,
  domainError,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * Evidence & Claim コンテキスト。
 *
 * 責務: 「何を言えるか」と「なぜそう言えるか」を分けて持つ。
 *
 * ここに書いてはいけないもの:
 *   - 文章表現 (Content Authoring の言葉)
 *   - 順位・重み (Ranking の言葉)
 *   - 価格や販売店 (Product Intelligence / Monetization の言葉)
 *
 * 2 つの仕様書が同じ概念を別名で書いているため、ここで 1 つに統一する。
 *   プラットフォーム層 §21.1: official | measured | experience | inference | commercial
 *   ブログ層 §12 Claim:      official | measured | experiential | inferred | external
 * 統合後の正本は下の ClaimType。対応表は docs/architecture/ubiquitous-language.md。
 */
export type ClaimType =
  | "official" // メーカー・販売店・公式資料
  | "measured" // 自社または利用者の測定結果
  | "experience" // 実際の利用者の感想
  | "inference" // 複数の根拠から導いた判断
  | "external" // 外部評価 (利用者レビュー等)
  | "commercial"; // 価格・販売先・アフィリエイト情報

export type VerificationStatus = "pending" | "verified" | "rejected" | "expired";

export type Claim = {
  readonly id: ClaimId;
  readonly workspaceId: WorkspaceId;
  readonly statement: string;
  readonly type: ClaimType;
  readonly evidenceIds: readonly EvidenceId[];
  /** 0.0 - 1.0 */
  readonly confidence: number;
  readonly verificationStatus: VerificationStatus;
  readonly validFrom: Date;
  readonly validUntil: Date | null;
  readonly verifiedBy: string | null;
};

/**
 * 根拠を必ず要求する主張の種類。
 *
 * official / measured / experience / external は「事実」を名乗るため根拠が要る。
 * inference は根拠から導く判断なので、導出元となる主張が別途必要 (下の checkInference)。
 * commercial は価格や販売先で、由来 (Provenance) が根拠の役割を果たす。
 */
const EVIDENCE_REQUIRED_TYPES: ReadonlySet<ClaimType> = new Set<ClaimType>([
  "official",
  "measured",
  "experience",
  "external",
]);

export function createClaim(input: {
  id: ClaimId;
  workspaceId: WorkspaceId;
  statement: string;
  type: ClaimType;
  evidenceIds: readonly EvidenceId[];
  confidence: number;
  validFrom: Date;
  validUntil?: Date | null;
  verifiedBy?: string | null;
}): Result<Claim, DomainError> {
  if (input.statement.trim() === "") {
    return err(validationError("主張の文が空です。", "statement"));
  }
  if (input.confidence < 0 || input.confidence > 1) {
    return err(validationError("確信度は 0.0〜1.0 で指定してください。", "confidence"));
  }
  if (EVIDENCE_REQUIRED_TYPES.has(input.type) && input.evidenceIds.length === 0) {
    return err(
      domainError("EVIDENCE_REQUIRED", `「${input.type}」の主張には根拠が 1 つ以上必要です。`, {
        field: "evidenceIds",
        suggestedAction: "公式資料・検証記録・引用元のいずれかを登録してください。",
      }),
    );
  }
  if (input.validUntil && input.validUntil <= input.validFrom) {
    return err(validationError("有効期限が開始日時より前になっています。", "validUntil"));
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    statement: input.statement,
    type: input.type,
    evidenceIds: input.evidenceIds,
    confidence: input.confidence,
    verificationStatus: "pending",
    validFrom: input.validFrom,
    validUntil: input.validUntil ?? null,
    verifiedBy: input.verifiedBy ?? null,
  });
}

/** 指定時刻で主張が有効か。期限切れは公開・AI回答の両方で使えない。 */
export function isClaimUsable(claim: Claim, at: Date): boolean {
  if (claim.verificationStatus !== "verified") return false;
  if (claim.validFrom > at) return false;
  if (claim.validUntil !== null && claim.validUntil <= at) return false;
  return true;
}

/** 期限を過ぎた主張の状態を expired へ移す。定期実行から呼ぶ。 */
export function expireIfDue(claim: Claim, at: Date): Claim {
  if (claim.validUntil !== null && claim.validUntil <= at && claim.verificationStatus !== "expired") {
    return { ...claim, verificationStatus: "expired" };
  }
  return claim;
}

export function verifyClaim(claim: Claim, verifiedBy: string): Result<Claim, DomainError> {
  if (verifiedBy.trim() === "") {
    return err(validationError("確認者が指定されていません。", "verifiedBy"));
  }
  if (claim.verificationStatus === "rejected") {
    return err(
      domainError("CONFLICT", "却下済みの主張は確認済みにできません。作り直してください。"),
    );
  }
  return ok({ ...claim, verificationStatus: "verified", verifiedBy });
}
