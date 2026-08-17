import type { LoopRun, VariantSpec } from "@/domain/analytics";
import type { WorkspaceId } from "@/domain/shared";
import type { PortResult } from "./common";

/**
 * 改善ループの保存先とのつなぎ目。
 *
 * 見せ方の設定・1 周の記録・観測値の 3 つを同じ口で扱う。
 * 分けると、実施中の一覧を出すのに 3 つの保存先を順に読むことになり、
 * どれか 1 つが落ちたときの見え方がその都度違ってしまう。
 */
export type ImprovementRepositoryPort = {
  listVariantSpecs(
    workspaceId: WorkspaceId,
    input?: { readonly siteSlug?: string },
  ): PortResult<readonly VariantSpec[]>;

  saveVariantSpec(workspaceId: WorkspaceId, spec: VariantSpec): PortResult<true>;

  listRuns(
    workspaceId: WorkspaceId,
    input?: { readonly siteSlug?: string },
  ): PortResult<readonly LoopRun[]>;

  saveRun(workspaceId: WorkspaceId, run: LoopRun): PortResult<true>;

  /**
   * 1 周ぶんの観測値。
   *
   * **もとの設定と、試した設定の両方を返す。** 片方だけ返せる形にすると、
   * 「比べる相手がいないまま数字だけある」状態を作れてしまう。
   */
  observationsOf(
    workspaceId: WorkspaceId,
    runId: string,
  ): PortResult<LoopObservation | null>;
};

export type LoopObservation = {
  readonly runId: string;
  readonly baselineValue: number;
  readonly baselineSamples: number;
  readonly candidateValue: number;
  readonly candidateSamples: number;
};
