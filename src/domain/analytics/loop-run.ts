import {
  type DomainError,
  type ExperimentId,
  type Result,
  type WorkspaceId,
  domainError,
  err,
  ok,
  validationError,
} from "../shared";
import type { ComparisonResult, ComparisonVerdict } from "./improvement";
import { findLoopKind } from "./loop-kinds";
import { METRIC_DEFINITIONS, type MetricKey } from "./metrics";
import type { VariantDiff } from "./variant-spec";
import { MAX_SIMULTANEOUS_DIMENSIONS } from "./variant-spec";

/**
 * Analytics コンテキスト / ループを 1 周まわした記録。
 *
 * `experiment.ts` の Experiment は「A と B を比べる」ことそのものを表す。
 * こちらは**それがどのループの、どの設定の比較だったか**を持つ。
 * 分けている理由は、ループの種類が増えても Experiment を触らずに済ませるため。
 *
 * 1 周は必ず次の順で進む。**途中を飛ばせない。**
 *   準備中 → 実施中 → 判定済み（または 打ち切り）
 *
 * 判定済みにするには、件数が足りていることが要る。
 * 足りていないうちに終わらせようとすると「判定保留」で止まる。
 */
export const LOOP_RUN_STATUSES = ["draft", "running", "concluded", "stopped"] as const;
export type LoopRunStatus = (typeof LOOP_RUN_STATUSES)[number];

export const LOOP_RUN_STATUS_LABELS: Readonly<Record<LoopRunStatus, string>> = {
  draft: "準備中",
  running: "実施中",
  concluded: "判定済み",
  stopped: "打ち切り",
};

export type LoopRun = {
  readonly id: ExperimentId;
  readonly workspaceId: WorkspaceId;
  readonly loopKindKey: string;
  readonly siteSlug: string;
  /** 比べているもの。どちらも承認済みの設定であること。 */
  readonly baselineSpecId: string;
  readonly candidateSpecId: string;
  /** 何を変えた比較か。ここが 1〜2 件であることは作るときに確かめる。 */
  readonly changedDimensions: readonly string[];
  /** 判断に使う指標。1 つだけ。始める前に決める。 */
  readonly primaryMetric: MetricKey;
  readonly minimumSamples: number;
  readonly status: LoopRunStatus;
  readonly startedAt: Date | null;
  readonly concludedAt: Date | null;
  readonly verdict: ComparisonVerdict | null;
  /** 打ち切ったときの理由。空にできない。 */
  readonly stoppedReason: string | null;
};

export function createLoopRun(input: {
  id: ExperimentId;
  workspaceId: WorkspaceId;
  loopKindKey: string;
  siteSlug: string;
  baselineSpecId: string;
  candidateSpecId: string;
  diffs: readonly VariantDiff[];
  primaryMetric: MetricKey;
  minimumSamples: number;
}): Result<LoopRun, DomainError> {
  const kind = findLoopKind(input.loopKindKey);
  if (kind === null) {
    return err(
      domainError("VALIDATION_FAILED", `登録されていないループです: ${input.loopKindKey}`, {
        suggestedAction: "ループの種類は domain/analytics/loop-kinds.ts が正本です。",
      }),
    );
  }
  if (kind.decisionBasis !== "comparison") {
    // 1 件ずつ扱うループ（改善要望など）を A/B と件数の仕組みへ入れない。
    // 入れられると「要望 3 件では足りない」のような、成り立たない判断が生まれる。
    return err(
      domainError("INVARIANT_VIOLATED", `${kind.label} は比べて決めるループではありません。`, {
        suggestedAction:
          "このループは 1 件ずつ扱います。件数がそろうのを待つ仕組みには乗せられません。",
      }),
    );
  }
  if (kind.readiness !== "implemented") {
    return err(
      domainError("NOT_IMPLEMENTED", `${kind.label} はまだ動かせません。`, {
        suggestedAction: kind.blockedBy ?? undefined,
      }),
    );
  }
  if (input.baselineSpecId === input.candidateSpecId) {
    return err(validationError("同じ設定どうしは比べられません。", "candidateSpecId"));
  }
  if (input.diffs.length === 0) {
    return err(validationError("2 つの設定に違いがありません。", "diffs"));
  }
  if (input.diffs.length > MAX_SIMULTANEOUS_DIMENSIONS) {
    return err(
      domainError(
        "INVARIANT_VIOLATED",
        `一度に変えている軸が多すぎます（${input.diffs.length} 個 / 上限 ${MAX_SIMULTANEOUS_DIMENSIONS} 個）。`,
      ),
    );
  }
  if (!METRIC_DEFINITIONS.some((d) => d.key === input.primaryMetric)) {
    return err(validationError("その指標は定義されていません。", "primaryMetric"));
  }
  if (!Number.isInteger(input.minimumSamples) || input.minimumSamples < 1) {
    return err(validationError("判定に必要な件数を 1 以上の整数で決めてください。", "minimumSamples"));
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    loopKindKey: input.loopKindKey,
    siteSlug: input.siteSlug,
    baselineSpecId: input.baselineSpecId,
    candidateSpecId: input.candidateSpecId,
    changedDimensions: input.diffs.map((d) => d.dimensionKey),
    primaryMetric: input.primaryMetric,
    minimumSamples: input.minimumSamples,
    status: "draft",
    startedAt: null,
    concludedAt: null,
    verdict: null,
    stoppedReason: null,
  });
}

export function startLoopRun(run: LoopRun, at: Date): Result<LoopRun, DomainError> {
  if (run.status !== "draft") {
    return err(validationError("準備中のものだけ始められます。", "status"));
  }
  return ok({ ...run, status: "running", startedAt: at });
}

/**
 * 判定する。
 *
 * **件数が足りないうちは終わらせない。** ここを緩めると、
 * 少ない件数で出た差が「決まったこと」として記事の作り方に残る。
 */
export function concludeLoopRun(
  run: LoopRun,
  input: { result: ComparisonResult; at: Date },
): Result<LoopRun, DomainError> {
  if (run.status !== "running") {
    return err(validationError("実施中のものだけ判定できます。", "status"));
  }
  if (input.result.metric !== run.primaryMetric) {
    return err(
      validationError(
        "始める前に決めた指標以外では判定できません。後から指標を選び直すと、必ず都合のよい方が選ばれます。",
        "metric",
      ),
    );
  }
  if (input.result.verdict === "pending") {
    return err(
      domainError("INVARIANT_VIOLATED", input.result.reason, {
        suggestedAction: "件数が足りるまで実施中のままにしてください。途中で終わらせても判断はできません。",
      }),
    );
  }
  return ok({
    ...run,
    status: "concluded",
    concludedAt: input.at,
    verdict: input.result.verdict,
  });
}

/** 途中でやめる。理由を残す（「なんとなくやめた」を残さない）。 */
export function stopLoopRun(
  run: LoopRun,
  input: { reason: string; at: Date },
): Result<LoopRun, DomainError> {
  if (run.status === "concluded" || run.status === "stopped") {
    return err(validationError("すでに終わっています。", "status"));
  }
  if (input.reason.trim() === "") {
    return err(validationError("打ち切る理由が必要です。", "reason"));
  }
  return ok({
    ...run,
    status: "stopped",
    concludedAt: input.at,
    stoppedReason: input.reason.trim(),
  });
}
