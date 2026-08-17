/** @tier 1 */
import { describe, expect, it } from "vitest";
import { AI_EVAL_BUDGET } from "../../quality-gates.config.mjs";
import { BudgetExceeded, createBudgetGuard, estimate } from "../../scripts/ai-eval-budget.mjs";

/**
 * 費用の上限が「途中で止まる」形になっていることを見る。
 *
 * 走り終えてから超過を知らせる作りでも、テストは書けてしまう
 * （最後に合計を見て、超えていたら失敗と言えばよい）。
 * だからここでは**止まった時点の実測**を見る。
 * 上限が 3 件なら、4 件目の手前で止まり、計上は 3 件で終わっていること。
 *
 * 規範: docs/spec/11-CI-CD・品質ゲート仕様.md §8-4
 */

describe("AI 評価セットの費用の上限", () => {
  it("件数の上限に当たると、その 1 件を実行する前に止まる", () => {
    const guard = createBudgetGuard({ maxCases: 3, maxTokens: 1_000_000 });
    guard.spend(100);
    guard.spend(100);
    guard.spend(100);
    expect(() => guard.spend(100)).toThrow(BudgetExceeded);
    // 4 件目は計上されていない = 問い合わせていない。
    expect(guard.spent().cases).toBe(3);
    expect(guard.spent().tokens).toBe(300);
  });

  it("トークンの上限に当たると、その 1 件を実行する前に止まる", () => {
    const guard = createBudgetGuard({ maxCases: 100, maxTokens: 250 });
    guard.spend(100);
    guard.spend(100);
    expect(() => guard.spend(100)).toThrow(/トークンの上限/);
    expect(guard.spent().tokens).toBe(200);
  });

  it("上限ちょうどは通し、1 つ超えたところで止める", () => {
    const guard = createBudgetGuard({ maxCases: 2, maxTokens: 200 });
    guard.spend(100);
    expect(guard.spend(100).tokens).toBe(200);
    expect(() => guard.spend(1)).toThrow(BudgetExceeded);
  });

  it("止まったときに、どこまで使ったかが分かる", () => {
    // 「上限で止めました」だけでは、実費用が 0 円なのか上限いっぱいなのか分からない。
    const guard = createBudgetGuard({ maxCases: 1, maxTokens: 1000 });
    guard.spend(500);
    try {
      guard.spend(500);
      expect.unreachable("上限を超えたのに止まりませんでした");
    } catch (error) {
      expect(error).toBeInstanceOf(BudgetExceeded);
      expect((error as BudgetExceeded & { spent: { cases: number } }).spent.cases).toBe(1);
    }
  });

  it("見積りは走らせる前に出せる（実行に依存しない）", () => {
    const e = estimate(51, 8000);
    expect(e.tokens).toBe(408_000);
    expect(e.yen).toBeGreaterThan(0);
  });

  it("既定の上限が正本の値と一致する", () => {
    // ここが正本から外れると、手元と機械で別々の上限が効く。
    const guard = createBudgetGuard();
    expect(guard.limits.maxCases).toBe(AI_EVAL_BUDGET.maxCases);
    expect(guard.limits.maxTokens).toBe(AI_EVAL_BUDGET.maxTokens);
  });
});
