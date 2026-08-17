import {
  type ComparisonSetId,
  type DomainError,
  type ProductId,
  type Result,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * 比較候補の抽出 (プラットフォーム層 §12.2 / §12.3)。
 *
 * 比較候補スコアに報酬・広告主依頼・販売実績を入れてはならない (§12.3)。
 * Ranking と同じく、この関数のシグネチャに商業データが現れないことで守る。
 */
export type ComparisonRelation =
  | "exact_offer" // 同一商品の別販売店
  | "variant" // 容量・色・世代違いの同一系列
  | "direct_competitor" // 同カテゴリー・同用途・同価格帯の競合
  | "alternative_solution"; // カテゴリーは違うが同じ目的を満たす代替

/** 比較スコアの構成要素 (§12.3)。すべて編集判断のデータ。 */
export type ComparisonSignals = {
  /** 商品同一性 0.0-1.0 */
  readonly identity: number;
  /** カテゴリー一致 0.0-1.0 */
  readonly category: number;
  /** 利用目的一致 0.0-1.0 */
  readonly useCase: number;
  /** 価格帯の近さ 0.0-1.0 (価格そのものではなく「帯の近さ」) */
  readonly priceBand: number;
  /** 主要仕様の一致 0.0-1.0 */
  readonly keySpecs: number;
  /** 対象利用者の一致 0.0-1.0 */
  readonly audience: number;
  /** 発売時期の近さ 0.0-1.0 */
  readonly recency: number;
};

/**
 * 各要素の重み。合計 1.0。
 *
 * 同一性を最も重くする。「同じ商品を別の店で」が比較として最も確実であり、
 * 読者にとっても外れが少ないため。
 */
export const COMPARISON_WEIGHTS: Readonly<Record<keyof ComparisonSignals, number>> = {
  identity: 0.3,
  category: 0.15,
  useCase: 0.2,
  priceBand: 0.1,
  keySpecs: 0.15,
  audience: 0.05,
  recency: 0.05,
};

export type ComparisonCandidate = {
  readonly productId: ProductId;
  readonly relation: ComparisonRelation;
  readonly score: number;
  readonly signals: ComparisonSignals;
  /** 読者と編集者へそのまま出せる説明 (§12.4「比較候補になった理由」)。 */
  readonly reason: string;
  readonly commonPoints: readonly string[];
  readonly decisiveDifferences: readonly string[];
  /** 情報の信頼度 0.0-1.0 */
  readonly informationConfidence: number;
  /** まだ埋まっていない項目。空欄のまま比較表に出さないため。 */
  readonly missingInformation: readonly string[];
  readonly lastVerifiedBy: string | null;
};

export function scoreComparison(signals: ComparisonSignals): Result<number, DomainError> {
  for (const [key, value] of Object.entries(signals)) {
    if (value < 0 || value > 1) {
      return err(validationError(`比較要素「${key}」が 0.0〜1.0 の範囲外です。`, key));
    }
  }
  const total = (Object.keys(COMPARISON_WEIGHTS) as (keyof ComparisonSignals)[]).reduce(
    (sum, key) => sum + signals[key] * COMPARISON_WEIGHTS[key],
    0,
  );
  return ok(total);
}

/**
 * 信号から関係を分類する。
 *
 * 分類を先に決めてスコアを後付けすると、同一商品なのに競合として並ぶ事故が起きる。
 * 同一性が高ければ、他の要素に関係なく exact_offer / variant に落とす。
 */
export function classifyRelation(signals: ComparisonSignals): ComparisonRelation {
  if (signals.identity >= 0.95) return "exact_offer";
  if (signals.identity >= 0.6) return "variant";
  if (signals.category >= 0.8 && signals.useCase >= 0.6) return "direct_competitor";
  return "alternative_solution";
}

export type ComparisonSet = {
  readonly id: ComparisonSetId;
  readonly workspaceId: WorkspaceId;
  readonly primaryProductId: ProductId;
  readonly candidates: readonly ComparisonCandidate[];
  readonly createdAt: Date;
  /** 何を比べたか。比較記事の「比較対象範囲」表示に使う (§20.3)。 */
  readonly scopeDescription: string;
};

/** 比較表に並べる上限。多すぎる比較表は読者が判断できない。 */
export const MAX_COMPARISON_CANDIDATES = 8;

export function createComparisonSet(input: {
  id: ComparisonSetId;
  workspaceId: WorkspaceId;
  primaryProductId: ProductId;
  candidates: readonly ComparisonCandidate[];
  createdAt: Date;
  scopeDescription: string;
}): Result<ComparisonSet, DomainError> {
  if (input.scopeDescription.trim() === "") {
    return err(
      validationError(
        "比較対象の範囲説明が空です。何と何を比べたか示さない比較表は出せません。",
        "scopeDescription",
      ),
    );
  }
  if (input.candidates.some((c) => c.productId === input.primaryProductId)) {
    return err(validationError("比較候補に主商品そのものが含まれています。", "candidates"));
  }
  const sorted = [...input.candidates].sort((a, b) => b.score - a.score);
  if (sorted.length > MAX_COMPARISON_CANDIDATES) {
    return err(
      validationError(
        `比較候補が多すぎます (${sorted.length}件)。${MAX_COMPARISON_CANDIDATES}件以内に絞ってください。`,
        "candidates",
      ),
    );
  }
  return ok({ ...input, candidates: sorted });
}
