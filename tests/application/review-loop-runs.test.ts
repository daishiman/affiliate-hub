/** @tier 1 */
import { describe, expect, it } from "vitest";
import type { ImprovementRepositoryPort, LoopObservation } from "@/application/ports/improvement";
import {
  type ReviewLoopRunsDeps,
  createReviewLoopRunsUseCase,
} from "@/application/usecases/improvement/review-loop-runs";
import type { LoopRun, LoopRunStatus, VariantSpec } from "@/domain/analytics";
import { DEFAULT_MINIMUM_SAMPLES } from "@/domain/analytics";
import { domainError, err, ok } from "@/domain/shared";
import type { ExperimentId, WorkspaceId } from "@/domain/shared";
import { WORKSPACE, aNobody, anAnalyst } from "../support/actors";
import { aProvenance } from "../support/factories";

/**
 * 実施中・判定済みのループの一覧。
 *
 * --- ここで固定したいこと ---
 * 1. **判定できないものを、隠さずに出すこと。**
 *    件数不足を空欄にすると、実施中のまま忘れられた比較が溜まる。
 * 2. **読み出せなかったことを、0 件と同じ顔にしないこと。**
 *    「まだ試していない」と「記録が読めない」では、次にやることが違う。
 * 3. **同時に見ている比較の数だけ判定を厳しくすること。**
 *    20 個も比べれば、何も無くても 1 つは差が出て見える。
 * 4. **軸ごとの分岐がここに無いこと。** 軸を足してもこのファイルは変わらない。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-6（境界値・統計判定）
 */

const analyst = anAnalyst();

function aSpec(over: Partial<VariantSpec> = {}): VariantSpec {
  return {
    id: "vs_baseline",
    label: "いまの見せ方",
    settings: [{ dimensionKey: "summary_position", value: "top" }],
    provenance: aProvenance(),
    approvedBy: "user-owner",
    approvedAt: new Date("2026-08-01T00:00:00Z"),
    ...over,
  } as VariantSpec;
}

function aRun(over: Partial<LoopRun> = {}): LoopRun {
  return {
    id: "exp_0001" as ExperimentId,
    workspaceId: WORKSPACE as WorkspaceId,
    loopKindKey: "content_improvement",
    siteSlug: "video-editing-gear",
    baselineSpecId: "vs_baseline",
    candidateSpecId: "vs_candidate",
    changedDimensions: ["summary_position"],
    primaryMetric: "read_completion_rate",
    minimumSamples: 10,
    status: "running",
    startedAt: new Date("2026-08-10T00:00:00Z"),
    concludedAt: null,
    verdict: null,
    stoppedReason: null,
    ...over,
  } as LoopRun;
}

function anObservation(over: Partial<LoopObservation> = {}): LoopObservation {
  return {
    runId: "exp_0001",
    baselineValue: 0.4,
    baselineSamples: 100,
    candidateValue: 0.4,
    candidateSamples: 100,
    ...over,
  };
}

type RepoOverrides = {
  readonly runs?: readonly LoopRun[];
  readonly specs?: readonly VariantSpec[];
  readonly observation?: LoopObservation | null;
  readonly runsFail?: string;
  readonly specsFail?: boolean;
  readonly observationFail?: string;
};

function repository(over: RepoOverrides = {}): ImprovementRepositoryPort {
  return {
    async listRuns() {
      if (over.runsFail !== undefined) {
        return err(domainError("UPSTREAM_UNAVAILABLE", over.runsFail));
      }
      return ok(over.runs ?? []);
    },
    async listVariantSpecs() {
      if (over.specsFail === true) {
        return err(domainError("UPSTREAM_UNAVAILABLE", "設定を読み出せません。"));
      }
      return ok(over.specs ?? []);
    },
    async observationsOf() {
      if (over.observationFail !== undefined) {
        return err(domainError("UPSTREAM_UNAVAILABLE", over.observationFail));
      }
      return ok(over.observation === undefined ? anObservation() : over.observation);
    },
    async saveVariantSpec() {
      return ok(true as const);
    },
    async saveRun() {
      return ok(true as const);
    },
    async saveObservation() {
      return ok(true as const);
    },
  };
}

function deps(over: RepoOverrides = {}): ReviewLoopRunsDeps {
  return { repository: repository(over) };
}

