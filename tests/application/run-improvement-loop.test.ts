/**
 * @tier 1
 * @req REQ-IM06, REQ-IM09
 * @types permission-matrix, state-transition, equivalence, boundary, audit-log
 *
 * 改善ループを**回す**側（`run-improvement-loop.ts`）。
 *
 * 見る側（`list-improvement-dimensions` / `review-loop-runs`）にはテストがあるのに、
 * 回す側は 1 本も無く、分岐の半分が通っていなかった。
 * ここが落ちると「読者に出す見せ方が、誰の承認も無く切り替わる」か、
 * 「勝ったことになっているが観測値が足りていない」のどちらかが起きる。
 *
 * 固定したいこと。
 *   1. **承認は人の権限でしか通らない**（`improvement.approve`）。
 *   2. **判定と打ち切りの順番を飛ばせない**（保存 → 記録、の順）。
 *   3. **登録表に無い軸・型の違う値は入口で断る**（保存先に届かせない）。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImprovementRepositoryPort, LoopObservation } from "@/application/ports/improvement";
import type { AuditLogPort } from "@/application/ports/compliance";
import {
  createApproveVariantSpecUseCase,
  createConcludeLoopRunUseCase,
  createDraftVariantSpecUseCase,
  createRecordLoopObservationUseCase,
  createStartLoopRunUseCase,
  createStopLoopRunUseCase,
} from "@/application/usecases/improvement/run-improvement-loop";
import type { LoopRun, VariantSpec } from "@/domain/analytics";
import type { ExperimentId } from "@/domain/shared";
import { domainError, err, ok } from "@/domain/shared";
import { WORKSPACE, aNobody, anOwner } from "../support/actors";

const NOW = new Date("2026-08-27T00:00:00.000Z");
const owner = anOwner({ workspaceId: WORKSPACE });
const nobody = aNobody({ workspaceId: WORKSPACE });

function aSpec(over: Partial<VariantSpec> = {}): VariantSpec {
  return {
    id: "vs-base",
    label: "いまの版",
    settings: [{ dimensionKey: "section_order", value: "conclusion_first" }],
    provenance: { sourceKind: "human", sourceName: "編集部" },
    approvedBy: "user-owner",
    approvedAt: NOW,
    ...over,
  } as VariantSpec;
}

function aRun(over: Partial<LoopRun> = {}): LoopRun {
  return {
    id: "run-1" as ExperimentId,
    workspaceId: WORKSPACE,
    loopKindKey: "content_improvement",
    siteSlug: "blog-a",
    baselineSpecId: "vs-base",
    candidateSpecId: "vs-cand",
    changedDimensions: ["section_order"],
    primaryMetric: "scroll_depth_p50",
    minimumSamples: 100,
    status: "running",
    startedAt: NOW,
    concludedAt: null,
    verdict: null,
    stoppedReason: null,
    ...over,
  };
}

type Setup = {
  specs?: readonly VariantSpec[];
  runs?: readonly LoopRun[];
  observation?: LoopObservation | null;
  /** 読み書きのどこか 1 か所だけを壊す。壊す先は名前で指す。 */
  breaks?: Partial<
    Record<
      "listVariantSpecs" | "saveVariantSpec" | "listRuns" | "saveRun" | "observationsOf" | "saveObservation" | "audit",
      true
    >
  >;
};

const failure = () => err(domainError("UPSTREAM_UNAVAILABLE", "保存先が応答しません。"));

