import type { ImprovementRepositoryPort } from "@/application/ports/improvement";
import {
  type ComparisonResult,
  type ImprovementSuggestion,
  type LoopRun,
  type LoopRunStatus,
  COMPARISON_VERDICT_LABELS,
  DEFAULT_MINIMUM_SAMPLES,
  LOOP_RUN_STATUS_LABELS,
  buildSuggestions,
  diffVariantSpecs,
  findLoopKind,
  findOptimizationDimension,
  judgeComparison,
  metricDefinition,
} from "@/domain/analytics";
import { requireCapability } from "@/domain/identity";
import { type ActorContext, type DomainError, type Result, ok } from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 実施中・判定済みのループを一覧にするユースケース。
 *
 * **軸ごとの分岐をここに書かない。** 入ってくるのは
 * 「設定の差」と「観測値」だけで、色の実験も構成の実験も同じ道を通る。
 * 軸を 1 つ足したときにこのファイルが変わるなら、
 * その時点で汎用のループではなくなっている。
 *
 * 判定できないもの（件数不足）を隠さずに出すのが要点。
 * 隠すと、実施中のまま忘れられた比較が溜まっていく。
 */
export type ReviewLoopRunsDeps = {
  readonly repository: ImprovementRepositoryPort;
};

export type ReviewLoopRunsInput = {
  readonly siteSlug?: string;
};

export type LoopRunRow = {
  readonly id: string;
  readonly loopKindLabel: string;
  readonly polarityLabel: string;
  readonly siteSlug: string;
  readonly status: LoopRunStatus;
  readonly statusLabel: string;
  /** 何を変えた比較か。軸の呼び名で出す。 */
  readonly changedLabels: readonly string[];
  readonly primaryMetricLabel: string;
  readonly result: ComparisonResult | null;
  readonly verdictLabel: string;
  readonly suggestions: readonly ImprovementSuggestion[];
  /** 判定できない理由。判定できているときは null。 */
  readonly blockedReason: string | null;
  /**
   * 観測値がもう書かれているか。
   *
   * 画面が「判定する」を出してよいかの判断に使う。
   * `blockedReason` では代用できない（観測値があっても件数不足で理由が付くため、
   * それを目印にすると「書いたのに判定できない」に見える）。
   */
  readonly hasObservation: boolean;
};

export type ReviewLoopRunsOutput = {
  readonly rows: readonly LoopRunRow[];
  readonly runningCount: number;
  readonly pendingCount: number;
  readonly caveats: readonly string[];
  readonly emptyReason: string | null;
};

export function createReviewLoopRunsUseCase(
  deps: ReviewLoopRunsDeps,
): UseCase<ReviewLoopRunsInput, ReviewLoopRunsOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: ReviewLoopRunsInput,
    ): Promise<Result<ReviewLoopRunsOutput, DomainError>> {
      const allowed = requireCapability(actor, "analytics.read", "改善ループの参照");
      if (!allowed.ok) return allowed;

      const queried = await deps.repository.listRuns(actor.workspaceId, {
        siteSlug: input.siteSlug,
      });
      const runs: readonly LoopRun[] = queried.ok ? queried.value : [];
      const specsQuery = await deps.repository.listVariantSpecs(actor.workspaceId, {
        siteSlug: input.siteSlug,
      });
      const specs = specsQuery.ok ? specsQuery.value : [];

      // 同時に見ている比較の数。見た数だけ判定を厳しくする（多重比較への対処）。
      const comparisonCount = Math.max(1, runs.filter((r) => r.status === "running").length);

      const rows: LoopRunRow[] = [];
      for (const run of runs) {
        const kind = findLoopKind(run.loopKindKey);
        const baseline = specs.find((s) => s.id === run.baselineSpecId);
        const candidate = specs.find((s) => s.id === run.candidateSpecId);
        const diffs =
          baseline && candidate
            ? diffVariantSpecs(baseline, candidate)
            : run.changedDimensions.map((key) => ({
                dimensionKey: key,
                label: findOptimizationDimension(key)?.label ?? key,
                baseline: null,
                candidate: null,
              }));

        const observed = await deps.repository.observationsOf(actor.workspaceId, run.id);
        const observation = observed.ok ? observed.value : null;

        let result: ComparisonResult | null = null;
        let blockedReason: string | null = null;
        if (observation === null) {
          blockedReason = observed.ok
            ? "まだ観測値がありません。実施してから判定します。"
            : `観測値をまだ読み出せません（${observed.error.message}）。`;
        } else {
          const judged = judgeComparison({
            metric: run.primaryMetric,
            baselineValue: observation.baselineValue,
            baselineSamples: observation.baselineSamples,
            candidateValue: observation.candidateValue,
            candidateSamples: observation.candidateSamples,
            minimumSamples: run.minimumSamples,
            comparisonCount,
          });
          if (judged.ok) {
            result = judged.value;
            if (judged.value.verdict === "pending") blockedReason = judged.value.reason;
          } else {
            blockedReason = judged.error.message;
          }
        }

        rows.push({
          id: run.id,
          loopKindLabel: kind?.label ?? run.loopKindKey,
          polarityLabel: kind === null ? "不明" : kind.polarity,
          siteSlug: run.siteSlug,
          status: run.status,
          statusLabel: LOOP_RUN_STATUS_LABELS[run.status],
          changedLabels: diffs.map((d) => d.label),
          primaryMetricLabel: metricDefinition(run.primaryMetric).label,
          result,
          verdictLabel:
            result === null
              ? COMPARISON_VERDICT_LABELS.pending
              : COMPARISON_VERDICT_LABELS[result.verdict],
          suggestions: result === null ? [] : buildSuggestions(diffs, [result]),
          blockedReason,
          hasObservation: observation !== null,
        });
      }

      const caveats = [
        "判定は統計的な検定ではありません。「この件数・この差では何も言わない」という保守側の目安です。",
        `同時に見ている比較の数だけ、必要な件数を増やしています（今回は ${comparisonCount} 件ぶん）。`,
        `既定では ${DEFAULT_MINIMUM_SAMPLES} 件に届くまで差があるとは言いません。`,
        "提案の適用には人の承認が要ります。見た目だけの変更でも同じです。",
      ];

      return ok({
        rows,
        runningCount: rows.filter((r) => r.status === "running").length,
        pendingCount: rows.filter((r) => r.blockedReason !== null).length,
        caveats,
        emptyReason:
          rows.length > 0
            ? null
            : queried.ok
              ? "まだ試している比較はありません。"
              : `改善ループの記録をまだ読み出せません（${queried.error.message}）。`,
      });
    },
  };
}