describe("見られる人", () => {
  it("数字を見る権限が無い人には出さない", async () => {
    const result = await createReviewLoopRunsUseCase(deps()).execute(aNobody(), {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });

  it("数字を見るだけの人でも見られる（改善の確認に承認権限は要らない）", async () => {
    const result = await createReviewLoopRunsUseCase(deps()).execute(analyst, {});
    expect(result.ok).toBe(true);
  });
});

describe("1 件も無いとき", () => {
  it("まだ試していないことを、そのまま書く", async () => {
    const result = await createReviewLoopRunsUseCase(deps()).execute(analyst, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows).toEqual([]);
    expect(result.value.emptyReason).toContain("まだ試している比較はありません");
  });

  it("記録が読めなかったときは、まだ試していないと言わない", async () => {
    const result = await createReviewLoopRunsUseCase(
      deps({ runsFail: "保存先に接続できません。" }),
    ).execute(analyst, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // ここを空欄や「ありません」にすると、壊れていることに誰も気づかない。
    expect(result.value.emptyReason).toContain("読み出せません");
    expect(result.value.emptyReason).toContain("保存先に接続できません。");
  });
});

describe("判定できないもの", () => {
  it("観測値がまだ無いときは、その理由を出す", async () => {
    const result = await createReviewLoopRunsUseCase(
      deps({ runs: [aRun()], observation: null }),
    ).execute(analyst, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows[0]?.blockedReason).toContain("まだ観測値がありません");
    expect(result.value.rows[0]?.result).toBeNull();
    expect(result.value.pendingCount).toBe(1);
  });

  it("観測値が読み出せないときは、「まだ無い」と言い換えない", async () => {
    const result = await createReviewLoopRunsUseCase(
      deps({ runs: [aRun()], observationFail: "観測の保存先に接続できません。" }),
    ).execute(analyst, {});
    expect(result.ok && result.value.rows[0]?.blockedReason).toContain("読み出せません");
  });

  it("件数が足りないときは、あと何件要るかまで書く", async () => {
    const result = await createReviewLoopRunsUseCase(
      deps({
        runs: [aRun({ minimumSamples: 200 })],
        observation: anObservation({ baselineSamples: 10, candidateSamples: 10 }),
      }),
    ).execute(analyst, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const row = result.value.rows[0];
    expect(row?.result?.verdict).toBe("pending");
    expect(row?.blockedReason).toContain("必要 200 件");
  });

  it("判定に必要な件数が不正な記録は、行ごと消さずに理由を出す", async () => {
    const result = await createReviewLoopRunsUseCase(
      deps({ runs: [aRun({ minimumSamples: 0 })], observation: anObservation() }),
    ).execute(analyst, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 消すと「最初から無かった」ように見える。壊れた記録があること自体を出す。
    expect(result.value.rows).toHaveLength(1);
    expect(result.value.rows[0]?.blockedReason).toContain("1 以上の整数");
    expect(result.value.rows[0]?.result).toBeNull();
  });
});

describe("判定できたもの", () => {
  it("良くなったときは、差の大きさを添えて出す", async () => {
    const result = await createReviewLoopRunsUseCase(
      deps({
        runs: [aRun()],
        observation: anObservation({ baselineValue: 0.4, candidateValue: 0.5 }),
      }),
    ).execute(analyst, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const row = result.value.rows[0];
    expect(row?.result?.verdict).toBe("improved");
    expect(row?.blockedReason).toBeNull();
    expect(row?.verdictLabel.length).toBeGreaterThan(0);
    // 次に何をするかの候補まで出す。判定だけ出しても手が止まる。
    expect(row?.suggestions.length).toBeGreaterThan(0);
  });

  it("悪くなったときも、隠さずに出す", async () => {
    const result = await createReviewLoopRunsUseCase(
      deps({
        runs: [aRun()],
        observation: anObservation({ baselineValue: 0.5, candidateValue: 0.4 }),
      }),
    ).execute(analyst, {});
    expect(result.ok && result.value.rows[0]?.result?.verdict).toBe("worsened");
  });

  it("差が小さいときは「良くなった」と言わない", async () => {
    const result = await createReviewLoopRunsUseCase(
      deps({
        runs: [aRun()],
        observation: anObservation({ baselineValue: 0.4, candidateValue: 0.408 }),
      }),
    ).execute(analyst, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows[0]?.result?.verdict).toBe("unclear");
    // 判定できた行なので、止まっている数には数えない。
    expect(result.value.pendingCount).toBe(0);
  });

  it("もとの値が 0 のときは、増えた割合を出さない", async () => {
    const result = await createReviewLoopRunsUseCase(
      deps({
        runs: [aRun()],
        observation: anObservation({ baselineValue: 0, candidateValue: 0.3 }),
      }),
    ).execute(analyst, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows[0]?.result?.verdict).toBe("unclear");
    expect(result.value.rows[0]?.result?.relativeChange).toBeNull();
  });
});

describe("同時に見ている比較の数", () => {
  it("実施中が増えるほど、必要な件数が増える", async () => {
    const one = await createReviewLoopRunsUseCase(
      deps({ runs: [aRun()], observation: anObservation() }),
    ).execute(analyst, {});
    const three = await createReviewLoopRunsUseCase(
      deps({
        runs: [
          aRun({ id: "exp_1" as ExperimentId }),
          aRun({ id: "exp_2" as ExperimentId }),
          aRun({ id: "exp_3" as ExperimentId }),
        ],
        observation: anObservation(),
      }),
    ).execute(analyst, {});

    expect(one.ok && three.ok).toBe(true);
    if (!one.ok || !three.ok) return;
    const required = (r: typeof one) =>
      r.ok ? (r.value.rows[0]?.result?.requiredSamples ?? 0) : 0;
    expect(required(three)).toBe(required(one) * 3);
  });

  it("実施中が 1 件も無くても、必要件数を 0 にしない", async () => {
    const result = await createReviewLoopRunsUseCase(
      deps({ runs: [aRun({ status: "concluded" })], observation: anObservation() }),
    ).execute(analyst, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows[0]?.result?.requiredSamples).toBe(10);
    expect(result.value.runningCount).toBe(0);
  });

  it("注意書きに、今回の比較数と既定の必要件数を書く", async () => {
    const result = await createReviewLoopRunsUseCase(
      deps({ runs: [aRun()], observation: anObservation() }),
    ).execute(analyst, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const joined = result.value.caveats.join("\n");
    expect(joined).toContain("1 件ぶん");
    expect(joined).toContain(String(DEFAULT_MINIMUM_SAMPLES));
    // 統計的な検定だと誤解させない。
    expect(joined).toContain("統計的な検定ではありません");
    expect(joined).toContain("人の承認");
  });
});

describe("何を変えた比較かの見せ方", () => {
  it("設定の記録があるときは、実際の差から呼び名を作る", async () => {
    const result = await createReviewLoopRunsUseCase(
      deps({
        runs: [aRun()],
        specs: [
          aSpec(),
          aSpec({
            id: "vs_candidate",
            label: "試す見せ方",
            settings: [{ dimensionKey: "summary_position", value: "bottom" }],
          }),
        ],
        observation: anObservation(),
      }),
    ).execute(analyst, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows[0]?.changedLabels).toHaveLength(1);
    // 軸の呼び名で出す（内部の鍵をそのまま出さない、が守れているか）。
    expect(result.value.rows[0]?.changedLabels[0]).not.toBe("");
  });

  it("設定の記録が無いときでも、記録に残った軸から呼び名を作る", async () => {
    const result = await createReviewLoopRunsUseCase(
      deps({ runs: [aRun()], specs: [], observation: anObservation() }),
    ).execute(analyst, {});
    expect(result.ok && result.value.rows[0]?.changedLabels).toHaveLength(1);
  });

  it("設定が読み出せないときでも、行は消さない", async () => {
    const result = await createReviewLoopRunsUseCase(
      deps({ runs: [aRun()], specsFail: true, observation: anObservation() }),
    ).execute(analyst, {});
    expect(result.ok && result.value.rows).toHaveLength(1);
  });

  it("登録されていない軸は、鍵をそのまま呼び名にする（空欄にしない）", async () => {
    const result = await createReviewLoopRunsUseCase(
      deps({
        runs: [aRun({ changedDimensions: ["no_such_dimension"] })],
        observation: anObservation(),
      }),
    ).execute(analyst, {});
    expect(result.ok && result.value.rows[0]?.changedLabels).toEqual(["no_such_dimension"]);
  });

  it("登録されていないループでも、行と鍵を出す（黙って消さない）", async () => {
    const result = await createReviewLoopRunsUseCase(
      deps({ runs: [aRun({ loopKindKey: "no_such_loop" })], observation: anObservation() }),
    ).execute(analyst, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows[0]?.loopKindLabel).toBe("no_such_loop");
    expect(result.value.rows[0]?.polarityLabel).toBe("不明");
  });
});

describe("状態の数え方", () => {
  it.each([
    ["draft", "準備中"],
    ["running", "実施中"],
    ["concluded", "判定済み"],
    ["stopped", "打ち切り"],
  ] as const)("%s は「%s」と出す", async (status, label) => {
    const result = await createReviewLoopRunsUseCase(
      deps({ runs: [aRun({ status: status as LoopRunStatus })], observation: anObservation() }),
    ).execute(analyst, {});
    expect(result.ok && result.value.rows[0]?.statusLabel).toBe(label);
  });

  it("実施中の数と、止まっている数を別々に数える", async () => {
    const result = await createReviewLoopRunsUseCase(
      deps({
        runs: [
          aRun({ id: "exp_a" as ExperimentId }),
          aRun({ id: "exp_b" as ExperimentId, status: "concluded" }),
        ],
        observation: null,
      }),
    ).execute(analyst, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.runningCount).toBe(1);
    // 観測値が無い 2 件は、どちらも止まっている扱い。
    expect(result.value.pendingCount).toBe(2);
  });
});
