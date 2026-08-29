/**
 * @tier 1
 * @req REQ-P01, REQ-P02, REQ-P03, REQ-P04, REQ-TH01, REQ-TH03, REQ-QC09, REQ-QC12, REQ-SEC04, REQ-SEC06, REQ-API02, REQ-B12, REQ-R11, REQ-R12, REQ-IM05, REQ-E14
 * @types property
 *
 * `boundary` は名乗らない。ここが持つ床（100 回・20 種）は**この走りの設定**の端で、
 * 上に並べた 16 要件それぞれの入力の端ではない。名乗ると
 * `docs/product/required-test-types.md` が REQ-P03 / REQ-QC12 について
 * 「端が無いので boundary は除外」と書いている理由と正面からぶつかり、
 * `scripts/required-test-types.mjs --check` が NG を出す（2026-08-21 に実測して外した）。
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";

/**
 * **性質テストは、1 度も試さなくても同じ緑を返す。**
 *
 * `docs/product/traceability.md` U 節は「入力を `fast-check` に作らせて
 * 『どんな入力でも成り立つはず』の側を確かめる」と書いているが、
 * 2026-08-21 まで**それを見ている検査は 1 つも無かった**。
 * 5 ファイルの先頭に `fc.configureGlobal({ numRuns: 0 })` を 1 行足すと、
 * **50 件すべてが緑のまま通った**（実測）。試行回数が 0 でも、
 * 「N 回試して落ちなかった」の主張は同じ形で成立してしまう。
 *
 * ここで見るのは 3 つ。どれも「そう書いてあるか」ではなく、
 * **実際に何回呼ばれ、何種類の値が来て、反例が縮んだか**を数える。
 *
 *   1. **回数** — 述語が実際に何度呼ばれたか。0 回や数回で緑になっていないこと。
 *   2. **多様さ** — 来た値が何種類あったか。同じ値を 100 回渡す生成器では、
 *      回数の床だけを満たして「どんな入力でも」を名乗れてしまう。
 *   3. **縮小（shrink）** — わざと落ちる性質を走らせ、報告された反例が
 *      **最小のもの**であること。縮小が切れていると反例は巨大な値のまま返り、
 *      落ちた理由が読めない（＝落ちても直せない）。
 *
 * --- 見えていない範囲（先に書く） ---
 *
 * ここが押さえるのは**この走りの周囲の設定**である。vitest はファイルごとに
 * 別の worker で動くので、**他の性質テストファイルが自分の中だけで
 * `numRuns` を下げた場合、この検査には見えない**。
 * `fc.assert(..., { numRuns: 0 })` のように 1 呼び出しへ直に渡された分も同じ。
 * 塞げていないので、穴として書き残す（`docs/product/backlog.md` の一覧に起票済み）。
 */

/** 1 つの性質が最低これだけ試されていること。fast-check の既定値。 */
const MIN_RUNS = 100;

/** 来る値の種類の床。回数だけ満たして同じ値を配る生成器を落とす。 */
const MIN_DISTINCT = 20;

describe("性質テストが、実際に入力を試していること", () => {
  it("述語は、既定の回数だけ実際に呼ばれる（0 回でも緑にならない）", () => {
    let calls = 0;
    fc.assert(
      fc.property(fc.integer(), () => {
        calls += 1;
        return true;
      }),
    );
    expect(calls).toBeGreaterThanOrEqual(MIN_RUNS);
  });

  it("配られる値は 1 種類ではない（同じ値を数え上げて床を満たさない）", () => {
    const seen = new Set<number>();
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (n) => {
        seen.add(n);
        return true;
      }),
    );
    expect(seen.size).toBeGreaterThanOrEqual(MIN_DISTINCT);
  });

  it("落ちたときの反例が最小まで縮む（縮小が切れていない）", () => {
    /*
     * 「5 未満である」は 5 で初めて破れる。縮小が効いていれば
     * 報告される反例はちょうど 5 になる。切れていれば、
     * 最初に見つかった大きな値がそのまま返る。
     */
    let counterexample: number | null = null;
    try {
      fc.assert(
        fc.property(fc.integer({ min: 0 }), (n) => {
          expect(n).toBeLessThan(5);
        }),
      );
    } catch (error) {
      const found = /\[(\d+)\]/.exec(String((error as Error).message));
      counterexample = found === null ? null : Number(found[1]);
    }
    // そもそも落ちなかったなら、この検査は何も見ていない。
    expect(counterexample).not.toBeNull();
    expect(counterexample).toBe(5);
  });
});
