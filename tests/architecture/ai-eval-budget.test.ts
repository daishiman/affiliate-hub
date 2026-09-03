/** @tier 1 */
import { describe, expect, it } from "vitest";
import { EVAL_CASES } from "../../evals/generation/cases";
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

  /**
   * **上限を、書き写した数ではなく実物の件数に結ぶ。**
   *
   * 既存の 2 つの検査（`tests/architecture/ci-config.test.ts` と
   * `tests/architecture/quality-gates.test.ts`）は
   * 「上限は**評価セットの実件数**（51）を超えない」という名前を持ちながら、
   * 中身は `toBeLessThanOrEqual(51)` だった。**51 は実件数ではなく、実件数の写し**である。
   * 評価ケースを 10 件消しても、上限 51 はそのまま緑で通る
   * ＝「上限が 1 度も効かない飾りになっていないか」を見るという主張が成り立たない。
   *
   * ここでは `EVAL_CASES` を読み込み、その `length` と突き合わせる。
   * 実測（2026-08-21）: `EVAL_CASES.length` は 51、`AI_EVAL_BUDGET.maxCases` も 51。
   *
   * **この検査が見ていないもの**: 上限がケースごとのトークン実測に対して妥当か
   * （`maxTokens` の側）は、ここでは件数×目安の掛け算しか見ていない。
   */
  it("件数の上限が、評価セットの実件数を超えていない（写しではなく実物と突き合わせる）", () => {
    // **母集団の床**。評価セットが空でも「上限 ≦ 件数」は破れないので、先に実物を確かめる。
    // 仕様の下限は 50 件（docs/spec/11-CI-CD・品質ゲート仕様.md §8-4）。
    expect(EVAL_CASES.length, "評価セットを読めていません").toBeGreaterThanOrEqual(50);

    expect(
      AI_EVAL_BUDGET.maxCases,
      "上限が実件数より大きいと、上限は 1 度も効かない飾りになります",
    ).toBeLessThanOrEqual(EVAL_CASES.length);
    expect(AI_EVAL_BUDGET.maxCases).toBeGreaterThan(0);
    expect(AI_EVAL_BUDGET.maxTokens).toBeGreaterThan(0);
  });

  it("正本の理由書きに書かれた件数も、実件数と合っている", () => {
    // `why` は人が読む欄だが、ここが実物とずれると
    // 「なぜこの上限なのか」を確かめる術が無くなる（上の検査は数だけを見て文を見ない）。
    const written = AI_EVAL_BUDGET.why.match(/評価セットは\s*(\d+)\s*件/);
    expect(written, "理由書きから件数を読み取れません").not.toBeNull();
    expect(Number(written?.[1])).toBe(EVAL_CASES.length);
  });
});
