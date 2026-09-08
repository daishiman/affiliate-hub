import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { ImprovementRepositoryPort } from "@/application/ports/improvement";
import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type { AuditAction } from "@/domain/compliance";
import { concludeLoopRun, createLoopRun, startLoopRun, stopLoopRun, type LoopRun } from "@/domain/analytics/loop-run";
import { METRIC_DEFINITIONS, metricDefinition, type MetricKey } from "@/domain/analytics/metrics";
import { approveVariantSpec, assertComparable, createVariantSpec, type VariantSetting, type VariantSpec, type VariantValue } from "@/domain/analytics/variant-spec";
import { DEFAULT_MINIMUM_SAMPLES, judgeComparison } from "@/domain/analytics/improvement";
import { findOptimizationDimension } from "@/domain/analytics/optimization";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  asExperimentId,
  err,
  ok,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 改善ループを**回す**ユースケース群。
 *
 * --- なぜ読む側と分けて置くのか ---
 *
 * `review-loop-runs.ts` と `list-improvement-dimensions.ts` は「見る」だけで、
 * 表も保存の道筋も約束の突き当ても揃った 2026-08-19 の時点で、
 * **どのユースケースからも `save〜` が呼ばれていなかった**。
 * 部品は全部あるのに 1 周も回せない状態で、画面からは見分けが付かない。
 * ここが「試して、測って、次に活かす」の入口である。
 *
 * --- ここで判断しないこと ---
 *
 * 軸ごとの分岐は書かない。配色の試作も節の並びの試作も同じ道を通る。
 * 判定の式も持たない（`judgeComparison`）。状態の進み方も持たない
 * （`startLoopRun` / `concludeLoopRun` / `stopLoopRun`）。
 * ここがやるのは**権限の確認と、読み出し・書き込みの順番**だけである。
 *
 * 規範: docs/spec/03-分析・解析基盤仕様.md §14.1〜§14.5、REQ-IM05〜IM09、REQ-IM13
 */
export type RunImprovementLoopDeps = {
  readonly repository: ImprovementRepositoryPort;
  /**
   * 操作の記録先。
   *
   * **保存先（`repository`）と役割が違う。** あちらは「いまどうなっているか」で、
   * 上書きすると前の姿は残らない。こちらは「誰が・いつ・何をしたか」で、
   * 比較の結果が後から覆されたときに**その判断を誰がしたか**を言える唯一の場所である。
   * 見せ方は読者に出るものなので、決めた人が分からない状態にしない。
   */
  readonly auditLog: AuditLogPort;
  readonly ids: IdGeneratorPort;
  readonly now: () => Date;
};

/**
 * 操作を記録する。**保存の後に呼ぶ。**
 *
 * 先に記録すると、保存が落ちたときに「起きていない操作」の証拠が残る。
 * 記録に失敗したときは、済んだことと残っていることを文面に書いて断る
 * （`auditWriteFailure`）。黙って成功にしない。
 */
async function record(
  deps: RunImprovementLoopDeps,
  actor: ActorContext,
  input: {
    readonly action: AuditAction;
    readonly targetType: "variant_spec" | "loop_run";
    readonly targetId: string;
    readonly after?: Readonly<Record<string, unknown>> | null;
    readonly reason?: string | null;
    /** 記録に失敗したときに「もう済んでいること」として画面に出す一文（句点なし）。 */
    readonly doneAlready: string;
  },
): Promise<Result<void, DomainError>> {
  const entry = buildAuditEntry({ ids: deps.ids, now: deps.now }, actor, {
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    after: input.after ?? null,
    reason: input.reason ?? null,
  });
  if (!entry.ok) return entry;
  const appended = await deps.auditLog.append(entry.value);
  if (!appended.ok) return err(auditWriteFailure(input.doneAlready, appended.error.details));
  return ok(undefined);
}

/* ------------------------------------------------------------------ *
 * 1. 試作（見せ方の設定）を登録する
 * ------------------------------------------------------------------ */

export type DraftVariantSpecInput = {
  readonly siteSlug: string;
  readonly label: string;
  /**
   * 画面から来る値は文字列のまま受け取る。
   *
   * 数値の軸かどうかは登録表が知っている。判定を呼び出し側へ置くと、
   * 画面・REST・道具の 3 か所に同じ変換が写り、軸を 1 つ足した日に
   * どれかが古くなる。
   */
  readonly settings: readonly { readonly dimensionKey: string; readonly value: string }[];
};

export type DraftVariantSpecOutput = {
  readonly specId: string;
  readonly message: string;
};

