import type {
  ImprovementRepositoryPort,
  LoopObservation,
} from "@/application/ports/improvement";
import type { LoopRun, VariantSpec } from "@/domain/analytics";
import { asExperimentId, asWorkspaceId, ok } from "@/domain/shared";
import { registerStub, stubCall } from "../../stub-registry";

/**
 * ★ これは見本データです（スタブ）。★
 *
 * 改善ループの「1 周した記録」と「見せ方の設定」。
 * 読み出しは見本を返すが、**保存は本当に失敗を返す**。
 * 保存できたことにすると、承認した設定が消えていることに
 * 誰も気づかないまま画面だけ動いてしまう。
 *
 * 見本には**わざと 3 通り**入れてある。
 *   1. 判定まで済んだもの（良くなった）
 *   2. 件数が足りず判定保留のもの
 *   3. 差が小さく効果不明のもの
 * 「良い結果だけが並ぶ画面」を作らないため。実際にはこの 3 通りが混ざる。
 */
const stub = registerStub({
  id: "persistence:improvement-sample",
  port: "改善ループの記録先",
  label: "改善ループの記録（見本データ。保存はできません）",
  // 表よりも先に入口が要る。改善ループを回す操作がまだ無く、
  // どのユースケースからも `save` が呼ばれていない（保存先だけ本物にしても空のまま）。
  blockedBy:
    "改善ループを回す入口（画面と操作）の追加。そのうえで variant_specs / loop_runs / loop_observations テーブルの追加",
});

export function improvementStubNotice(): string {
  return `${stub.label}。${stub.blockedBy}が済むまでの仮です。`;
}

const WS = asWorkspaceId("ws_sample");

function provenance(sourceName: string, retrievedAt: string) {
  return {
    sourceType: "manual" as const,
    sourceName,
    sourceUrl: null,
    retrievedAt: new Date(retrievedAt),
    validUntil: null,
    confidence: 1,
    permittedUsage: "社内の記録として保持する",
  };
}

const SAMPLE_SPECS: readonly VariantSpec[] = [
  {
    id: "spec_baseline",
    label: "現行（比べるもと）",
    settings: [
      { dimensionKey: "section_order", value: "結論が先" },
      { dimensionKey: "lead_length", value: 240 },
    ],
    provenance: provenance("編集の責任者が決定", "2026-07-01T00:00:00Z"),
    approvedBy: "編集の責任者",
    approvedAt: new Date("2026-07-01T00:00:00Z"),
  },
  {
    id: "spec_compare_first",
    label: "比較表を先に出す",
    settings: [
      { dimensionKey: "section_order", value: "比較が先" },
      { dimensionKey: "lead_length", value: 240 },
    ],
    provenance: provenance("AI の提案を編集の責任者が承認", "2026-07-20T00:00:00Z"),
    approvedBy: "編集の責任者",
    approvedAt: new Date("2026-07-21T00:00:00Z"),
  },
  {
    id: "spec_wider_body",
    label: "本文の横幅を広げる",
    settings: [{ dimensionKey: "body_max_width", value: 820 }],
    provenance: provenance("編集の責任者が決定", "2026-08-01T00:00:00Z"),
    approvedBy: "編集の責任者",
    approvedAt: new Date("2026-08-01T00:00:00Z"),
  },
  {
    id: "spec_warm_theme",
    label: "配色を落ち着いた色へ",
    settings: [{ dimensionKey: "brand_theme", value: "indigo-clay" }],
    provenance: provenance("AI の提案（未承認）", "2026-08-14T00:00:00Z"),
    approvedBy: null,
    approvedAt: null,
  },
];

const SAMPLE_RUNS: readonly LoopRun[] = [
  {
    id: asExperimentId("run_section_order"),
    workspaceId: WS,
    loopKindKey: "content_improvement",
    siteSlug: "video-editing-gear",
    baselineSpecId: "spec_baseline",
    candidateSpecId: "spec_compare_first",
    changedDimensions: ["section_order"],
    primaryMetric: "read_completion_rate",
    minimumSamples: 200,
    status: "concluded",
    startedAt: new Date("2026-07-21T00:00:00Z"),
    concludedAt: new Date("2026-08-10T00:00:00Z"),
    verdict: "improved",
    stoppedReason: null,
  },
  {
    id: asExperimentId("run_body_width"),
    workspaceId: WS,
    loopKindKey: "content_improvement",
    siteSlug: "video-editing-gear",
    baselineSpecId: "spec_baseline",
    candidateSpecId: "spec_wider_body",
    changedDimensions: ["body_max_width"],
    primaryMetric: "read_completion_rate",
    minimumSamples: 200,
    status: "running",
    startedAt: new Date("2026-08-05T00:00:00Z"),
    concludedAt: null,
    verdict: null,
    stoppedReason: null,
  },
  {
    id: asExperimentId("run_theme"),
    workspaceId: WS,
    loopKindKey: "content_improvement",
    siteSlug: "gear-for-small-kitchen",
    baselineSpecId: "spec_baseline",
    candidateSpecId: "spec_warm_theme",
    changedDimensions: ["brand_theme"],
    primaryMetric: "time_on_page_seconds",
    minimumSamples: 200,
    status: "running",
    startedAt: new Date("2026-08-08T00:00:00Z"),
    concludedAt: null,
    verdict: null,
    stoppedReason: null,
  },
];

/**
 * 見本の観測値。
 *
 * `run_body_width` はわざと件数を足りなくしてある。
 * 「まだ判定できません」が画面に出ることを、見本の状態で確かめられるようにするため。
 */
const SAMPLE_OBSERVATIONS: Readonly<Record<string, LoopObservation>> = {
  run_section_order: {
    runId: "run_section_order",
    baselineValue: 0.42,
    baselineSamples: 1_180,
    candidateValue: 0.49,
    candidateSamples: 1_204,
  },
  run_body_width: {
    runId: "run_body_width",
    baselineValue: 0.44,
    baselineSamples: 310,
    candidateValue: 0.46,
    candidateSamples: 96,
  },
  run_theme: {
    runId: "run_theme",
    baselineValue: 96,
    baselineSamples: 940,
    candidateValue: 98,
    candidateSamples: 910,
  },
};

export function createSampleImprovementRepository(): ImprovementRepositoryPort {
  return {
    async listVariantSpecs(_workspaceId, _input) {
      return ok(SAMPLE_SPECS);
    },
    async saveVariantSpec(_workspaceId, _spec) {
      // 保存できたことにしない。承認した設定が消えるのが最も分かりにくい壊れ方。
      return stubCall(stub, "見せ方の設定の保存");
    },
    async listRuns(_workspaceId, input) {
      const rows =
        input?.siteSlug === undefined
          ? SAMPLE_RUNS
          : SAMPLE_RUNS.filter((r) => r.siteSlug === input.siteSlug);
      return ok(rows);
    },
    async saveRun(_workspaceId, _run) {
      return stubCall(stub, "改善ループの記録の保存");
    },
    async observationsOf(_workspaceId, runId) {
      return ok(SAMPLE_OBSERVATIONS[runId] ?? null);
    },
  };
}
