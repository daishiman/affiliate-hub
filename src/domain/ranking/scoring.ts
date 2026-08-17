import {
  type DomainError,
  type ProductId,
  type Result,
  collect,
  err,
  ok,
  validationError,
} from "../shared";
import type { AllowedCriterionKey, RankingModel } from "./ranking-model";

/**
 * 商品 1 件ぶんの編集用評価。
 *
 * 値は 0.0〜1.0 に正規化済み。正規化の方法は TestRun の method_version が持つ。
 * ここに価格そのものは入らない。入るのは price_value (価格に対する価値) だけ。
 */
export type EditorialScoreCard = {
  readonly productId: ProductId;
  readonly scores: Readonly<Partial<Record<AllowedCriterionKey, number>>>;
  /** どの検証記録に基づく値か。根拠を示せない点数は使わない (§20.3)。 */
  readonly evidenceRefs: readonly string[];
  /** 最後に検証した日。読者へ表示する。 */
  readonly testedAt: Date | null;
};

export type CriterionBreakdown = {
  readonly key: AllowedCriterionKey;
  readonly weight: number;
  readonly rawScore: number;
  readonly weightedScore: number;
  readonly measurement: string;
  readonly passed: boolean;
};

export type RankedProduct = {
  readonly rank: number;
  readonly productId: ProductId;
  readonly totalScore: number;
  readonly breakdown: readonly CriterionBreakdown[];
  readonly evidenceRefs: readonly string[];
  readonly testedAt: Date | null;
};

export type ExcludedProduct = {
  readonly productId: ProductId;
  /** 読者へそのまま出せる除外理由。「なぜ選外か」を示すのは §9.1 の要件。 */
  readonly reason: string;
  readonly failedCriteria: readonly AllowedCriterionKey[];
};

export type RankingResult = {
  readonly modelVersion: string;
  readonly audience: string;
  readonly ranked: readonly RankedProduct[];
  readonly excluded: readonly ExcludedProduct[];
  /** 読者へ表示する評価基準の一覧 (§20.3「評価基準を表示」)。 */
  readonly criteriaDisclosure: readonly { key: string; weight: number; measurement: string }[];
};

/**
 * ランキングを計算する。純粋関数。
 *
 * 純粋関数にする理由は 3 つ。
 *   1. 同じ入力なら必ず同じ順位になる (仕様「ランキング再現性」テストの前提)。
 *   2. UI / AI アシスタント / WebMCP / backend MCP が同じ結果を返せる
 *      (ブログ層 §27「WebMCP内に独自のランキング式を実装」禁止)。
 *   3. 商業データを引数に取らないことが、シグネチャを見れば分かる。
 *
 * 引数に Commercial のデータ型が 1 つも現れないことが、この関数の設計の要点。
 */
export function rankProducts(
  model: RankingModel,
  cards: readonly EditorialScoreCard[],
): Result<RankingResult, DomainError> {
  const validated = collect(cards.map((c) => validateScoreCard(model, c)));
  if (!validated.ok) return validated;

  const ranked: RankedProduct[] = [];
  const excluded: ExcludedProduct[] = [];

  for (const card of validated.value) {
    const breakdown: CriterionBreakdown[] = model.criteria.map((c) => {
      const rawScore = card.scores[c.key] ?? 0;
      return {
        key: c.key,
        weight: c.weight,
        rawScore,
        weightedScore: rawScore * c.weight,
        measurement: c.measurement,
        passed: rawScore >= c.passThreshold,
      };
    });

    const failed = breakdown.filter((b) => !b.passed).map((b) => b.key);
    if (failed.length > 0) {
      excluded.push({
        productId: card.productId,
        reason: `合格ラインを下回った評価項目があるため選外にしました (${failed.join(" / ")})。`,
        failedCriteria: failed,
      });
      continue;
    }

    ranked.push({
      rank: 0, // 並べ替え後に確定する
      productId: card.productId,
      totalScore: breakdown.reduce((s, b) => s + b.weightedScore, 0),
      breakdown,
      evidenceRefs: card.evidenceRefs,
      testedAt: card.testedAt,
    });
  }

  // 同点は productId の昇順で決める。順位が実行のたびに入れ替わると
  // 「再現性」の検証ができず、読者から見ても不安定な順位になる。
  ranked.sort((a, b) =>
    b.totalScore !== a.totalScore
      ? b.totalScore - a.totalScore
      : a.productId < b.productId
        ? -1
        : a.productId > b.productId
          ? 1
          : 0,
  );

  return ok({
    modelVersion: model.version,
    audience: model.audience,
    ranked: ranked.map((r, i) => ({ ...r, rank: i + 1 })),
    excluded,
    criteriaDisclosure: model.criteria.map((c) => ({
      key: c.key,
      weight: c.weight,
      measurement: c.measurement,
    })),
  });
}

/**
 * 点数表がモデルの要求を満たすか検査する。
 *
 * 根拠が 1 つも無い点数を受け入れると、「根拠を表示する」約束 (§20.3) を
 * 実際には守れなくなる。ここで止める。
 */
function validateScoreCard(
  model: RankingModel,
  card: EditorialScoreCard,
): Result<EditorialScoreCard, DomainError> {
  for (const [key, value] of Object.entries(card.scores)) {
    if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 1) {
      return err(
        validationError(`商品 ${card.productId} の「${key}」の点数が 0.0〜1.0 の範囲外です。`),
      );
    }
    if (!model.criteria.some((c) => c.key === key)) {
      return err(
        validationError(
          `商品 ${card.productId} に、この評価方法で使わない項目「${key}」が含まれています。`,
        ),
      );
    }
  }
  if (card.evidenceRefs.length === 0) {
    return err(
      validationError(
        `商品 ${card.productId} の評価に根拠が付いていません。根拠のない点数は順位に使えません。`,
      ),
    );
  }
  return ok(card);
}

/**
 * 順位の理由を文章化する材料を返す (WebMCP `explain_ranking` / AI アシスタント共用)。
 *
 * 文章そのものは presentation 層で組み立てる。ここでは「何を説明できるか」を返す。
 */
export function explainRank(
  result: RankingResult,
  productId: ProductId,
): Result<
  {
    rank: number;
    totalScore: number;
    strongest: CriterionBreakdown | null;
    weakest: CriterionBreakdown | null;
    breakdown: readonly CriterionBreakdown[];
    modelVersion: string;
    evidenceRefs: readonly string[];
  },
  DomainError
> {
  const target = result.ranked.find((r) => r.productId === productId);
  if (!target) {
    const dropped = result.excluded.find((e) => e.productId === productId);
    return err(
      validationError(
        dropped
          ? `この商品は選外です。${dropped.reason}`
          : `この商品はこのランキングの対象に含まれていません。`,
      ),
    );
  }
  const sorted = [...target.breakdown].sort((a, b) => b.weightedScore - a.weightedScore);
  return ok({
    rank: target.rank,
    totalScore: target.totalScore,
    strongest: sorted[0] ?? null,
    weakest: sorted[sorted.length - 1] ?? null,
    breakdown: target.breakdown,
    modelVersion: result.modelVersion,
    evidenceRefs: target.evidenceRefs,
  });
}