export function createDraftVariantSpecUseCase(
  deps: RunImprovementLoopDeps,
): UseCase<DraftVariantSpecInput, DraftVariantSpecOutput> {
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "improvement.run", "試作の登録");
      if (!allowed.ok) return allowed;

      if (input.siteSlug.trim() === "") {
        return err(validationError("どのブログの試作かを選んでください。", "siteSlug"));
      }

      const settings: VariantSetting[] = [];
      for (const raw of input.settings) {
        if (raw.value.trim() === "") continue;
        const parsed = parseSettingValue(raw.dimensionKey, raw.value);
        if (!parsed.ok) return err(parsed.error);
        settings.push({ dimensionKey: raw.dimensionKey, value: parsed.value });
      }

      const at = deps.now();
      const spec = createVariantSpec({
        id: `spec_${deps.ids.newId()}`,
        label: input.label,
        settings,
        provenance: {
          // 画面から人が入れた、と分かるようにする。AI の提案と混ぜない。
          sourceType: "manual",
          sourceName: `${actor.userId} が画面から登録`,
          sourceUrl: null,
          retrievedAt: at,
          validUntil: null,
          confidence: 1,
          permittedUsage: "社内の記録として保持する",
        },
      });
      if (!spec.ok) return spec;

      const saved = await deps.repository.saveVariantSpec(actor.workspaceId, {
        spec: spec.value,
        siteSlug: input.siteSlug.trim(),
      });
      if (!saved.ok) return saved;

      const logged = await record(deps, actor, {
        action: "variant_spec.drafted",
        targetType: "variant_spec",
        targetId: spec.value.id,
        after: { label: spec.value.label, siteSlug: input.siteSlug.trim() },
        doneAlready: `「${spec.value.label}」の登録は済んでいます`,
      });
      if (!logged.ok) return logged;

      return ok({
        specId: spec.value.id,
        message: `「${spec.value.label}」を登録しました。承認するまでは比較に使えません。`,
      });
    },
  };
}

/** 文字列で来た値を、軸の登録表に合わせて変換する。 */
function parseSettingValue(
  dimensionKey: string,
  raw: string,
): Result<VariantValue, DomainError> {
  const dimension = findOptimizationDimension(dimensionKey);
  if (dimension === null) {
    // 登録表に無い軸。`createVariantSpec` も同じことを言うが、
    // ここで返さないと「数値なのか選択肢なのか」を決められない。
    return err(validationError(`登録されていない軸です: ${dimensionKey}`, dimensionKey));
  }
  if (dimension.candidateSource !== "numeric") return ok(raw.trim());

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return err(validationError(`${dimension.label} は数値で入れてください。`, dimensionKey));
  }
  return ok(value);
}

/* ------------------------------------------------------------------ *
 * 2. 試作を承認する（人だけ）
 * ------------------------------------------------------------------ */

export type ApproveVariantSpecInput = {
  readonly siteSlug: string;
  readonly specId: string;
};

export type ApproveVariantSpecOutput = { readonly message: string };

export function createApproveVariantSpecUseCase(
  deps: RunImprovementLoopDeps,
): UseCase<ApproveVariantSpecInput, ApproveVariantSpecOutput> {
  return {
    async execute(actor, input) {
      // 見た目だけの変更でも人が承認する（仕様 §14.5）。
      const allowed = requireCapability(actor, "improvement.approve", "試作の承認");
      if (!allowed.ok) return allowed;

      const found = await findSpec(deps, actor, input.siteSlug, input.specId);
      if (!found.ok) return found;

      const approved = approveVariantSpec(found.value, {
        approvedBy: actor.userId,
        at: deps.now(),
      });
      if (!approved.ok) return approved;

      const saved = await deps.repository.saveVariantSpec(actor.workspaceId, {
        spec: approved.value,
        siteSlug: input.siteSlug.trim(),
      });
      if (!saved.ok) return saved;

      const logged = await record(deps, actor, {
        action: "variant_spec.approved",
        targetType: "variant_spec",
        targetId: approved.value.id,
        after: { label: approved.value.label, siteSlug: input.siteSlug.trim() },
        doneAlready: `「${approved.value.label}」の承認は済んでいます`,
      });
      if (!logged.ok) return logged;

      return ok({
        message: `「${approved.value.label}」を承認しました。比較に使えます。`,
      });
    },
  };
}

async function findSpec(
  deps: RunImprovementLoopDeps,
  actor: ActorContext,
  siteSlug: string,
  specId: string,
): Promise<Result<VariantSpec, DomainError>> {
  const listed = await deps.repository.listVariantSpecs(actor.workspaceId, {
    siteSlug: siteSlug.trim(),
  });
  if (!listed.ok) return listed;
  const spec = listed.value.find((s) => s.id === specId);
  if (spec === undefined) {
    return err(validationError("その試作が見つかりません。", "specId"));
  }
  return ok(spec);
}

/* ------------------------------------------------------------------ *
 * 3. ループを始める
 * ------------------------------------------------------------------ */

