import type {
  ImprovementRepositoryPort,
  LoopObservation,
} from "@/application/ports/improvement";
import {
  type LoopRun,
  type VariantSpec,
  assertRecordableLoopRun,
  assertRecordableObservation,
  assertRecordableVariantSpec,
} from "@/domain/analytics";
import { asExperimentId, asWorkspaceId, err, ok } from "@/domain/shared";
import { registerStub } from "../../stub-registry";

/**
 * ★ これは見本データです（スタブ）。★
 *
 * 改善ループの「1 周した記録」と「見せ方の設定」。
 *
 * **保存は受け付けるが、この処理が生きているあいだしか残らない。**
 * 2026-08-19 まではここが本当に失敗を返しており、そのぶん
 * 「承認した設定が消えたことに気づけない」形にはなっていなかった。
 * だが入口（画面から 1 周まわす操作）を作ると、保存が必ず失敗する環境では
 * **1 周が最初の一歩で止まる**。試せない入口は、無い入口と同じである。
 *
 * 覚えたふりはしない代わりに、保存先が無いことは
 * 画面の但し書き（`improvementStubNotice`）で出し続ける。
 * D1 がつながっている環境（`pnpm run preview` と本番）ではこちらは使われない。
 *
 * 保存の可否は `domain/analytics/loop-record.ts` で突き当てる。
 * **D1 側と同じ 1 ファイルを通す。** ここだけ素通りにすると、
 * 「保存先が無い環境でだけ、置いてはいけない記録が置ける」抜け道になる。
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
  // 表と入口は追加済み（`d1/improvement-repository.ts` と
  // `application/usecases/improvement/run-improvement-loop.ts`）。
  // 残っているのは**この環境に D1 がつながっていないこと**だけで、
  // つながればこのファイルは使われない。
  blockedBy: "D1 への接続（表も、画面から回す操作も追加済み）",
  fallbackFor: "src/infrastructure/persistence/d1/improvement-repository.ts",
});

export function improvementStubNotice(): string {
  return `${stub.label}。${stub.blockedBy}が済むまでの仮です。`;
}

/**
 * 保存した分の置き場。**種（`SAMPLE_〜`）は書き換えない。**
 *
 * 上書きは追加側だけで解決する（`link-inbox-sample-repository.ts` と同じ形）。
 * 種を書き換えると、見本の 3 通り（判定済み・件数不足・効果不明）が
 * 1 度触っただけで崩れ、「良い結果だけが並ぶ画面」に戻ってしまう。
 */
const addedSpecs: VariantSpec[] = [];
const addedRuns: LoopRun[] = [];
const addedObservations: Record<string, LoopObservation> = {};

function allSpecs(): readonly VariantSpec[] {
  const merged = new Map(SAMPLE_SPECS.map((s) => [s.id, s]));
  for (const s of addedSpecs) merged.set(s.id, s);
  return [...merged.values()];
}

function allRuns(): readonly LoopRun[] {
  const merged = new Map<string, LoopRun>(SAMPLE_RUNS.map((r) => [r.id, r]));
  for (const r of addedRuns) merged.set(r.id, r);
  return [...merged.values()];
}

/**
 * 画面に出す「何が済めば外れるか」。**台帳と同じ値を返す。**
 *
 * 画面側に同じ文を書き写すと、台帳を直した日に画面だけ古い理由を出し続ける
 * （現に「テーブルの追加」と書いたまま、表を追加した日に古くなった）。
 */
export function improvementStubBlockedBy(): string {
  return stub.blockedBy;
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
      // 設定はどのブログのものかを持たない（持たせると設定の形がブログの数だけ増える）。
      // 見本では絞り込みをしない。絞り込みは保存先の側の仕事である。
      return ok(allSpecs());
    },
    async saveVariantSpec(_workspaceId, input) {
      const recordable = assertRecordableVariantSpec(input.spec);
      if (!recordable.ok) return err(recordable.error);
      const at = addedSpecs.findIndex((s) => s.id === input.spec.id);
      if (at >= 0) addedSpecs[at] = input.spec;
      else addedSpecs.push(input.spec);
      return ok(true as const);
    },
    async listRuns(_workspaceId, input) {
      const rows = allRuns();
      return ok(
        input?.siteSlug === undefined ? rows : rows.filter((r) => r.siteSlug === input.siteSlug),
      );
    },
    async saveRun(_workspaceId, run) {
      const specs = allSpecs();
      const recordable = assertRecordableLoopRun(run, {
        baseline: specs.find((s) => s.id === run.baselineSpecId) ?? null,
        candidate: specs.find((s) => s.id === run.candidateSpecId) ?? null,
      });
      if (!recordable.ok) return err(recordable.error);
      const at = addedRuns.findIndex((r) => r.id === run.id);
      if (at >= 0) addedRuns[at] = run;
      else addedRuns.push(run);
      return ok(true as const);
    },
    async observationsOf(_workspaceId, runId) {
      return ok(addedObservations[runId] ?? SAMPLE_OBSERVATIONS[runId] ?? null);
    },
    async saveObservation(_workspaceId, input) {
      const recordable = assertRecordableObservation({
        ...input,
        run: allRuns().find((r) => r.id === input.runId) ?? null,
      });
      if (!recordable.ok) return err(recordable.error);
      addedObservations[input.runId] = {
        runId: input.runId,
        baselineValue: input.baselineValue,
        baselineSamples: input.baselineSamples,
        candidateValue: input.candidateValue,
        candidateSamples: input.candidateSamples,
      };
      return ok(true as const);
    },
  };
}
