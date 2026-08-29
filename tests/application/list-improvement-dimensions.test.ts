/**
 * @tier 1
 * @req REQ-P10, REQ-FD02
 * @types equivalence, decision-table
 *
 * 「何を変えて試せるか」の一覧（`list-improvement-dimensions.ts`）。
 *
 * 2026-08-17 の実測で生き残り 72 変異、**テストファイル 0 件**。
 * ここは画面が読む唯一の口なので、空のままだと
 * 「登録表には有るのに画面から消えている」「触ってはいけない軸が選べる」
 * が起きても誰も気づけない。
 *
 * 固定したいこと。
 *   1. **登録表を 1 件も落とさずに写す。** 画面に書き起こさない、の裏返し。
 *   2. **触ってはいけないものを同じ画面に出す。** 別ページに分けると読まれない。
 *   3. **保存先が落ちても一覧は出す。** ただし「無い」と「読めない」を混ぜない。
 *   4. **止まっているループを動いていると見せない。**
 */
import { describe, expect, it } from "vitest";
import type { ImprovementRepositoryPort } from "@/application/ports/improvement";
import { createListImprovementDimensionsUseCase } from "@/application/usecases/improvement/list-improvement-dimensions";
import {
  LOOP_KINDS,
  type LoopRun,
  MAX_SIMULTANEOUS_DIMENSIONS,
  NON_OPTIMIZABLE,
  OPTIMIZATION_DIMENSIONS,
  OPTIMIZATION_GROUPS,
  OPTIMIZATION_GROUP_LABELS,
  type VariantSpec,
  explainVariantSpec,
  metricDefinition,
} from "@/domain/analytics";
import {
  type ExperimentId,
  type WorkspaceId,
  domainError,
  err,
  ok,
} from "@/domain/shared";
import { WORKSPACE, aNobody, anAnalyst } from "../support/actors";

const analyst = anAnalyst({ workspaceId: WORKSPACE });

function aRun(over: Partial<LoopRun> = {}): LoopRun {
  return {
    id: "run-1" as ExperimentId,
    workspaceId: WORKSPACE,
    loopKindKey: "content_improvement",
    siteSlug: "blog-a",
    baselineSpecId: "vs-1",
    candidateSpecId: "vs-2",
    changedDimensions: ["section_order"],
    primaryMetric: "scroll_depth_p50",
    minimumSamples: 100,
    status: "running",
    startedAt: new Date("2026-06-01T00:00:00.000Z"),
    concludedAt: null,
    verdict: null,
    stoppedReason: null,
    ...over,
  };
}

function aSpec(over: Partial<VariantSpec> = {}): VariantSpec {
  return {
    id: "vs-1",
    label: "結論を先に出す版",
    settings: [{ dimensionKey: "section_order", value: "conclusion_first" }],
    provenance: { sourceKind: "human", sourceName: "編集部" },
    approvedBy: null,
    approvedAt: null,
    ...over,
  } as VariantSpec;
}

type Setup = {
  runs?: readonly LoopRun[];
  runsFail?: boolean;
  specs?: readonly VariantSpec[];
  specsFail?: boolean;
};

function depsOf(setup: Setup = {}) {
  const calls: { runs: unknown[]; specs: unknown[] } = { runs: [], specs: [] };
  const notUsed = () => {
    throw new Error("このテストでは呼ばれません");
  };
  const repository: ImprovementRepositoryPort = {
    saveVariantSpec: notUsed,
    saveRun: notUsed,
    observationsOf: notUsed,
    saveObservation: notUsed,
    async listRuns(workspaceId: WorkspaceId, input) {
      calls.runs.push({ workspaceId, input });
      if (setup.runsFail) return err(domainError("UPSTREAM_UNAVAILABLE", "記録を読めません。"));
      return ok(setup.runs ?? []);
    },
    async listVariantSpecs(workspaceId: WorkspaceId, input) {
      calls.specs.push({ workspaceId, input });
      if (setup.specsFail) return err(domainError("UPSTREAM_UNAVAILABLE", "設定を読めません。"));
      return ok(setup.specs ?? []);
    },
  };
  return { repository, calls };
}

async function list(setup: Setup = {}, input: { siteSlug?: string } = {}) {
  const { repository, calls } = depsOf(setup);
  const r = await createListImprovementDimensionsUseCase({ repository }).execute(analyst, input);
  if (!r.ok) throw new Error(r.error.message);
  return { view: r.value, calls };
}

function allRows(view: Awaited<ReturnType<typeof list>>["view"]) {
  return view.groups.flatMap((g) => g.dimensions);
}