export type StartLoopRunInput = {
  readonly siteSlug: string;
  readonly baselineSpecId: string;
  readonly candidateSpecId: string;
  readonly primaryMetric: string;
  readonly minimumSamples?: number;
  /**
   * ループの種類。既定は「記事を良くするループ」。
   *
   * 画面に選ばせるためではなく、**動かせないループを選んだときに
   * 断る理由がここまで届く**ようにするために入口を開けてある
   * （比べて決めないループ・まだ動かないループは `createLoopRun` が断る）。
   */
  readonly loopKindKey?: string;
};

export type StartLoopRunOutput = {
  readonly runId: string;
  readonly message: string;
};

export function createStartLoopRunUseCase(
  deps: RunImprovementLoopDeps,
): UseCase<StartLoopRunInput, StartLoopRunOutput> {
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "improvement.run", "比較の開始");
      if (!allowed.ok) return allowed;

      const metric = METRIC_DEFINITIONS.find((d) => d.key === input.primaryMetric);
      if (metric === undefined) {
        return err(
          validationError(
            "見る指標を先に決めてください。始めてから選び直すことはできません。",
            "primaryMetric",
          ),
        );
      }

      const baseline = await findSpec(deps, actor, input.siteSlug, input.baselineSpecId);
      if (!baseline.ok) return baseline;
      const candidate = await findSpec(deps, actor, input.siteSlug, input.candidateSpecId);
      if (!candidate.ok) return candidate;

      // 一度に変えてよい数は始める前に突き当てる（終わってから言っても遅い）。
      const diffs = assertComparable(baseline.value, candidate.value);
      if (!diffs.ok) return diffs;

      const draft = createLoopRun({
        id: asExperimentId(`run_${deps.ids.newId()}`),
        workspaceId: actor.workspaceId,
        loopKindKey: input.loopKindKey ?? "content_improvement",
        siteSlug: input.siteSlug.trim(),
        baselineSpecId: baseline.value.id,
        candidateSpecId: candidate.value.id,
        diffs: diffs.value,
        primaryMetric: metric.key as MetricKey,
        minimumSamples: input.minimumSamples ?? DEFAULT_MINIMUM_SAMPLES,
      });
      if (!draft.ok) return draft;

      const started = startLoopRun(draft.value, deps.now());
      if (!started.ok) return started;

      const saved = await deps.repository.saveRun(actor.workspaceId, started.value);
      if (!saved.ok) return saved;

      const logged = await record(deps, actor, {
        action: "loop_run.started",
        targetType: "loop_run",
        targetId: started.value.id,
        after: {
          siteSlug: started.value.siteSlug,
          baselineSpecId: started.value.baselineSpecId,
          candidateSpecId: started.value.candidateSpecId,
          primaryMetric: started.value.primaryMetric,
          minimumSamples: started.value.minimumSamples,
        },
        doneAlready: "比較はもう始まっています（読者には 2 通りが出ています）",
      });
      if (!logged.ok) return logged;

      return ok({
        runId: started.value.id,
        message:
          `${diffs.value.map((d) => d.label).join("・")} を変えた比較を始めました。` +
          `${metricDefinition(metric.key).label} を ${started.value.minimumSamples} 件ぶん見るまで、差があるとは言いません。`,
      });
    },
  };
}

/* ------------------------------------------------------------------ *
 * 4. 観測を書く
 * ------------------------------------------------------------------ */

export type RecordLoopObservationInput = {
  readonly runId: string;
  readonly baselineValue: number;
  readonly baselineSamples: number;
  readonly candidateValue: number;
  readonly candidateSamples: number;
};

export type RecordLoopObservationOutput = { readonly message: string };

export function createRecordLoopObservationUseCase(
  deps: RunImprovementLoopDeps,
): UseCase<RecordLoopObservationInput, RecordLoopObservationOutput> {
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "improvement.run", "観測値の記録");
      if (!allowed.ok) return allowed;

      const saved = await deps.repository.saveObservation(actor.workspaceId, {
        runId: input.runId,
        baselineValue: input.baselineValue,
        baselineSamples: input.baselineSamples,
        candidateValue: input.candidateValue,
        candidateSamples: input.candidateSamples,
        observedAt: deps.now(),
      });
      if (!saved.ok) return saved;

      const logged = await record(deps, actor, {
        action: "loop_run.observed",
        targetType: "loop_run",
        targetId: input.runId,
        // 数字そのものを残す。後から判定を疑うとき、根拠になった値が
        // 上書き前のものか後のものかを、記録側から言えるようにしておく。
        after: {
          baselineValue: input.baselineValue,
          baselineSamples: input.baselineSamples,
          candidateValue: input.candidateValue,
          candidateSamples: input.candidateSamples,
        },
        doneAlready: "観測値の記録は済んでいます",
      });
      if (!logged.ok) return logged;

      return ok({
        message:
          "観測値を記録しました。件数が足りていれば判定できます。足りなければ「まだ分からない」と出ます。",
      });
    },
  };
}