function depsOf(setup: Setup = {}) {
  const saved = {
    specs: [] as { spec: VariantSpec; siteSlug: string }[],
    runs: [] as LoopRun[],
    observations: [] as (LoopObservation & { observedAt: Date })[],
    audits: [] as { action: string; reason: string | null; targetId: string }[],
  };
  const broken = setup.breaks ?? {};
  const repository: ImprovementRepositoryPort = {
    async listVariantSpecs() {
      if (broken.listVariantSpecs) return failure();
      return ok(setup.specs ?? []);
    },
    async saveVariantSpec(_workspaceId, input) {
      if (broken.saveVariantSpec) return failure();
      saved.specs.push({ spec: input.spec, siteSlug: input.siteSlug });
      return ok(true);
    },
    async listRuns() {
      if (broken.listRuns) return failure();
      return ok(setup.runs ?? []);
    },
    async saveRun(_workspaceId, run) {
      if (broken.saveRun) return failure();
      saved.runs.push(run);
      return ok(true);
    },
    async observationsOf() {
      if (broken.observationsOf) return failure();
      return ok(setup.observation ?? null);
    },
    async saveObservation(_workspaceId, input) {
      if (broken.saveObservation) return failure();
      saved.observations.push(input);
      return ok(true);
    },
  };
  const auditLog = {
    async append(entry: { action: string; reason: string | null; targetId: string }) {
      if (broken.audit) {
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "記録先が応答しません。", {
            details: { where: "auditLog" },
          }),
        );
      }
      saved.audits.push(entry);
      return ok(entry);
    },
  } as unknown as AuditLogPort;

  let seq = 0;
  return {
    deps: {
      repository,
      auditLog,
      ids: { newId: () => `id${++seq}` },
      now: () => NOW,
    },
    saved,
  };
}

let d: ReturnType<typeof depsOf>;
beforeEach(() => {
  d = depsOf();
});