describe("見られる人", () => {
  it("数字を見る権限が無ければ断る", async () => {
    const { repository } = depsOf();
    const r = await createListImprovementDimensionsUseCase({ repository }).execute(
      aNobody({ workspaceId: WORKSPACE }),
      {},
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
  });

  it("権限が無いときは、保存先を読みに行かない", async () => {
    const { repository, calls } = depsOf();
    await createListImprovementDimensionsUseCase({ repository }).execute(
      aNobody({ workspaceId: WORKSPACE }),
      {},
    );
    expect(calls.runs).toHaveLength(0);
    expect(calls.specs).toHaveLength(0);
  });
});

describe("登録表を落とさずに写す", () => {
  it("軸を 1 つも落とさない", async () => {
    const { view } = await list();
    expect(allRows(view).map((d) => d.key).sort()).toEqual(
      OPTIMIZATION_DIMENSIONS.map((d) => d.key).sort(),
    );
  });

  it("まとまりを 1 つも落とさず、登録の順で返す", async () => {
    const { view } = await list();
    expect(view.groups.map((g) => g.group)).toEqual([...OPTIMIZATION_GROUPS]);
    for (const g of view.groups) {
      expect(g.label).toBe(OPTIMIZATION_GROUP_LABELS[g.group]);
      expect(g.dimensions.length, g.group).toBeGreaterThan(0);
    }
  });

  it("軸は、属するまとまりの中だけに出す", async () => {
    // 全部を全まとまりに入れても件数は増えるだけなので、所属も見る。
    const { view } = await list();
    for (const g of view.groups) {
      for (const d of g.dimensions) {
        expect(d.group, d.key).toBe(g.group);
        expect(d.groupLabel, d.key).toBe(OPTIMIZATION_GROUP_LABELS[g.group]);
      }
    }
  });

  it("案の出どころは、そのままの語ではなく日本語の説明で返す", async () => {
    const { view } = await list();
    const labels = new Set(allRows(view).map((d) => d.candidateSourceLabel));
    expect(labels.has("preset")).toBe(false);
    for (const d of allRows(view)) {
      expect(d.candidateSourceLabel, d.key).not.toBe("");
    }
  });

  it("何で良し悪しを見るかは、指標の表示名に直して返す", async () => {
    const { view } = await list();
    for (const d of allRows(view)) {
      expect(d.metricLabels, d.key).toEqual(d.evaluatedBy.map((m) => metricDefinition(m).label));
      expect(d.metricLabels.length, d.key).toBeGreaterThan(0);
    }
  });

  it("触ってはいけないものを、同じ画面に理由つきで出す", async () => {
    const { view } = await list();
    expect(view.nonOptimizable.map((n) => n.label)).toEqual(NON_OPTIMIZABLE.map((n) => n.label));
    for (const n of view.nonOptimizable) {
      expect(n.reason.length, n.label).toBeGreaterThan(0);
    }
  });

  it("触ってはいけないものが、選べる軸として混ざらない", async () => {
    const { view } = await list();
    const keys = new Set(allRows(view).map((d) => d.key));
    for (const n of NON_OPTIMIZABLE) {
      expect(keys.has(n.key), n.key).toBe(false);
    }
  });

  it("同時に変えてよい数を、決めごとから取る", async () => {
    const { view } = await list();
    expect(view.maxSimultaneous).toBe(MAX_SIMULTANEOUS_DIMENSIONS);
  });
});

describe("いま何を試しているか", () => {
  it("一度も試していない軸は、そのことが分かる", async () => {
    const { view } = await list();
    expect(allRows(view).every((d) => d.neverTried)).toBe(true);
    expect(allRows(view).every((d) => d.runningCount === 0 && d.concludedCount === 0)).toBe(true);
  });

  it("実施中と判定済みを、別々に数える", async () => {
    const { view } = await list({
      runs: [
        aRun({ status: "running" }),
        aRun({ id: "run-2" as ExperimentId, status: "concluded" }),
        aRun({ id: "run-3" as ExperimentId, status: "concluded" }),
      ],
    });
    const row = allRows(view).find((d) => d.key === "section_order");
    expect(row?.runningCount).toBe(1);
    expect(row?.concludedCount).toBe(2);
    expect(row?.neverTried).toBe(false);
  });

  it("打ち切った回は、実施中にも判定済みにも数えない", async () => {
    // 打ち切りを実施中に混ぜると、止めたはずの試行が動いて見える。
    const { view } = await list({ runs: [aRun({ status: "stopped" })] });
    const row = allRows(view).find((d) => d.key === "section_order");
    expect(row?.runningCount).toBe(0);
    expect(row?.concludedCount).toBe(0);
    expect(row?.neverTried).toBe(false);
  });

  it("数えるのは、その回で変えた軸だけ", async () => {
    const { view } = await list({ runs: [aRun({ changedDimensions: ["lead_length"] })] });
    expect(allRows(view).find((d) => d.key === "lead_length")?.runningCount).toBe(1);
    expect(allRows(view).find((d) => d.key === "section_order")?.runningCount).toBe(0);
  });

  it("ブログを指定したら、その指定を保存先へ渡す", async () => {
    const { calls } = await list({}, { siteSlug: "blog-a" });
    expect(calls.runs).toEqual([{ workspaceId: WORKSPACE, input: { siteSlug: "blog-a" } }]);
    expect(calls.specs).toEqual([{ workspaceId: WORKSPACE, input: { siteSlug: "blog-a" } }]);
  });

  it("記録が読めなくても、軸の一覧は出す", async () => {
    // 一覧が出ないと、記録の不調が「軸が無い」に見える。
    const { view } = await list({ runsFail: true });
    expect(allRows(view).length).toBe(OPTIMIZATION_DIMENSIONS.length);
    expect(allRows(view).every((d) => d.neverTried)).toBe(true);
  });
});

describe("ループの一覧", () => {
  it("登録されたループを 1 つも落とさない", async () => {
    const { view } = await list();
    expect(view.loops.map((l) => l.key)).toEqual(LOOP_KINDS.map((l) => l.key));
  });

  it("動いていないループを、動いていると見せない", async () => {
    const { view } = await list();
    for (const loop of view.loops) {
      const source = LOOP_KINDS.find((k) => k.key === loop.key);
      expect(loop.implemented, loop.key).toBe(source?.readiness === "implemented");
      expect(loop.readinessLabel, loop.key).toBe(
        source?.readiness === "implemented" ? "動いています" : "まだ動きません",
      );
    }
    expect(view.loops.some((l) => !l.implemented)).toBe(true);
    expect(view.loops.some((l) => l.implemented)).toBe(true);
  });

  it("動かせないループには、何が揃えば動くかを添える", async () => {
    const { view } = await list();
    for (const loop of view.loops.filter((l) => !l.implemented)) {
      expect(loop.blockedBy, loop.key).toBeTruthy();
    }
  });

  it("外せない歯止めと、目安の歯止めを混ぜない", async () => {
    // 混ぜると、外してよいものと駄目なものの区別が画面から消える。
    const { view } = await list();
    for (const loop of view.loops) {
      const source = LOOP_KINDS.find((k) => k.key === loop.key);
      expect(loop.hardGuardrails, loop.key).toEqual(
        source?.guardrails.filter((g) => g.hard).map((g) => g.label),
      );
      expect(loop.softGuardrails, loop.key).toEqual(
        source?.guardrails.filter((g) => !g.hard).map((g) => g.label),
      );
      expect(loop.hardGuardrails.length, loop.key).toBeGreaterThan(0);
      for (const soft of loop.softGuardrails) {
        expect(loop.hardGuardrails, loop.key).not.toContain(soft);
      }
    }
  });

  it("何をもって決めるかと、どちら向きの改善かを日本語で返す", async () => {
    const { view } = await list();
    for (const loop of view.loops) {
      expect(loop.decisionBasisLabel, loop.key).not.toBe("");
      expect(loop.decisionBasisLabel, loop.key).not.toMatch(/^[a-z_]+$/);
      expect(loop.polarityLabel, loop.key).not.toMatch(/^[a-z_]+$/);
    }
  });

  it("止める条件と決め方と承認者を、そのまま持って返す", async () => {
    const { view } = await list();
    for (const loop of view.loops) {
      const source = LOOP_KINDS.find((k) => k.key === loop.key);
      expect(loop.stopConditions, loop.key).toEqual(source?.stopConditions);
      expect(loop.decisionRule, loop.key).toBe(source?.decisionRule);
      expect(loop.approver, loop.key).toBe(source?.approver);
      expect(loop.signal, loop.key).toBe(source?.signal);
      expect(loop.stopConditions.length, loop.key).toBeGreaterThan(0);
    }
  });
});

describe("見せ方の設定", () => {
  it("登録済みの設定を、説明文つきで返す", async () => {
    const spec = aSpec();
    const { view } = await list({ specs: [spec] });
    expect(view.specs).toEqual([
      { id: spec.id, label: spec.label, explanation: explainVariantSpec(spec), approved: false },
    ]);
    expect(view.specsEmptyReason).toBeNull();
  });

  it("承認済みかどうかを、承認者の有無で決める", async () => {
    // ここが常に true になると、未承認の設定が適用できるものとして並ぶ。
    const { view } = await list({
      specs: [
        aSpec({ id: "vs-1", approvedBy: null }),
        aSpec({ id: "vs-2", approvedBy: "編集長", approvedAt: new Date("2026-06-01") }),
      ],
    });
    expect(view.specs.map((s) => s.approved)).toEqual([false, true]);
  });

  it("1 件も無いときは「まだ無い」と伝える", async () => {
    const { view } = await list({ specs: [] });
    expect(view.specs).toHaveLength(0);
    expect(view.specsEmptyReason).toBe("まだ登録された見せ方の設定がありません。");
  });

  it("読めなかったときは「無い」ではなく「読めない」と伝える", async () => {
    // ここを「まだ無い」にすると、不調のときに設定を作り直す人が出る。
    const { view } = await list({ specsFail: true });
    expect(view.specsEmptyReason).toContain("読み出せません");
    expect(view.specsEmptyReason).toContain("設定を読めません");
  });

  it("設定が読めなくても、呼び出し自体は成功する", async () => {
    const { repository } = depsOf({ specsFail: true, runsFail: true });
    const r = await createListImprovementDimensionsUseCase({ repository }).execute(analyst, {});
    expect(r.ok).toBe(true);
  });
});
