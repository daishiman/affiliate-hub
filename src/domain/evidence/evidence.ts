import {
  type DomainError,
  type EvidenceId,
  type ProductId,
  type Result,
  type TestRunId,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";

/** 根拠の種類 (ブログ層 §12 Evidence)。 */
export type EvidenceType =
  | "official_source"
  | "test_result"
  | "photo"
  | "video"
  | "dataset"
  | "expert_review";

export type Evidence = {
  readonly id: EvidenceId;
  readonly workspaceId: WorkspaceId;
  readonly type: EvidenceType;
  readonly title: string;
  readonly sourceOwner: string;
  readonly capturedAt: Date;
  readonly urlOrAssetId: string;
  /** 引用は要約または短い抜粋にとどめる。全文保存は §10.4 で禁止。 */
  readonly excerptOrSummary: string;
  readonly licenseOrPermission: string;
  /** 改ざん検出用。保存時に計算する。 */
  readonly integrityHash: string;
};

/** 引用抜粋の上限。著作物の全文保存を防ぐための機械的な歯止め。 */
export const MAX_EXCERPT_LENGTH = 400;

export function createEvidence(input: {
  id: EvidenceId;
  workspaceId: WorkspaceId;
  type: EvidenceType;
  title: string;
  sourceOwner: string;
  capturedAt: Date;
  urlOrAssetId: string;
  excerptOrSummary: string;
  licenseOrPermission: string;
  integrityHash: string;
}): Result<Evidence, DomainError> {
  if (input.title.trim() === "") {
    return err(validationError("根拠の題名が空です。", "title"));
  }
  if (input.sourceOwner.trim() === "") {
    return err(validationError("根拠の出所 (誰の情報か) が空です。", "sourceOwner"));
  }
  if (input.licenseOrPermission.trim() === "") {
    return err(
      validationError(
        "利用条件が空です。転載可否が分からない素材は根拠に登録できません。",
        "licenseOrPermission",
      ),
    );
  }
  if (input.excerptOrSummary.length > MAX_EXCERPT_LENGTH) {
    return err(
      validationError(
        `抜粋が長すぎます (${input.excerptOrSummary.length}文字)。${MAX_EXCERPT_LENGTH}文字以内の要約にしてください。他サイトの本文を丸ごと保存しない決まりです。`,
        "excerptOrSummary",
      ),
    );
  }
  return ok({ ...input });
}

/**
 * 検証記録 (ブログ層 §12 TestRun)。
 *
 * 「実際に使ってみました」と書けるかどうかは、この記録の有無で決まる。
 * 書き手ペルソナの事実境界 (author-persona.ts) がここを参照する。
 */
export type TestRun = {
  readonly id: TestRunId;
  readonly workspaceId: WorkspaceId;
  readonly productId: ProductId;
  /** 測定方法のバージョン。方法を変えたら上げる。過去の点数と混ぜないため。 */
  readonly methodVersion: string;
  readonly environment: Readonly<Record<string, string>>;
  readonly equipment: readonly string[];
  readonly testerIds: readonly string[];
  readonly startedAt: Date;
  readonly completedAt: Date | null;
  readonly rawResults: Readonly<Record<string, number | string>>;
  /** 0.0〜1.0 に正規化した点数。Ranking の EditorialScoreCard の入力になる。 */
  readonly normalizedScores: Readonly<Record<string, number>>;
  readonly evidenceIds: readonly EvidenceId[];
};

export function createTestRun(input: {
  id: TestRunId;
  workspaceId: WorkspaceId;
  productId: ProductId;
  methodVersion: string;
  environment: Readonly<Record<string, string>>;
  equipment: readonly string[];
  testerIds: readonly string[];
  startedAt: Date;
  completedAt?: Date | null;
  rawResults: Readonly<Record<string, number | string>>;
  normalizedScores: Readonly<Record<string, number>>;
  evidenceIds: readonly EvidenceId[];
}): Result<TestRun, DomainError> {
  if (input.testerIds.length === 0) {
    return err(
      validationError("検証者が指定されていません。誰が測ったか示せない記録は使えません。", "testerIds"),
    );
  }
  if (input.methodVersion.trim() === "") {
    return err(validationError("測定方法のバージョンが空です。", "methodVersion"));
  }
  for (const [key, value] of Object.entries(input.normalizedScores)) {
    if (value < 0 || value > 1) {
      return err(validationError(`正規化点数「${key}」が 0.0〜1.0 の範囲外です。`, "normalizedScores"));
    }
  }
  if (input.completedAt && input.completedAt < input.startedAt) {
    return err(validationError("完了日時が開始日時より前になっています。", "completedAt"));
  }
  return ok({
    ...input,
    completedAt: input.completedAt ?? null,
  });
}
