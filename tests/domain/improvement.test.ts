/**
 * @tier 1
 * @req REQ-IM01, REQ-IM02, REQ-IM03, REQ-IM04, REQ-IM07, REQ-IM08, REQ-IM09, REQ-IM10, REQ-IM11, REQ-IM12
 * @types equivalence, boundary, decision-table, state-transition
 *
 * 印を 1 行に収めてあるのは、`scripts/required-test-types.mjs` の `@req` の
 * 読み取りが `*` で止まるためで、折り返すと 2 行目の要件が黙って落ちる。
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_MINIMUM_SAMPLES,
  LOOP_KINDS,
  MAX_SIMULTANEOUS_DIMENSIONS,
  NON_OPTIMIZABLE,
  OPTIMIZATION_DIMENSIONS,
  UNIVERSAL_GUARDRAILS,
  approveVariantSpec,
  assertComparable,
  assertRegistrable,
  buildSuggestions,
  concludeLoopRun,
  createLoopRun,
  createVariantSpec,
  diffVariantSpecs,
  explainVariantSpec,
  findOptimizationDimension,
  implementedLoopKinds,
  judgeComparison,
  plannedLoopKinds,
  registerLoopKind,
  startLoopRun,
  stopLoopRun,
  type OptimizationDimension,
  type VariantSpec,
} from "@/domain/analytics";
import { asExperimentId, asWorkspaceId, type Provenance } from "@/domain/shared";

/**
 * 改善ループの決まりを、機械で確かめる。
 *
 * ここで守っているのは主に 3 つ。
 *   1. 変えてはいけないものを軸にできない（人のレビューに任せない）
 *   2. 件数が足りないうちは「差がある」と言わせない
 *   3. 軸が増えてもループ本体が変わらない
 *
 * 3 は「軸を 1 つ足しても、このファイルのループに関する試験が
 * 1 行も変わらない」ことで確かめる。
 */

const PROV: Provenance = {
  sourceType: "manual",
  sourceName: "試験",
  sourceUrl: null,
  retrievedAt: new Date("2026-08-01T00:00:00Z"),
  validUntil: null,
  confidence: 1,
  permittedUsage: "試験",
};

function spec(id: string, settings: readonly { dimensionKey: string; value: string | number }[]) {
  const made = createVariantSpec({ id, label: id, settings, provenance: PROV });
  if (!made.ok) throw new Error(made.error.message);
  return made.value;
}

