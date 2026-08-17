import { type DomainError, type Result, domainError, err, ok } from "../shared";
import { type MetricKey, metricDefinition } from "./metrics";
import { findOptimizationDimension } from "./optimization";
import type { VariantDiff } from "./variant-spec";

/**
 * Analytics コンテキスト / 比べ方と、次の一手の作り方。
 *
 * **ここは軸の中身を知らない。** 色を変えた比較でも、
 * 見出しの順番を変えた比較でも、入ってくるのは
 * 「設定の差」と「指標の差」だけ。だから軸が増えてもこのファイルは変わらない。
 *
 * --- 数字を良く見せるために判定を緩めない ---
 *
 * 小さなサイトでは、ほとんどの比較は「分からない」で終わる。
 * それが正しい。件数が足りないのに差があると言うと、
 * その判断が記事の作り方の基準として残り、後から覆せなくなる。
 *
 * ここでの判定は**検定ではない**。統計的な有意差を計算しているのではなく、
 * 「この件数・この差では何も言わない」という**保守側に倒した目安**である。
 * 検定でないことを隠すと、数字の強さを誤解させるので明示しておく。
 */

export const COMPARISON_VERDICTS = ["pending", "unclear", "improved", "worsened"] as const;
export type ComparisonVerdict = (typeof COMPARISON_VERDICTS)[number];

export const COMPARISON_VERDICT_LABELS: Readonly<Record<ComparisonVerdict, string>> = {
  pending: "判定保留",
  unclear: "効果不明",
  improved: "良くなった",
  worsened: "悪くなった",
};

/**
 * これ以上の差でなければ「動いた」と言わない割合。
 *
 * 5% に強い根拠は無い。**根拠が無いことを承知で下限を置く**方が、
 * 下限を置かずに目視で判断するより確実に効く。
 */
export const MINIMUM_DETECTABLE_EFFECT = 0.05;

/** これだけ集まるまで何も言わない件数の既定値。 */
export const DEFAULT_MINIMUM_SAMPLES = 200;

export type ComparisonInput = {
  readonly metric: MetricKey;
  readonly baselineValue: number;
  readonly baselineSamples: number;
  readonly candidateValue: number;
  readonly candidateSamples: number;
  /** これだけ集まるまで判定しない件数。 */
  readonly minimumSamples: number;
  /**
   * 同時に見ている比較の数。
   *
   * 20 個の比較をすれば、何も無くても 1 つくらいは差が出て見える。
   * 見た数だけ判定を厳しくする（多重比較への対処）。
   */
  readonly comparisonCount: number;
};

export type ComparisonResult = {
  readonly metric: MetricKey;
  readonly verdict: ComparisonVerdict;
  /** 相対差。分母が 0 のときは null。 */
  readonly relativeChange: number | null;
  /** 今回必要だった件数（多重比較の分だけ増やしたあとの値）。 */
  readonly requiredSamples: number;
  /** 今回必要だった差の大きさ。 */
  readonly requiredEffect: number;
  /** そう判定した理由。画面にそのまま出す。 */
  readonly reason: string;
};

