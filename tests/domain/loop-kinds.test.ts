/**
 * @tier 1
 * @req REQ-FB01
 * @types equivalence, decision-table
 */
import { describe, expect, it } from "vitest";

import {
  LOOP_DECISION_BASES,
  LOOP_KINDS,
  UNIVERSAL_GUARDRAILS,
  createLoopRun,
  findLoopKind,
  implementedLoopKinds,
  registerLoopKind,
} from "@/domain/analytics";
import { asExperimentId, asWorkspaceId } from "@/domain/shared";

/**
 * ループの登録表に 2 件目（改善要望）が入ったときの検査。
 *
 * ここで確かめたいのは 2 点だけ。
 *   1. 歯止めが**自動で**付いていること（定義に書き忘れても付く）
 *   2. 改善要望が**統計の判定に乗っていない**こと
 *
 * 2 が要点で、乗ってしまうと「要望 3 件では件数が足りない」という、
 * そもそも成り立たない判断が画面に出る。
 */

const PRODUCT_IMPROVEMENT = "product_improvement";

describe("改善要望ループ（ループの 2 件目）", () => {
  it("登録表に入っている", () => {
    const kind = findLoopKind(PRODUCT_IMPROVEMENT);
    expect(kind).not.toBeNull();
    expect(kind?.approver).toBe("システム管理者");
  });

  it("受け取る画面が揃ったので動く（待ちの理由も残さない）", () => {
    const kind = findLoopKind(PRODUCT_IMPROVEMENT);
    expect(kind?.readiness).toBe("implemented");
    // 動くのに「動かせない理由」が残っていたら、どちらかが古い。
    expect(kind?.blockedBy).toBeNull();
    expect(implementedLoopKinds().map((l) => l.key)).toContain(PRODUCT_IMPROVEMENT);
  });

  it("外せない約束が自動で付く（定義側に転記していない）", () => {
    const kind = findLoopKind(PRODUCT_IMPROVEMENT);
    for (const universal of UNIVERSAL_GUARDRAILS) {
      expect(
        kind?.guardrails.some((g) => g.label === universal.label && g.hard),
        `「${universal.label}」が付いていない`,
      ).toBe(true);
    }
  });

  it("1 件ずつ扱うループには、1 件を全体の話にしない約束が付く", () => {
    const kind = findLoopKind(PRODUCT_IMPROVEMENT);
    expect(kind?.guardrails.some((g) => g.label.includes("全体の傾向") && g.hard)).toBe(true);
    expect(kind?.guardrails.some((g) => g.label.includes("指示として実行しない") && g.hard)).toBe(
      true,
    );
  });

  it("止め方が書いてある（対応しない・重複も終わりとして数える）", () => {
    const kind = findLoopKind(PRODUCT_IMPROVEMENT);
    expect(kind?.stopConditions.length).toBeGreaterThan(0);
  });
});

describe("統計の判定に乗っていないこと", () => {
  it("改善要望は 1 件ずつ扱う印になっており、見る指標を持たない", () => {
    const kind = findLoopKind(PRODUCT_IMPROVEMENT);
    expect(kind?.decisionBasis).toBe("single_case");
    // 指標を持たせると件数の話になる。持たないことが判断の根拠。
    expect(kind?.watchedMetrics).toEqual([]);
  });

  it("改善要望では A と B を比べる 1 周を作れない", () => {
    const r = createLoopRun({
      id: asExperimentId("exp-feedback"),
      workspaceId: asWorkspaceId("ws-1"),
      loopKindKey: PRODUCT_IMPROVEMENT,
      siteSlug: "example",
      baselineSpecId: "spec-a",
      candidateSpecId: "spec-b",
      diffs: [{ dimensionKey: "heading_style", label: "見出しの書き方", baseline: "A", candidate: "B" }],
      primaryMetric: "read_completion_rate",
      minimumSamples: 100,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).toContain("比べて決めるループではありません");
    }
  });

  it("比べて決めるループは、いまも 1 周を作れる（2 件目を足して壊していない）", () => {
    const r = createLoopRun({
      id: asExperimentId("exp-content"),
      workspaceId: asWorkspaceId("ws-1"),
      loopKindKey: "content_improvement",
      siteSlug: "example",
      baselineSpecId: "spec-a",
      candidateSpecId: "spec-b",
      diffs: [{ dimensionKey: "heading_style", label: "見出しの書き方", baseline: "A", candidate: "B" }],
      primaryMetric: "read_completion_rate",
      minimumSamples: 100,
    });
    expect(r.ok).toBe(true);
  });
});

