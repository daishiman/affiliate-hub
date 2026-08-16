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
});

describe("ループの種類", () => {
  it("いま動くのは 1 種類だけ（使われない仕組みを先回りで作らない）", () => {
    expect(implementedLoopKinds()).toHaveLength(1);
    expect(implementedLoopKinds()[0]?.key).toBe("content_improvement");
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
      signal: "反応が良い題材",
      comparisonBaseline: "先月",
      decisionRule: "反応が良ければ増やす",
      intervention: "題材選び",
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
      signal: "落ちてきた記事",
      comparisonBaseline: "3 か月前",
      decisionRule: "落ちたら見直す",
      intervention: "記事の書き直し",
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