export function judgeComparison(input: ComparisonInput): Result<ComparisonResult, DomainError> {
  if (input.minimumSamples < 1 || !Number.isInteger(input.minimumSamples)) {
    return err(
      domainError("VALIDATION_FAILED", "判定に必要な件数は 1 以上の整数で決めてください。"),
    );
  }
  if (input.comparisonCount < 1 || !Number.isInteger(input.comparisonCount)) {
    return err(domainError("VALIDATION_FAILED", "同時に見ている比較の数が不正です。"));
  }

  const def = metricDefinition(input.metric);
  // 多重比較の分だけ、必要な件数と必要な差を厳しくする。
  // 件数は比較の数に比例、差の大きさは平方根に比例（件数ほど急には上げない）。
  const requiredSamples = input.minimumSamples * input.comparisonCount;
  const requiredEffect = MINIMUM_DETECTABLE_EFFECT * Math.sqrt(input.comparisonCount);
  const lowest = Math.min(input.baselineSamples, input.candidateSamples);

  if (lowest < requiredSamples) {
    return ok({
      metric: input.metric,
      verdict: "pending",
      relativeChange: null,
      requiredSamples,
      requiredEffect,
      reason:
        input.comparisonCount === 1
          ? `まだ判定できません（少ない方で ${lowest} 件 / 必要 ${requiredSamples} 件）。`
          : `まだ判定できません（少ない方で ${lowest} 件 / 必要 ${requiredSamples} 件。${input.comparisonCount} 個を同時に見ているため必要件数を増やしています）。`,
    });
  }

  if (input.baselineValue === 0) {
    return ok({
      metric: input.metric,
      verdict: "unclear",
      relativeChange: null,
      requiredSamples,
      requiredEffect,
      reason: `比べるもとの${def.label}が 0 のため、増えた割合を出せません。`,
    });
  }

  const relativeChange = (input.candidateValue - input.baselineValue) / input.baselineValue;
  if (Math.abs(relativeChange) < requiredEffect) {
    return ok({
      metric: input.metric,
      verdict: "unclear",
      relativeChange,
      requiredSamples,
      requiredEffect,
      reason: `${def.label}の差は ${formatPercent(relativeChange)} で、判定に必要な ${formatPercent(
        requiredEffect,
      )} に届きません。差があるとは言えません。`,
    });
  }

  return ok({
    metric: input.metric,
    verdict: relativeChange > 0 ? "improved" : "worsened",
    relativeChange,
    requiredSamples,
    requiredEffect,
    reason: `${def.label}が ${formatPercent(relativeChange)} 動きました（${lowest} 件で判定）。`,
  });
}

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

/**
 * 次の一手。
 *
 * **軸の名前しか持たない。** 「色を明るくする」も「導入文を短くする」も
 * 同じ形で表す。ここに軸ごとの分岐を書き始めると、
 * 軸を足すたびにこのファイルが伸びる。
 */
export type ImprovementSuggestion = {
  readonly dimensionKey: string;
  readonly dimensionLabel: string;
  readonly from: string;
  readonly to: string;
  readonly verdict: ComparisonVerdict;
  readonly rationale: string;
  /** 適用には必ず人の承認が要る。**見た目だけの変更でも同じ。** */
  readonly requiresApproval: true;
};

/**
 * 比較の結果から次の一手を作る。
 *
 * 「良くなった」以外でも提案は作る。**作らないと、
 * 悪くなったことと、まだ分からないことが記録に残らない。**
 * 残らないと、同じ試みが半年後にもう一度行われる。
 */
export function buildSuggestions(
  diffs: readonly VariantDiff[],
  results: readonly ComparisonResult[],
): readonly ImprovementSuggestion[] {
  const decisive = results.find((r) => r.verdict === "improved" || r.verdict === "worsened");
  const primary = decisive ?? results[0];
  return diffs.map((d) => {
    const dimension = findOptimizationDimension(d.dimensionKey);
    const verdict: ComparisonVerdict = primary?.verdict ?? "pending";
    const keep = verdict === "improved";
    return {
      dimensionKey: d.dimensionKey,
      dimensionLabel: dimension?.label ?? d.dimensionKey,
      from: String(d.baseline ?? "（未設定）"),
      to: String(d.candidate ?? "（未設定）"),
      verdict,
      rationale: keep
        ? `${primary?.reason ?? ""} この設定を残すことを提案します。`
        : verdict === "worsened"
          ? `${primary?.reason ?? ""} もとの設定に戻すことを提案します。`
          : `${primary?.reason ?? "判定に必要な件数に届いていません。"} いまは変えないことを提案します。`,
      requiresApproval: true,
    };
  });
}