describe("試作を登録する", () => {
  it("改善ループを回す権限が無ければ、保存先を読みにも行かない", async () => {
    const listed = vi.fn();
    const { deps } = depsOf();
    const r = await createDraftVariantSpecUseCase({
      ...deps,
      repository: { ...deps.repository, saveVariantSpec: listed },
    }).execute(nobody, { siteSlug: "blog-a", label: "案", settings: [] });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
    expect(listed).not.toHaveBeenCalled();
  });

  it("どのブログの試作かが空欄なら、欄を名指しして断る", async () => {
    const r = await createDraftVariantSpecUseCase(d.deps).execute(owner, {
      siteSlug: "   ",
      label: "案",
      settings: [{ dimensionKey: "section_order", value: "conclusion_first" }],
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("siteSlug");
  });

  it("値が空欄の軸は「変えない軸」として飛ばす", async () => {
    const r = await createDraftVariantSpecUseCase(d.deps).execute(owner, {
      siteSlug: "blog-a",
      label: "案",
      settings: [
        { dimensionKey: "section_order", value: "conclusion_first" },
        { dimensionKey: "lead_length", value: "  " },
      ],
    });

    expect(r.ok).toBe(true);
    expect(d.saved.specs[0].spec.settings).toEqual([
      { dimensionKey: "section_order", value: "conclusion_first" },
    ]);
  });

  it("数値の軸は数値に直して渡す", async () => {
    await createDraftVariantSpecUseCase(d.deps).execute(owner, {
      siteSlug: "blog-a",
      label: "案",
      settings: [{ dimensionKey: "lead_length", value: "120" }],
    });

    expect(d.saved.specs[0].spec.settings[0].value).toBe(120);
  });

  it("数値の軸に数値でない文字が来たら、その軸を名指しして断る", async () => {
    const r = await createDraftVariantSpecUseCase(d.deps).execute(owner, {
      siteSlug: "blog-a",
      label: "案",
      settings: [{ dimensionKey: "lead_length", value: "ながめ" }],
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("lead_length");
    expect(d.saved.specs).toHaveLength(0);
  });

  it("登録表に無い軸は、保存先へ届かせない", async () => {
    const r = await createDraftVariantSpecUseCase(d.deps).execute(owner, {
      siteSlug: "blog-a",
      label: "案",
      settings: [{ dimensionKey: "font_color", value: "赤" }],
    });

    expect(r.ok).toBe(false);
    expect(d.saved.specs).toHaveLength(0);
  });

  it("ブログの名前は前後の空白を落として保存する", async () => {
    await createDraftVariantSpecUseCase(d.deps).execute(owner, {
      siteSlug: "  blog-a  ",
      label: "案",
      settings: [{ dimensionKey: "section_order", value: "conclusion_first" }],
    });

    expect(d.saved.specs[0].siteSlug).toBe("blog-a");
  });

  it("保存先が落ちたら、記録は残さない", async () => {
    const broken = depsOf({ breaks: { saveVariantSpec: true } });
    const r = await createDraftVariantSpecUseCase(broken.deps).execute(owner, {
      siteSlug: "blog-a",
      label: "案",
      settings: [{ dimensionKey: "section_order", value: "conclusion_first" }],
    });

    expect(r.ok).toBe(false);
    expect(broken.saved.audits).toHaveLength(0);
  });

  it("登録できたら「承認するまで使えない」と伝える", async () => {
    const r = await createDraftVariantSpecUseCase(d.deps).execute(owner, {
      siteSlug: "blog-a",
      label: "結論を先に",
      settings: [{ dimensionKey: "section_order", value: "conclusion_first" }],
    });

    expect(r.ok && r.value.message).toContain("承認するまでは比較に使えません");
    expect(d.saved.audits[0].action).toBe("variant_spec.drafted");
  });
});

describe("試作を承認する", () => {
  const input = { siteSlug: "blog-a", specId: "vs-base" };

  it("権限が無ければ断る", async () => {
    const r = await createApproveVariantSpecUseCase(d.deps).execute(nobody, input);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
  });

  it("一覧が読めないときは、その断りをそのまま返す", async () => {
    const broken = depsOf({ breaks: { listVariantSpecs: true } });
    const r = await createApproveVariantSpecUseCase(broken.deps).execute(owner, input);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("その試作が無ければ、欄を名指しして断る", async () => {
    const empty = depsOf({ specs: [] });
    const r = await createApproveVariantSpecUseCase(empty.deps).execute(owner, input);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("specId");
  });

  it("すでに承認されている試作は、二度目を断る", async () => {
    const already = depsOf({ specs: [aSpec({ approvedBy: "user-other", approvedAt: NOW })] });
    const r = await createApproveVariantSpecUseCase(already.deps).execute(owner, input);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CONFLICT");
  });

  it("承認できたら、承認した人を書き込んで保存する", async () => {
    const fresh = depsOf({ specs: [aSpec({ approvedBy: null, approvedAt: null })] });
    const r = await createApproveVariantSpecUseCase(fresh.deps).execute(owner, input);

    expect(r.ok && r.value.message).toContain("比較に使えます");
    expect(fresh.saved.specs[0].spec.approvedBy).toBe("user-owner");
    expect(fresh.saved.audits[0].action).toBe("variant_spec.approved");
  });
});

describe("比較を始める", () => {
  const base = {
    siteSlug: "blog-a",
    baselineSpecId: "vs-base",
    candidateSpecId: "vs-cand",
    primaryMetric: "scroll_depth_p50",
  };
  const pair = [
    aSpec(),
    aSpec({
      id: "vs-cand",
      label: "比較を先に",
      settings: [{ dimensionKey: "section_order", value: "comparison_first" }],
    }),
  ];

  it("見る指標が決まっていなければ、始めさせない", async () => {
    const r = await createStartLoopRunUseCase(depsOf({ specs: pair }).deps).execute(owner, {
      ...base,
      primaryMetric: "なんとなく良さそうか",
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("primaryMetric");
  });

  it("比べる相手が見つからなければ断る", async () => {
    const r = await createStartLoopRunUseCase(depsOf({ specs: [aSpec()] }).deps).execute(owner, base);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("specId");
  });

  it("一度に変えている軸が多すぎる組み合わせは、始める前に断る", async () => {
    const tooMany = depsOf({
      specs: [
        aSpec({ settings: [] as never }),
        aSpec({
          id: "vs-cand",
          settings: [
            { dimensionKey: "section_order", value: "comparison_first" },
            { dimensionKey: "lead_length", value: 200 },
            { dimensionKey: "cta_position", value: "bottom" },
          ],
        }),
      ],
    });
    const r = await createStartLoopRunUseCase(tooMany.deps).execute(owner, base);

    expect(r.ok).toBe(false);
    expect(tooMany.saved.runs).toHaveLength(0);
  });

  it("始められたら、何を変えた比較かと、必要な件数を文面で言う", async () => {
    const ready = depsOf({ specs: pair });
    const r = await createStartLoopRunUseCase(ready.deps).execute(owner, {
      ...base,
      minimumSamples: 50,
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.message).toContain("節の並び");
      expect(r.value.message).toContain("50 件");
    }
    expect(ready.saved.runs[0].status).toBe("running");
    expect(ready.saved.audits[0].action).toBe("loop_run.started");
  });

  it("件数を書かなければ、既定の件数で始まる", async () => {
    const ready = depsOf({ specs: pair });
    await createStartLoopRunUseCase(ready.deps).execute(owner, base);

    // 0 件でも判定できる、という状態を作らせない。
    expect(ready.saved.runs[0].minimumSamples).toBeGreaterThan(0);
  });

  it("保存が落ちたら、始まったことにしない", async () => {
    const broken = depsOf({ specs: pair, breaks: { saveRun: true } });
    const r = await createStartLoopRunUseCase(broken.deps).execute(owner, base);

    expect(r.ok).toBe(false);
    expect(broken.saved.audits).toHaveLength(0);
  });
});

describe("観測値を書く", () => {
  const values = {
    runId: "run-1",
    baselineValue: 0.4,
    baselineSamples: 400,
    candidateValue: 0.5,
    candidateSamples: 410,
  };

  it("権限が無ければ、観測値も保存しない", async () => {
    const r = await createRecordLoopObservationUseCase(d.deps).execute(nobody, values);

    expect(r.ok).toBe(false);
    expect(d.saved.observations).toHaveLength(0);
  });

  it("観測した時刻は、呼び出し側ではなく時計から入れる", async () => {
    const r = await createRecordLoopObservationUseCase(d.deps).execute(owner, values);

    expect(r.ok).toBe(true);
    expect(d.saved.observations[0].observedAt).toEqual(NOW);
    expect(d.saved.audits[0].action).toBe("loop_run.observed");
  });

  it("保存が落ちたら、記録も残さない", async () => {
    const broken = depsOf({ breaks: { saveObservation: true } });
    const r = await createRecordLoopObservationUseCase(broken.deps).execute(owner, values);

    expect(r.ok).toBe(false);
    expect(broken.saved.audits).toHaveLength(0);
  });
});

describe("判定する", () => {
  const enough = {
    runId: "run-1",
    baselineValue: 0.4,
    baselineSamples: 400,
    candidateValue: 0.6,
    candidateSamples: 410,
  };

  it("権限が無ければ断る", async () => {
    const r = await createConcludeLoopRunUseCase(d.deps).execute(nobody, { runId: "run-1" });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
  });

  it("その比較が無ければ、欄を名指しして断る", async () => {
    const r = await createConcludeLoopRunUseCase(depsOf({ runs: [] }).deps).execute(owner, {
      runId: "run-1",
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("runId");
  });

  it("観測値がまだ無いなら、判定させない", async () => {
    const noObs = depsOf({ runs: [aRun()], observation: null });
    const r = await createConcludeLoopRunUseCase(noObs.deps).execute(owner, { runId: "run-1" });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("runId");
    expect(noObs.saved.runs).toHaveLength(0);
  });

  it("件数が足りない比較は、判定保留のまま終わらせない", async () => {
    const few = depsOf({
      runs: [aRun()],
      observation: { ...enough, baselineSamples: 10, candidateSamples: 10 },
    });
    const r = await createConcludeLoopRunUseCase(few.deps).execute(owner, { runId: "run-1" });

    expect(r.ok).toBe(false);
    expect(few.saved.runs).toHaveLength(0);
  });

  it("差が十分なら、勝ち負けを判定して保存する", async () => {
    const ready = depsOf({ runs: [aRun()], observation: enough });
    const r = await createConcludeLoopRunUseCase(ready.deps).execute(owner, { runId: "run-1" });

    expect(r.ok && r.value.verdict).toBe("improved");
    expect(ready.saved.runs[0].status).toBe("concluded");
    expect(ready.saved.audits[0].reason).toBe(r.ok ? r.value.message : null);
  });

  it("同時に走っている比較の数だけ、必要な件数を厳しくする", async () => {
    // 250 件は 1 本なら足りる（必要 100 件）。3 本同時だと必要 300 件になり、
    // 同じ観測値のまま「まだ言えない」に倒れる。
    const many = depsOf({
      runs: [aRun(), aRun({ id: "run-2" as ExperimentId }), aRun({ id: "run-3" as ExperimentId })],
      observation: { ...enough, baselineSamples: 250, candidateSamples: 250 },
    });
    const r = await createConcludeLoopRunUseCase(many.deps).execute(owner, { runId: "run-1" });

    expect(r.ok).toBe(false);
    expect(many.saved.runs).toHaveLength(0);
  });

  it("打ち切られた比較は、同時進行として数えない", async () => {
    const stopped = depsOf({
      runs: [aRun(), aRun({ id: "run-2" as ExperimentId, status: "stopped", stoppedReason: "季節" })],
      observation: enough,
    });
    const r = await createConcludeLoopRunUseCase(stopped.deps).execute(owner, { runId: "run-1" });

    expect(r.ok).toBe(true);
  });
});

describe("打ち切る", () => {
  it("権限が無ければ断る", async () => {
    const r = await createStopLoopRunUseCase(d.deps).execute(nobody, {
      runId: "run-1",
      reason: "季節要因",
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
  });

  it("理由の無い打ち切りは残せない", async () => {
    const ready = depsOf({ runs: [aRun()] });
    const r = await createStopLoopRunUseCase(ready.deps).execute(owner, {
      runId: "run-1",
      reason: "   ",
    });

    expect(r.ok).toBe(false);
    expect(ready.saved.runs).toHaveLength(0);
  });

  it("打ち切ったら、理由まで記録に残す", async () => {
    const ready = depsOf({ runs: [aRun()] });
    const r = await createStopLoopRunUseCase(ready.deps).execute(owner, {
      runId: "run-1",
      reason: "季節要因で読者数が読めない",
    });

    expect(r.ok).toBe(true);
    expect(ready.saved.runs[0].status).toBe("stopped");
    expect(ready.saved.audits[0].reason).toBe("季節要因で読者数が読めない");
  });

  it("一覧が読めないときは、その断りをそのまま返す", async () => {
    const broken = depsOf({ breaks: { listRuns: true } });
    const r = await createStopLoopRunUseCase(broken.deps).execute(owner, {
      runId: "run-1",
      reason: "季節要因",
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});

/**
 * 保存は済んだが、記録が落ちたとき。
 *
 * 成功でも失敗でもない**第三の結末**で、6 つの入口すべてが同じ形を取る。
 * `err` を返すが、**保存は巻き戻さない**。巻き戻す方が一見きれいだが、
 * 記録先の不調のたびに承認や判定が消えることになり、被害が大きい。
 *
 * 画面には失敗と出るのに保存は済んでいる、というこの食い違いを
 * 利用者へ伝える唯一の手がかりが `doneAlready` の一文なので、
 * 「何が済んでいるか」まで含めて固定する。
 */
describe("保存は済んだが、記録が落ちたとき", () => {
  const pair = [
    aSpec(),
    aSpec({
      id: "vs-cand",
      settings: [{ dimensionKey: "section_order", value: "comparison_first" }],
    }),
  ];
  const observation = {
    runId: "run-1",
    baselineValue: 0.4,
    baselineSamples: 400,
    candidateValue: 0.6,
    candidateSamples: 410,
  };

  const ENTRIES = [
    {
      name: "試作の登録",
      setup: {} as Setup,
      run: (deps: ReturnType<typeof depsOf>["deps"]) =>
        createDraftVariantSpecUseCase(deps).execute(owner, {
          siteSlug: "blog-a",
          label: "結論を先に",
          settings: [{ dimensionKey: "section_order", value: "conclusion_first" }],
        }),
      doneAlready: "「結論を先に」の登録は済んでいます",
      stored: (saved: ReturnType<typeof depsOf>["saved"]) => saved.specs,
    },
    {
      name: "試作の承認",
      setup: { specs: [aSpec({ label: "結論を先に", approvedBy: null, approvedAt: null })] },
      run: (deps: ReturnType<typeof depsOf>["deps"]) =>
        createApproveVariantSpecUseCase(deps).execute(owner, {
          siteSlug: "blog-a",
          specId: "vs-base",
        }),
      doneAlready: "「結論を先に」の承認は済んでいます",
      stored: (saved: ReturnType<typeof depsOf>["saved"]) => saved.specs,
    },
    {
      name: "比較の開始",
      setup: { specs: pair },
      run: (deps: ReturnType<typeof depsOf>["deps"]) =>
        createStartLoopRunUseCase(deps).execute(owner, {
          siteSlug: "blog-a",
          baselineSpecId: "vs-base",
          candidateSpecId: "vs-cand",
          primaryMetric: "scroll_depth_p50",
        }),
      doneAlready: "比較はもう始まっています",
      stored: (saved: ReturnType<typeof depsOf>["saved"]) => saved.runs,
    },
    {
      name: "観測値の記録",
      setup: {},
      run: (deps: ReturnType<typeof depsOf>["deps"]) =>
        createRecordLoopObservationUseCase(deps).execute(owner, observation),
      doneAlready: "観測値の記録は済んでいます",
      stored: (saved: ReturnType<typeof depsOf>["saved"]) => saved.observations,
    },
    {
      name: "比較の判定",
      setup: { runs: [aRun()], observation },
      run: (deps: ReturnType<typeof depsOf>["deps"]) =>
        createConcludeLoopRunUseCase(deps).execute(owner, { runId: "run-1" }),
      doneAlready: "判定は済んでいます",
      stored: (saved: ReturnType<typeof depsOf>["saved"]) => saved.runs,
    },
    {
      name: "比較の打ち切り",
      setup: { runs: [aRun()] },
      run: (deps: ReturnType<typeof depsOf>["deps"]) =>
        createStopLoopRunUseCase(deps).execute(owner, {
          runId: "run-1",
          reason: "季節要因で読者数が読めない",
        }),
      doneAlready: "この比較の打ち切りは済んでいます",
      stored: (saved: ReturnType<typeof depsOf>["saved"]) => saved.runs,
    },
  ] as const;

  it.each(ENTRIES)("$name — 済んだことを言って断る", async (entry) => {
    const broken = depsOf({ ...entry.setup, breaks: { audit: true } });
    const r = await entry.run(broken.deps);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      // やり直せる断りにする。同じ操作をもう一度押せば記録だけが残る。
      expect(r.error.code).toBe("UPSTREAM_UNAVAILABLE");
      expect(r.error.retryable).toBe(true);
      expect(r.error.message).toContain(entry.doneAlready);
      // 記録先が落ちた、という手がかりを畳んで消さない。
      expect(r.error.details).toEqual({ where: "auditLog" });
    }
    // **巻き戻さない。** 断りが返っても、保存は済んだままである。
    expect(entry.stored(broken.saved)).toHaveLength(1);
  });
});
