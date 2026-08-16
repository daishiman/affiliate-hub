import { type Result, err, ok } from "./result";
import { type DomainError, validationError } from "./errors";

/**
 * 情報の由来 (プラットフォーム層 §10.5)。
 *
 * 重要情報にはすべてこれを付ける。「どこから来た情報か」を後から言えないと、
 * 訂正も更新もできない。ランキングの説明責任 (§20.3) もここに依存する。
 */
export type SourceType =
  | "api" // 公式の商品・アフィリエイトAPI
  | "manufacturer" // 広告主・メーカーの公式データ
  | "merchant" // 販売店
  | "structured_data" // Schema.org / JSON-LD / OpenGraph
  | "manual" // 手動入力
  | "test"; // 自社検証

export type Provenance = {
  readonly sourceType: SourceType;
  readonly sourceName: string;
  readonly sourceUrl: string | null;
  readonly retrievedAt: Date;
  readonly validUntil: Date | null;
  /** 0.0 - 1.0。低い値をそのまま公開してはならない判断は利用側で行う。 */
  readonly confidence: number;
  /** 利用条件。「商品画像は販売店リンク併記時のみ」等を文字で残す (§10.4)。 */
  readonly permittedUsage: string;
};

export function createProvenance(input: {
  sourceType: SourceType;
  sourceName: string;
  sourceUrl?: string | null;
  retrievedAt: Date;
  validUntil?: Date | null;
  confidence: number;
  permittedUsage: string;
}): Result<Provenance, DomainError> {
  if (input.sourceName.trim() === "") {
    return err(validationError("情報源の名前が空です。", "sourceName"));
  }
  if (input.confidence < 0 || input.confidence > 1) {
    return err(validationError("信頼度は 0.0〜1.0 で指定してください。", "confidence"));
  }
  if (input.validUntil && input.validUntil <= input.retrievedAt) {
    return err(validationError("有効期限が取得日時より前になっています。", "validUntil"));
  }
  return ok({
    sourceType: input.sourceType,
    sourceName: input.sourceName,
    sourceUrl: input.sourceUrl ?? null,
    retrievedAt: input.retrievedAt,
    validUntil: input.validUntil ?? null,
    confidence: input.confidence,
    permittedUsage: input.permittedUsage,
  });
}

/** 指定時刻で情報が期限切れかどうか。期限なしは切れない。 */
export function isExpired(p: Provenance, at: Date): boolean {
  return p.validUntil !== null && p.validUntil <= at;
}
