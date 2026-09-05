import type { ImprovementRepositoryPort } from "@/application/ports/improvement";
import { LOOP_DECISION_BASIS_LABELS, LOOP_KINDS, LOOP_POLARITY_LABELS, type LoopKind } from "@/domain/analytics/loop-kinds";
import { NON_OPTIMIZABLE, OPTIMIZATION_DIMENSIONS, OPTIMIZATION_GROUPS, OPTIMIZATION_GROUP_LABELS, type OptimizationDimension, type OptimizationGroup } from "@/domain/analytics/optimization";
import { MAX_SIMULTANEOUS_DIMENSIONS, explainVariantSpec } from "@/domain/analytics/variant-spec";
import { metricDefinition } from "@/domain/analytics/metrics";
import { requireCapability } from "@/domain/identity";
import { type ActorContext, type DomainError, type Result, ok } from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 「何を変えて試せるか」と「いま何を試しているか」を 1 画面にまとめる。
 *
 * 一覧は domain の登録表から作る。**画面に書き起こさない。**
 * 書き起こすと、軸を 1 つ足したときに画面だけ古いまま残り、
 * 「登録したのに選べない」が起きる。
 *
 * 調整してはいけないものの一覧も同じ画面に出す。
 * 別のページに分けると、軸を足す人がそれを読まずに足す。
 */
export type ListImprovementDimensionsDeps = {
  readonly repository: ImprovementRepositoryPort;
};

export type ListImprovementDimensionsInput = {
  readonly siteSlug?: string;
};

export type DimensionRow = OptimizationDimension & {
  readonly groupLabel: string;
  readonly candidateSourceLabel: string;
  readonly metricLabels: readonly string[];
  /** その軸を変えて試している数（実施中）。 */
  readonly runningCount: number;
  /** その軸で判定まで終わった数。 */
  readonly concludedCount: number;
  /** まだ一度も試していない軸は、そのことを画面に出す。 */
  readonly neverTried: boolean;
};

export type LoopKindRow = {
  readonly key: string;
  readonly label: string;
  readonly polarityLabel: string;
  /** 何をもって決めるか。件数で決めるのか 1 件で決めるのかを画面に出す。 */
  readonly decisionBasisLabel: string;
  readonly readinessLabel: string;
  readonly implemented: boolean;
  readonly signal: string;
  readonly decisionRule: string;
  readonly approver: string;
  readonly stopConditions: readonly string[];
  readonly hardGuardrails: readonly string[];
  readonly softGuardrails: readonly string[];
  readonly blockedBy: string | null;
};

export type VariantSpecRow = {
  readonly id: string;
  readonly label: string;
  readonly explanation: string;
  readonly approved: boolean;
};

export type ListImprovementDimensionsOutput = {
  readonly groups: readonly {
    readonly group: OptimizationGroup;
    readonly label: string;
    readonly dimensions: readonly DimensionRow[];
  }[];
  readonly loops: readonly LoopKindRow[];
  readonly nonOptimizable: readonly { readonly label: string; readonly reason: string }[];
  readonly maxSimultaneous: number;
  readonly specs: readonly VariantSpecRow[];
  readonly specsEmptyReason: string | null;
};

const CANDIDATE_SOURCE_LABELS: Readonly<Record<OptimizationDimension["candidateSource"], string>> = {
  preset: "決まった選択肢から選ぶ",
  numeric: "数値で決める",
  llm: "AI に案を作らせる（承認あり）",
};

function toLoopRow(kind: LoopKind): LoopKindRow {
  return {
    key: kind.key,
    label: kind.label,
    polarityLabel: LOOP_POLARITY_LABELS[kind.polarity],
    decisionBasisLabel: LOOP_DECISION_BASIS_LABELS[kind.decisionBasis],
    readinessLabel: kind.readiness === "implemented" ? "動いています" : "まだ動きません",
    implemented: kind.readiness === "implemented",
    signal: kind.signal,
    decisionRule: kind.decisionRule,
    approver: kind.approver,
    stopConditions: kind.stopConditions,
    hardGuardrails: kind.guardrails.filter((g) => g.hard).map((g) => g.label),
    softGuardrails: kind.guardrails.filter((g) => !g.hard).map((g) => g.label),
    blockedBy: kind.blockedBy,
  };
}

export function createListImprovementDimensionsUseCase(
  deps: ListImprovementDimensionsDeps,
): UseCase<ListImprovementDimensionsInput, ListImprovementDimensionsOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: ListImprovementDimensionsInput,
    ): Promise<Result<ListImprovementDimensionsOutput, DomainError>> {
      const allowed = requireCapability(actor, "analytics.read", "改善の軸の参照");
      if (!allowed.ok) return allowed;

      const runsQuery = await deps.repository.listRuns(actor.workspaceId, {
        siteSlug: input.siteSlug,
      });
      const runs = runsQuery.ok ? runsQuery.value : [];

      const groups = OPTIMIZATION_GROUPS.map((group) => ({
        group,
        label: OPTIMIZATION_GROUP_LABELS[group],
        dimensions: OPTIMIZATION_DIMENSIONS.filter((d) => d.group === group).map(
          (d): DimensionRow => {
            const touching = runs.filter((r) => r.changedDimensions.includes(d.key));
            return {
              ...d,
              groupLabel: OPTIMIZATION_GROUP_LABELS[group],
              candidateSourceLabel: CANDIDATE_SOURCE_LABELS[d.candidateSource],
              metricLabels: d.evaluatedBy.map((m) => metricDefinition(m).label),
              runningCount: touching.filter((r) => r.status === "running").length,
              concludedCount: touching.filter((r) => r.status === "concluded").length,
              neverTried: touching.length === 0,
            };
          },
        ),
      }));

      const specsQuery = await deps.repository.listVariantSpecs(actor.workspaceId, {
        siteSlug: input.siteSlug,
      });
      const specs = specsQuery.ok ? specsQuery.value : [];

      return ok({
        groups,
        loops: LOOP_KINDS.map(toLoopRow),
        nonOptimizable: NON_OPTIMIZABLE.map((n) => ({ label: n.label, reason: n.reason })),
        maxSimultaneous: MAX_SIMULTANEOUS_DIMENSIONS,
        specs: specs.map((s) => ({
          id: s.id,
          label: s.label,
          explanation: explainVariantSpec(s),
          approved: s.approvedBy !== null,
        })),
        specsEmptyReason:
          specs.length > 0
            ? null
            : specsQuery.ok
              ? "まだ登録された見せ方の設定がありません。"
              : `見せ方の設定をまだ読み出せません（${specsQuery.error.message}）。`,
      });
    },
  };
}