function approved(s: VariantSpec): VariantSpec {
  const r = approveVariantSpec(s, { approvedBy: "編集の責任者", at: new Date() });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe("改善の軸の登録", () => {
  it("登録済みの軸はすべて登録条件を満たす", () => {
    for (const d of OPTIMIZATION_DIMENSIONS) {
      const r = assertRegistrable(d);
      expect(r.ok, `${d.key} が登録条件を満たしていない`).toBe(true);
    }
  });

  it("軸の呼び名は重複しない", () => {
    const keys = OPTIMIZATION_DIMENSIONS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("調整してはいけないものは、どれも軸にできない", () => {
    for (const banned of NON_OPTIMIZABLE) {
      const attempt: OptimizationDimension = {
        key: banned.key,
        label: banned.label,
        group: "text",
        why: "数字が良くなるから",
        candidateSource: "preset",
        appliedAt: "prompt",
        evaluatedBy: ["read_completion_rate"],
        feedbackTarget: "article_revision",
        reversible: true,
      };
      const r = assertRegistrable(attempt);
      expect(r.ok, `${banned.key} が軸として通ってしまった`).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("INVARIANT_VIOLATED");
    }
  });

  it("順位づけ・推奨・合格ラインへ戻す軸は登録できない", () => {
    for (const target of ["ranking_score", "product_recommendation", "quality_threshold"] as const) {
      const attempt: OptimizationDimension = {
        key: `axis_${target}`,
        label: "抜け道",
        group: "text",
        why: "順位を数字で動かしたい",
        candidateSource: "preset",
        appliedAt: "prompt",
        evaluatedBy: ["read_completion_rate"],
        feedbackTarget: target,
        reversible: true,
      };
      const r = assertRegistrable(attempt);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("COMMERCIAL_INPUT_REJECTED");
    }
  });

  it("収益の指標で見る軸は、記事の書き直し以外へ戻せない", () => {
    // 改善ループが順位づけへの迂回路にならないことの確認。
    const attempt: OptimizationDimension = {
      key: "revenue_driven",
      label: "売れ方で決める",
      group: "text",
      why: "売上を上げたい",
      candidateSource: "preset",
      appliedAt: "prompt",
      evaluatedBy: ["revenue_amount"],
      feedbackTarget: "ranking_score",
      reversible: true,
    };
    const r = assertRegistrable(attempt);
    expect(r.ok).toBe(false);
  });

  it("見る指標が決まっていない軸は登録できない", () => {
    const attempt: OptimizationDimension = {
      key: "no_metric",
      label: "指標なし",
      group: "text",
      why: "なんとなく",
      candidateSource: "preset",
      appliedAt: "prompt",
      evaluatedBy: [],
      feedbackTarget: "article_revision",
      reversible: true,
    };
    expect(assertRegistrable(attempt).ok).toBe(false);
  });
});

describe("見せ方の設定", () => {
  it("登録されていない軸は設定に入れられない", () => {
    const r = createVariantSpec({
      id: "s",
      label: "s",
      settings: [{ dimensionKey: "unknown_axis", value: "x" }],
      provenance: PROV,
    });
    expect(r.ok).toBe(false);
  });

  it("数値で決める軸に文字を入れられない", () => {
    const numeric = OPTIMIZATION_DIMENSIONS.find((d) => d.candidateSource === "numeric");
    expect(numeric).toBeDefined();
    const r = createVariantSpec({
      id: "s",
      label: "s",
      settings: [{ dimensionKey: numeric!.key, value: "短め" }],
      provenance: PROV,
    });
    expect(r.ok).toBe(false);
  });

  it("同じ軸を 2 回指定できない", () => {
    const r = createVariantSpec({
      id: "s",
      label: "s",
      settings: [
        { dimensionKey: "section_order", value: "結論が先" },
        { dimensionKey: "section_order", value: "比較が先" },
      ],
      provenance: PROV,
    });
    expect(r.ok).toBe(false);
  });

  it("承認していない設定は、承認していないと分かる形で出る", () => {
    const s = spec("s", [{ dimensionKey: "section_order", value: "結論が先" }]);
    expect(explainVariantSpec(s)).toContain("未承認");
    expect(explainVariantSpec(approved(s))).toContain("編集の責任者 が承認");
  });

  it("同時に変えてよい数を超える比較は始める前に止まる", () => {
    const base = spec("base", [
      { dimensionKey: "section_order", value: "結論が先" },
      { dimensionKey: "lead_length", value: 240 },
      { dimensionKey: "brand_theme", value: "graphite-amber" },
    ]);
    const cand = spec("cand", [
      { dimensionKey: "section_order", value: "比較が先" },
      { dimensionKey: "lead_length", value: 120 },
      { dimensionKey: "brand_theme", value: "indigo-clay" },
    ]);
    expect(diffVariantSpecs(base, cand)).toHaveLength(3);
    const r = assertComparable(base, cand);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INVARIANT_VIOLATED");
    expect(MAX_SIMULTANEOUS_DIMENSIONS).toBe(2);
  });

  it("差が無い 2 つは比べられない", () => {
    const base = spec("base", [{ dimensionKey: "section_order", value: "結論が先" }]);
    const same = spec("same", [{ dimensionKey: "section_order", value: "結論が先" }]);
    expect(assertComparable(base, same).ok).toBe(false);
  });
});

describe("判定", () => {
  const common = {
    metric: "read_completion_rate" as const,
    minimumSamples: DEFAULT_MINIMUM_SAMPLES,
    comparisonCount: 1,
  };

  it("件数が足りないうちは判定保留にする", () => {
    const r = judgeComparison({
      ...common,
      baselineValue: 0.4,
      baselineSamples: 500,
      candidateValue: 0.9,
      candidateSamples: 12,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // 差が 2 倍以上あっても、件数が足りなければ何も言わない。
      expect(r.value.verdict).toBe("pending");
      expect(r.value.relativeChange).toBeNull();
    }
  });

  it("同時に見ている比較が多いほど、必要な件数が増える", () => {
    const one = judgeComparison({ ...common, baselineValue: 0.4, baselineSamples: 400, candidateValue: 0.5, candidateSamples: 400 });
    const many = judgeComparison({
      ...common,
      comparisonCount: 5,
      baselineValue: 0.4,
      baselineSamples: 400,
      candidateValue: 0.5,
      candidateSamples: 400,
    });
    expect(one.ok && many.ok).toBe(true);
    if (one.ok && many.ok) {
      expect(many.value.requiredSamples).toBeGreaterThan(one.value.requiredSamples);
      expect(many.value.requiredEffect).toBeGreaterThan(one.value.requiredEffect);
      // 同じ数字でも、5 個を同時に見ていれば判定しない。
      expect(one.value.verdict).toBe("improved");
      expect(many.value.verdict).toBe("pending");
    }
  });

  it("差が小さいときは効果不明と言う（良くなったとは言わない）", () => {
    const r = judgeComparison({
      ...common,
      baselineValue: 0.4,
      baselineSamples: 900,
      candidateValue: 0.408,
      candidateSamples: 900,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.verdict).toBe("unclear");
  });

  it("下がったときは悪くなったと言う", () => {
    const r = judgeComparison({
      ...common,
      baselineValue: 0.4,
      baselineSamples: 900,
      candidateValue: 0.3,
      candidateSamples: 900,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.verdict).toBe("worsened");
  });

  it("判定できないときでも次の一手は記録される", () => {
    const base = spec("base", [{ dimensionKey: "section_order", value: "結論が先" }]);
    const cand = spec("cand", [{ dimensionKey: "section_order", value: "比較が先" }]);
    const judged = judgeComparison({
      ...common,
      baselineValue: 0.4,
      baselineSamples: 10,
      candidateValue: 0.5,
      candidateSamples: 10,
    });
    expect(judged.ok).toBe(true);
    if (!judged.ok) return;
    const suggestions = buildSuggestions(diffVariantSpecs(base, cand), [judged.value]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.verdict).toBe("pending");
    // 見た目だけの変更でも承認が要る、を型と値の両方で固定する。
    expect(suggestions[0]?.requiresApproval).toBe(true);
  });
});

describe("ループの 1 周", () => {
  const WS = asWorkspaceId("ws_test");
  const base = spec("base", [{ dimensionKey: "section_order", value: "結論が先" }]);
  const cand = spec("cand", [{ dimensionKey: "section_order", value: "比較が先" }]);

  function draft() {
    const diffs = diffVariantSpecs(base, cand);
    return createLoopRun({
      id: asExperimentId("run_test"),
      workspaceId: WS,
      loopKindKey: "content_improvement",
      siteSlug: "sample",
      baselineSpecId: base.id,
      candidateSpecId: cand.id,
      diffs,
      primaryMetric: "read_completion_rate",
      minimumSamples: DEFAULT_MINIMUM_SAMPLES,
    });
  }

  it("まだ動かないループでは始められない", () => {
    const planned = plannedLoopKinds()[0];
    expect(planned).toBeDefined();
    const r = createLoopRun({
      id: asExperimentId("run_planned"),
      workspaceId: WS,
      loopKindKey: planned!.key,
      siteSlug: "sample",
      baselineSpecId: base.id,
      candidateSpecId: cand.id,
      diffs: diffVariantSpecs(base, cand),
      primaryMetric: "read_completion_rate",
      minimumSamples: 200,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("NOT_IMPLEMENTED");
      // 「いつ動くか」が分かる形で断る。
      expect(r.error.suggestedAction).toBeTruthy();
    }
  });

  it("件数が足りないまま終わらせられない", () => {
    const made = draft();
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const started = startLoopRun(made.value, new Date());
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const judged = judgeComparison({
      metric: "read_completion_rate",
      baselineValue: 0.4,
      baselineSamples: 20,
      candidateValue: 0.6,
      candidateSamples: 20,
      minimumSamples: DEFAULT_MINIMUM_SAMPLES,
      comparisonCount: 1,
    });
    expect(judged.ok).toBe(true);
    if (!judged.ok) return;

    const concluded = concludeLoopRun(started.value, { result: judged.value, at: new Date() });
    expect(concluded.ok).toBe(false);
    if (!concluded.ok) expect(concluded.error.code).toBe("INVARIANT_VIOLATED");
  });

  it("始める前に決めた指標以外では判定できない", () => {
    const made = draft();
    if (!made.ok) throw new Error(made.error.message);
    const started = startLoopRun(made.value, new Date());
    if (!started.ok) throw new Error(started.error.message);

    const other = judgeComparison({
      metric: "time_on_page_seconds",
      baselineValue: 90,
      baselineSamples: 900,
      candidateValue: 120,
      candidateSamples: 900,
      minimumSamples: DEFAULT_MINIMUM_SAMPLES,
      comparisonCount: 1,
    });
    if (!other.ok) throw new Error(other.error.message);

    expect(concludeLoopRun(started.value, { result: other.value, at: new Date() }).ok).toBe(false);
  });

  it("打ち切るには理由が要る", () => {
    const made = draft();
    if (!made.ok) throw new Error(made.error.message);
    expect(stopLoopRun(made.value, { reason: "  ", at: new Date() }).ok).toBe(false);
    const stopped = stopLoopRun(made.value, { reason: "読者から読みにくいと指摘があった", at: new Date() });
    expect(stopped.ok).toBe(true);
    if (stopped.ok) expect(stopped.value.stoppedReason).not.toBe("");
  });

  it("登録されていないループの名前では作れない", () => {
    const r = createLoopRun({
      id: asExperimentId("run_unknown"),
      workspaceId: WS,
      loopKindKey: "no_such_loop",
      siteSlug: "sample",
      baselineSpecId: base.id,
      candidateSpecId: cand.id,
      diffs: diffVariantSpecs(base, cand),
      primaryMetric: "read_completion_rate",
      minimumSamples: DEFAULT_MINIMUM_SAMPLES,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("VALIDATION_FAILED");
      // どこを見れば正しい名前が分かるかを言う。
      expect(r.error.suggestedAction).toContain("loop-kinds");
    }
  });

  /** 作れないことだけを見たいときの、最小の呼び出し。 */
  function draftWith(over: Partial<Parameters<typeof createLoopRun>[0]>) {
    return createLoopRun({
      id: asExperimentId("run_x"),
      workspaceId: WS,
      loopKindKey: "content_improvement",
      siteSlug: "sample",
      baselineSpecId: base.id,
      candidateSpecId: cand.id,
      diffs: diffVariantSpecs(base, cand),
      primaryMetric: "read_completion_rate",
      minimumSamples: DEFAULT_MINIMUM_SAMPLES,
      ...over,
    });
  }

  it("同じ設定どうしは比べられない", () => {
    const r = draftWith({ candidateSpecId: base.id });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("candidateSpecId");
  });

  it("違いが 1 つも無いものは比べられない", () => {
    const r = draftWith({ diffs: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("diffs");
  });

  it("一度に変える軸は上限までなら通り、1 つ超えると断る", () => {
    // 上限を超えると、差が出ても**どの変更のせいか**が分からなくなる。
    const one = {
      dimensionKey: "section_order",
      label: "節の並び",
      baseline: "結論が先",
      candidate: "比較が先",
    };
    const atLimit = Array.from({ length: MAX_SIMULTANEOUS_DIMENSIONS }, (_, i) => ({
      ...one,
      dimensionKey: `dim_${i}`,
    }));
    expect(draftWith({ diffs: atLimit }).ok).toBe(true);

    const overLimit = [...atLimit, { ...one, dimensionKey: "dim_over" }];
    const r = draftWith({ diffs: overLimit });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INVARIANT_VIOLATED");
  });

  it("定義されていない指標では判定の土俵に上げられない", () => {
    const r = draftWith({ primaryMetric: "no_such_metric" as never });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("primaryMetric");
  });

  it("必要件数は 1 以上の整数だけ受け付ける", () => {
    expect(draftWith({ minimumSamples: 1 }).ok).toBe(true);
    expect(draftWith({ minimumSamples: 0 }).ok).toBe(false);
    expect(draftWith({ minimumSamples: -1 }).ok).toBe(false);
    // 小数は「100.5 件集まったら判定」という言えない状態を作る。
    expect(draftWith({ minimumSamples: 100.5 }).ok).toBe(false);
  });

  it("準備中 → 実施中 → 判定済み の順にしか進めない", () => {
    const made = draft();
    if (!made.ok) throw new Error(made.error.message);

    const started = startLoopRun(made.value, new Date("2026-01-01T00:00:00Z"));
    if (!started.ok) throw new Error(started.error.message);
    expect(started.value.status).toBe("running");
    expect(started.value.startedAt).toEqual(new Date("2026-01-01T00:00:00Z"));

    // 実施中のものをもう一度始められない。
    expect(startLoopRun(started.value, new Date()).ok).toBe(false);
    // 準備中のものをいきなり判定できない。
    const judged = judgeComparison({
      metric: "read_completion_rate",
      baselineValue: 0.4,
      baselineSamples: 900,
      candidateValue: 0.62,
      candidateSamples: 900,
      minimumSamples: DEFAULT_MINIMUM_SAMPLES,
      comparisonCount: 1,
    });
    if (!judged.ok) throw new Error(judged.error.message);
    expect(concludeLoopRun(made.value, { result: judged.value, at: new Date() }).ok).toBe(false);

    const concluded = concludeLoopRun(started.value, {
      result: judged.value,
      at: new Date("2026-02-01T00:00:00Z"),
    });
    expect(concluded.ok).toBe(true);
    if (!concluded.ok) return;
    expect(concluded.value.status).toBe("concluded");
    expect(concluded.value.verdict).toBe(judged.value.verdict);
    expect(concluded.value.concludedAt).toEqual(new Date("2026-02-01T00:00:00Z"));

    // 終わったものは、判定し直しも打ち切りもできない。
    expect(concludeLoopRun(concluded.value, { result: judged.value, at: new Date() }).ok).toBe(false);
    expect(stopLoopRun(concluded.value, { reason: "やっぱりやめる", at: new Date() }).ok).toBe(false);
  });

  it("打ち切ったものは、もう一度打ち切れない", () => {
    const made = draft();
    if (!made.ok) throw new Error(made.error.message);
    const stopped = stopLoopRun(made.value, { reason: "元の記事を作り直した", at: new Date() });
    if (!stopped.ok) throw new Error(stopped.error.message);
    expect(stopLoopRun(stopped.value, { reason: "念のため", at: new Date() }).ok).toBe(false);
  });
});

describe("ループの種類", () => {
  it("いま動くのは 2 種類だけ（使われない仕組みを先回りで作らない）", () => {
    expect(implementedLoopKinds().map((l) => l.key)).toEqual([
      "content_improvement",
      "product_improvement",
    ]);
  });

  it("まだ動かないループには、動かすのに何が要るかが必ず書いてある", () => {
    for (const kind of plannedLoopKinds()) {
      expect(kind.blockedBy, `${kind.key} に必要なものが書かれていない`).toBeTruthy();
    }
  });

  it("どのループにも、外せない約束が自動で付く", () => {
    for (const kind of LOOP_KINDS) {
      for (const universal of UNIVERSAL_GUARDRAILS) {
        expect(
          kind.guardrails.some((g) => g.label === universal.label && g.hard),
          `${kind.key} に「${universal.label}」が付いていない`,
        ).toBe(true);
      }
      expect(kind.stopConditions.length).toBeGreaterThan(0);
    }
  });

  it("正のループには上限と止め方が必ず付く", () => {
    const positive = LOOP_KINDS.filter((k) => k.polarity === "positive");
    expect(positive.length).toBeGreaterThan(0);
    for (const kind of positive) {
      expect(kind.guardrails.filter((g) => g.hard).length).toBeGreaterThan(
        UNIVERSAL_GUARDRAILS.length,
      );
    }
  });

  it("止め方の無いループは登録できない", () => {
    const r = registerLoopKind({
      key: "no_stop",
      label: "止まらないループ",
      polarity: "positive",
      readiness: "planned",
      decisionBasis: "comparison",
      signal: "反応が良い題材",
      baseline: "先月",
      decisionRule: "反応が良ければ増やす",
      interventionTarget: "題材選び",
      watchedMetrics: ["page_views"],
      approver: "編集の責任者",
      stopConditions: [],
      blockedBy: "題材の在庫の仕組み",
    });
    expect(r.ok).toBe(false);
  });

  it("動かない印なのに必要なものが書かれていなければ登録できない", () => {
    const r = registerLoopKind({
      key: "no_blocker",
      label: "予定だけのループ",
      polarity: "watch",
      readiness: "planned",
      decisionBasis: "comparison",
      signal: "落ちてきた記事",
      baseline: "3 か月前",
      decisionRule: "落ちたら見直す",
      interventionTarget: "記事の書き直し",
      watchedMetrics: ["page_views"],
      approver: "編集の責任者",
      stopConditions: ["対象が 0 件になったら止める"],
      blockedBy: null,
    });
    expect(r.ok).toBe(false);
  });
});

describe("軸を 1 つ増やしたときの影響（変更容易性シナリオ ⑭）", () => {
  it("軸を足しても、判定と次の一手は軸の名前を知らないまま動く", () => {
    // ループ本体（judgeComparison / buildSuggestions）は
    // 「設定の差」と「観測値」しか受け取らない。
    // ここでは登録表に無い軸名を差として渡しても動くことで、
    // ループ本体が登録表に依存していないことを示す。
    const diffs = [
      { dimensionKey: "brand_new_axis", label: "まだ表に無い軸", baseline: "A", candidate: "B" },
    ];
    const judged = judgeComparison({
      metric: "read_completion_rate",
      baselineValue: 0.4,
      baselineSamples: 900,
      candidateValue: 0.5,
      candidateSamples: 900,
      minimumSamples: DEFAULT_MINIMUM_SAMPLES,
      comparisonCount: 1,
    });
    if (!judged.ok) throw new Error(judged.error.message);
    const suggestions = buildSuggestions(diffs, [judged.value]);
    expect(suggestions[0]?.dimensionLabel).toBe("brand_new_axis");
    expect(suggestions[0]?.verdict).toBe("improved");
  });

  it("登録表に足した軸は、探せば必ず見つかる（画面の書き起こしが要らない）", () => {
    for (const d of OPTIMIZATION_DIMENSIONS) {
      expect(findOptimizationDimension(d.key)?.label).toBe(d.label);
    }
    expect(findOptimizationDimension("brand_new_axis")).toBeNull();
  });
});

/**
 * 一覧そのものを、テストの側から固定する。
 *
 * **この節を書くまで、上の試験は一覧を回すことしかしていなかった。**
 * 回すだけの試験は、期待値を実装から作っている。だから一覧から 1 件消えると、
 * 残った件数を回して残った件数ぶん確かめ、**緑のまま通る**。
 *
 * 実測（2026-08-19、37 通りの書き換えを 1 件ずつ試した）:
 *   - 調整してはいけないもの 6 件 → **6 件とも緑**
 *   - 改善の軸 20 件 → 17 件が緑（赤は `section_order` / `lead_length` / `brand_theme` の 3 件だけ）
 *   - 外せない約束 5 件 → **5 件とも緑**
 *   - ループの種類 6 件 → 動いている 2 件だけ赤、残り 4 件は緑
 *
 * 中でも重いのは調整禁止の 6 件である。禁止の判定 `NON_OPTIMIZABLE_KEYS` は
 * その一覧から作られるので、一覧から「広告であることの表示」を外すと
 * **それを A/B 試験の軸にできるようになる**。景品表示法に関わる決まりが
 * 消えるのに、試験は 5 件を回して 5 件とも禁止を確かめ、緑を返していた。
 *
 * 消えたことは緑として現れる。だから下の一覧は**実装から作らず、ここに書く**。
 * 実装を変えたい人は、この一覧も一緒に変えることになる。それが目的である。
 */
describe("一覧の中身そのもの（実装から期待値を作らない）", () => {
  const EXPECTED_NON_OPTIMIZABLE = [
    "evidence_requirement",
    "disclosure_presence",
    "accessibility_level",
    "ranking_inputs",
    "consent_prominence",
    "factuality_labeling",
  ] as const;

  const EXPECTED_DIMENSIONS: Readonly<Record<string, readonly string[]>> = {
    // 要件 REQ-IM02（文章・内容の 10 軸）
    text: [
      "section_order",
      "lead_length",
      "heading_wording",
      "sentence_length",
      "content_angle",
      "comparison_columns",
      "claim_placement",
      "cta_wording",
      "article_length",
      "image_placement",
    ],
    // 要件 REQ-IM03（見た目の 6 軸）
    visual: [
      "brand_theme",
      "typography_scale",
      "content_density",
      "body_max_width",
      "ranking_card_form",
      "first_view_composition",
    ],
    // 要件 REQ-IM04（たどり方の 4 軸）
    navigation: [
      "internal_link_placement",
      "related_articles_form",
      "toc_form",
      "template_by_article_type",
    ],
  };

  const EXPECTED_GUARDRAILS = [
    "適用は人の承認を通す（見た目だけの変更も含む）",
    "根拠・広告表示・アクセシビリティは調整対象にしない",
    "順位づけの入力に成果や報酬を入れない",
    "必要件数に届くまで差があると言わない",
    "元の設定へいつでも戻せる状態を保つ",
  ] as const;

  const EXPECTED_LOOP_KINDS = [
    ["content_improvement", "implemented"],
    ["topic_expansion", "planned"],
    ["angle_exploration", "planned"],
    ["decay_watch", "planned"],
    ["generation_cost", "planned"],
    ["product_improvement", "implemented"],
  ] as const;

  it("調整してはいけないものの一覧が、1 件も欠けていない", () => {
    expect(NON_OPTIMIZABLE.map((n) => n.key)).toEqual([...EXPECTED_NON_OPTIMIZABLE]);
  });

  it("調整してはいけない 6 件は、名前を直接あてても軸にできない", () => {
    // 上の「調整してはいけないものは、どれも軸にできない」との違いは、
    // 回す先が実装の一覧ではなく**この 6 個の文字列**であること。
    // 実装から 1 件消えると、この試験だけが赤くなる。
    for (const key of EXPECTED_NON_OPTIMIZABLE) {
      const attempt: OptimizationDimension = {
        key,
        label: key,
        group: "text",
        why: "数字が良くなるから",
        candidateSource: "preset",
        appliedAt: "prompt",
        evaluatedBy: ["read_completion_rate"],
        feedbackTarget: "article_revision",
        reversible: true,
      };
      const r = assertRegistrable(attempt);
      expect(r.ok, `${key} が軸として通ってしまった`).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("INVARIANT_VIOLATED");
    }
  });

  it("改善の軸が、まとまりごとに 1 件も欠けていない", () => {
    for (const [group, keys] of Object.entries(EXPECTED_DIMENSIONS)) {
      expect(
        OPTIMIZATION_DIMENSIONS.filter((d) => d.group === group).map((d) => d.key),
        `${group} の軸が変わっている`,
      ).toEqual([...keys]);
    }
    // まとまりを足したときにも気づけるよう、総数も突き当てる。
    const total = Object.values(EXPECTED_DIMENSIONS).reduce((n, k) => n + k.length, 0);
    expect(OPTIMIZATION_DIMENSIONS.length).toBe(total);
  });

  it("外せない約束が、1 件も欠けていない", () => {
    expect(UNIVERSAL_GUARDRAILS.map((g) => g.label)).toEqual([...EXPECTED_GUARDRAILS]);
    // 「自動で付く」ことは上の試験が見ているが、そこも一覧を回している。
    // ここでは**この 5 個の文字列**が全ループに付いていることを見る。
    for (const kind of LOOP_KINDS) {
      for (const label of EXPECTED_GUARDRAILS) {
        expect(
          kind.guardrails.some((g) => g.label === label && g.hard),
          `${kind.key} に「${label}」が付いていない`,
        ).toBe(true);
      }
    }
  });

  it("ループの種類と、動いているかどうかが変わっていない", () => {
    expect(LOOP_KINDS.map((k) => [k.key, k.readiness])).toEqual(
      EXPECTED_LOOP_KINDS.map((e) => [...e]),
    );
    // 動いている数は要件表（REQ-IM10）の文言と直結する。
    // ここが動いたら、表の側も直さなければならない。
    expect(implementedLoopKinds().map((k) => k.key)).toEqual([
      "content_improvement",
      "product_improvement",
    ]);
  });
});