describe("決め方の指定は登録のときに検査される", () => {
  it("決め方が 2 つだけであること（増やすときはここも直す）", () => {
    expect([...LOOP_DECISION_BASES]).toEqual(["comparison", "single_case"]);
  });

  it("比べて決めるのに、見る指標が無ければ登録できない", () => {
    const r = registerLoopKind({
      key: "no_metric",
      label: "指標の無い比較ループ",
      polarity: "negative",
      readiness: "implemented",
      decisionBasis: "comparison",
      signal: "なんとなくの感触",
      baseline: "先週",
      decisionRule: "良さそうなら採る",
      interventionTarget: "見出し",
      approver: "編集の責任者",
      stopConditions: ["3 回で止める"],
      blockedBy: null,
      watchedMetrics: [],
    });
    expect(r.ok).toBe(false);
  });

  it("1 件ずつ扱うのに、見る指標を持たせたら登録できない", () => {
    const r = registerLoopKind({
      key: "mixed_basis",
      label: "1 件ずつのはずが件数も見るループ",
      polarity: "negative",
      readiness: "implemented",
      decisionBasis: "single_case",
      signal: "届いた声",
      baseline: "いまの画面",
      decisionRule: "1 件届いたら決める",
      interventionTarget: "画面",
      approver: "システム管理者",
      stopConditions: ["扱いを決めたら終わり"],
      blockedBy: null,
      watchedMetrics: ["page_views"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.suggestedAction).toContain("別のループとして登録");
    }
  });
});

/**
 * 決め方 × 見る指標の有無を、全通り表にして埋める。
 *
 * 上の 3 件は「駄目な組合せ」を 2 つ名指ししているが、
 * **名指しは数え落としに気づけない。** 決め方が 3 つ目に増えた日、
 * 新しい行はどこにも現れないまま緑のままになる。
 *
 * ここは `LOOP_DECISION_BASES` から行を作るので、増えた瞬間に
 * 「この組合せの答えが表に無い」で落ちる。表の役目はそれ 1 つである。
 * （上の 3 件と重なるが、重なりを消すと落ちる条件も一緒に消える。残す。）
 */
describe("決め方 × 見る指標の全通り", () => {
  /** 期待する答え。`決め方:指標あり?` を鍵にする。 */
  const EXPECTED: Record<string, boolean> = {
    "comparison:true": true,
    "comparison:false": false,
    "single_case:true": false,
    "single_case:false": true,
  };

  const register = (basis: string, withMetric: boolean) =>
    registerLoopKind({
      key: `table_${basis}_${withMetric}`,
      label: "表から作った一時的なループ",
      polarity: "negative",
      readiness: "implemented",
      decisionBasis: basis as (typeof LOOP_DECISION_BASES)[number],
      signal: "何かの合図",
      baseline: "いまの状態",
      decisionRule: "決める",
      interventionTarget: "画面",
      approver: "システム管理者",
      stopConditions: ["止める条件"],
      blockedBy: null,
      watchedMetrics: withMetric ? ["page_views"] : [],
    });

  for (const basis of LOOP_DECISION_BASES) {
    for (const withMetric of [true, false]) {
      const cell = `${basis}:${withMetric}`;
      it(`${cell} の答えが表にあり、その通りになる`, () => {
        expect(
          Object.hasOwn(EXPECTED, cell),
          `${cell} の答えを表に足してください（決め方を増やしたら行も増える）`,
        ).toBe(true);
        expect(register(basis, withMetric).ok).toBe(EXPECTED[cell]);
      });
    }
  }

  it("表に、もう存在しない決め方の行が残っていない", () => {
    const alive = new Set(
      LOOP_DECISION_BASES.flatMap((b) => [`${b}:true`, `${b}:false`]),
    );
    expect(Object.keys(EXPECTED).filter((k) => !alive.has(k))).toEqual([]);
  });
});

describe("2 件目を足しても登録表の形が変わっていないこと", () => {
  it("すべてのループが同じ 8 項目で書かれている", () => {
    for (const kind of LOOP_KINDS) {
      expect(kind.signal, `${kind.key}`).not.toBe("");
      expect(kind.baseline, `${kind.key}`).not.toBe("");
      expect(kind.decisionRule, `${kind.key}`).not.toBe("");
      expect(kind.interventionTarget, `${kind.key}`).not.toBe("");
      expect(kind.approver, `${kind.key}`).not.toBe("");
      expect(kind.stopConditions.length, `${kind.key}`).toBeGreaterThan(0);
      expect(LOOP_DECISION_BASES).toContain(kind.decisionBasis);
      expect(kind.guardrails.length, `${kind.key}`).toBeGreaterThanOrEqual(
        UNIVERSAL_GUARDRAILS.length,
      );
    }
  });
});