/* ------------------------------------------------------------------ *
 * 5. 判定する
 * ------------------------------------------------------------------ */

export type ConcludeLoopRunInput = { readonly runId: string };

export type ConcludeLoopRunOutput = {
  readonly verdict: string;
  readonly message: string;
};

export function createConcludeLoopRunUseCase(
  deps: RunImprovementLoopDeps,
): UseCase<ConcludeLoopRunInput, ConcludeLoopRunOutput> {
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "improvement.run", "比較の判定");
      if (!allowed.ok) return allowed;

      const found = await findRun(deps, actor, input.runId);
      if (!found.ok) return found;
      const { run, comparisonCount } = found.value;

      const observed = await deps.repository.observationsOf(actor.workspaceId, run.id);
      if (!observed.ok) return observed;
      if (observed.value === null) {
        return err(
          validationError(
            "観測値がまだありません。測った数字を先に記録してください。",
            "runId",
          ),
        );
      }

      const judged = judgeComparison({
        metric: run.primaryMetric,
        baselineValue: observed.value.baselineValue,
        baselineSamples: observed.value.baselineSamples,
        candidateValue: observed.value.candidateValue,
        candidateSamples: observed.value.candidateSamples,
        minimumSamples: run.minimumSamples,
        // 同時に見ている比較の数だけ厳しくする（多重比較への対処）。
        comparisonCount,
      });
      if (!judged.ok) return judged;

      // 判定保留のまま終わらせない。ここは `concludeLoopRun` が断る。
      const concluded = concludeLoopRun(run, { result: judged.value, at: deps.now() });
      if (!concluded.ok) return concluded;

      const saved = await deps.repository.saveRun(actor.workspaceId, concluded.value);
      if (!saved.ok) return saved;

      const logged = await record(deps, actor, {
        action: "loop_run.concluded",
        targetType: "loop_run",
        targetId: run.id,
        after: { verdict: judged.value.verdict, comparisonCount },
        reason: judged.value.reason,
        doneAlready: "判定は済んでいます",
      });
      if (!logged.ok) return logged;

      return ok({ verdict: judged.value.verdict, message: judged.value.reason });
    },
  };
}

/* ------------------------------------------------------------------ *
 * 6. 打ち切る
 * ------------------------------------------------------------------ */

export type StopLoopRunInput = {
  readonly runId: string;
  readonly reason: string;
};

export type StopLoopRunOutput = { readonly message: string };

export function createStopLoopRunUseCase(
  deps: RunImprovementLoopDeps,
): UseCase<StopLoopRunInput, StopLoopRunOutput> {
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "improvement.run", "比較の打ち切り");
      if (!allowed.ok) return allowed;

      const found = await findRun(deps, actor, input.runId);
      if (!found.ok) return found;

      // 理由の無い打ち切りは残せない（`stopLoopRun` が断る）。
      const stopped = stopLoopRun(found.value.run, { reason: input.reason, at: deps.now() });
      if (!stopped.ok) return stopped;

      const saved = await deps.repository.saveRun(actor.workspaceId, stopped.value);
      if (!saved.ok) return saved;

      const logged = await record(deps, actor, {
        action: "loop_run.stopped",
        targetType: "loop_run",
        targetId: stopped.value.id,
        // 理由はここでも必須（`createAuditLogEntry` が断る）。
        // ドメイン側と 2 か所で要求しているのは、記録の側だけを見て
        // 「なぜやめたか」が読める状態を保つためである。
        reason: input.reason,
        doneAlready: "この比較の打ち切りは済んでいます",
      });
      if (!logged.ok) return logged;

      return ok({ message: "この比較を打ち切りました。理由も一緒に残しています。" });
    },
  };
}

/**
 * 1 周を読み出す。同時に、同時進行の数も数えて返す。
 *
 * 判定のたびに数え直すのは、**多重比較の重みが「いま何本走っているか」で
 * 決まる**ため。判定の時点で数えないと、始めたときの本数で決まってしまう。
 */
async function findRun(
  deps: RunImprovementLoopDeps,
  actor: ActorContext,
  runId: string,
): Promise<Result<{ run: LoopRun; comparisonCount: number }, DomainError>> {
  const listed = await deps.repository.listRuns(actor.workspaceId);
  if (!listed.ok) return listed;
  const run = listed.value.find((r) => r.id === runId);
  if (run === undefined) {
    return err(validationError("その比較が見つかりません。", "runId"));
  }
  const comparisonCount = Math.max(1, listed.value.filter((r) => r.status === "running").length);
  return ok({ run, comparisonCount });
}
