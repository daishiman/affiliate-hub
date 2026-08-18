/** @tier 1 */
/**
 * @req REQ-CI12
 * @types equivalence, boundary
 *
 * **目標時間を超えても、検査は落ちない。**
 *
 * 時間で赤くすると、赤を消す最短の道が「テストを消す・skip する・閾値を下げる」に
 * なる。守りたいのは速さではなく中身なので、超過は伝えるだけにする。
 *
 * この要件は 2026-08-19 まで**一度も測られていなかった**。実測が 42 秒、目標が
 * 20 分なので、超過の道は現実には通らない。通らない道は、そこに何が書いてあっても
 * 誰も確かめられない。`scripts/verify.mjs` は時間を自分で `Date.now()` から読んで
 * おり、外から渡す口が無かったため、除外ではなく**未宣言**として残されていた。
 *
 * そこで判定を 4 つの純粋な関数へ出し、時間だけを外から渡せるようにした。
 * 渡したことは必ず画面に出る（§4）。出さない口を作ると、測定のための入口が
 * そのまま「遅いのに速いふりをする」入口になる。
 *
 * 落とすのはここ ——「時間が exit code に混ざったとき」（§3）。
 */
import { describe, expect, it } from "vitest";
import {
  describeOverride,
  judgeBudget,
  judgeRun,
  readElapsedOverride,
} from "../../scripts/verify.mjs";

/** 止める検査が 1 本、結果は引数で決める。 */
const gate = (ok: boolean, blocking = true) => ({
  id: "test",
  label: "テスト",
  ok,
  blocking,
  seconds: 1,
});

describe("REQ-CI12 §1 超過したかどうかの区分", () => {
  it("目標の内側なら、超過ではなく、何も言わない", () => {
    const v = judgeBudget(42, 20);
    expect(v.over).toBe(false);
    expect(v.message).toBeNull();
  });

  it("目標を超えたら、超過だと言う", () => {
    const v = judgeBudget(20 * 60 + 1, 20);
    expect(v.over).toBe(true);
    expect(v.message).toContain("警告");
  });

  it("超過を伝える文に、分と秒の両方が入っている", () => {
    // 「超えました」だけでは、どれだけ超えたのか分からず、
    // 次に何を別の段へ移せばよいかが決められない。
    const v = judgeBudget(1500, 20);
    expect(v.message).toContain("20 分");
    expect(v.message).toContain("1500 秒");
  });

  it("超えても、直し方として「消す・下げる」を挙げない", () => {
    expect(judgeBudget(1500, 20).message).toContain("重いものを次の段へ移して");
  });

  it("目標が無い（0 以下）ときは、判定そのものをしない", () => {
    for (const minutes of [0, -1, Number.NaN]) {
      const v = judgeBudget(99999, minutes);
      expect(v.over).toBe(false);
      expect(v.message).toBeNull();
    }
  });
});

describe("REQ-CI12 §2 境目（目標ちょうどは超過ではない）", () => {
  it("目標ちょうど（1200 秒 = 20 分）は超過にしない", () => {
    // ここを「超過」にすると、目標 20 分が実質 19 分 59 秒になる。
    expect(judgeBudget(20 * 60, 20).over).toBe(false);
  });

  it("目標より 1 秒短ければ超過ではない", () => {
    expect(judgeBudget(20 * 60 - 1, 20).over).toBe(false);
  });

  it("目標より 1 秒長ければ超過である", () => {
    expect(judgeBudget(20 * 60 + 1, 20).over).toBe(true);
  });

  it("0 秒でも超過にはならない", () => {
    expect(judgeBudget(0, 20).over).toBe(false);
  });
});

describe("REQ-CI12 §3 時間は検査を落とさない", () => {
  it("どれだけ超えても、止める検査が通っていれば exit code は 0", () => {
    const v = judgeRun({ results: [gate(true)], totalSeconds: 99999, budgetMinutes: 20 });
    expect(v.budget.over).toBe(true);
    expect(v.exitCode).toBe(0);
  });

  it("超過は blocking にならない（ここが true になる道を作らない）", () => {
    const v = judgeRun({ results: [gate(true)], totalSeconds: 99999, budgetMinutes: 20 });
    expect(v.budget.blocking).toBe(false);
  });

  it("落ちるのは、止める検査が落ちたときだけ", () => {
    const v = judgeRun({ results: [gate(false)], totalSeconds: 1, budgetMinutes: 20 });
    expect(v.exitCode).toBe(1);
    expect(v.failed).toHaveLength(1);
  });

  it("止めない検査が落ちても、exit code は 0", () => {
    const v = judgeRun({
      results: [gate(false, false)],
      totalSeconds: 1,
      budgetMinutes: 20,
    });
    expect(v.exitCode).toBe(0);
  });

  it("同じ結果なら、時間を変えても exit code は動かない", () => {
    // 時間が判定に混ざっていないことを、時間だけを動かして見る。
    for (const results of [[gate(true)], [gate(false)]]) {
      const fast = judgeRun({ results, totalSeconds: 1, budgetMinutes: 20 });
      const slow = judgeRun({ results, totalSeconds: 99999, budgetMinutes: 20 });
      expect(slow.exitCode).toBe(fast.exitCode);
    }
  });
});

describe("REQ-CI12 §4 外から渡した時間は、必ず画面に出る", () => {
  it("渡していないときは、何も読まない", () => {
    expect(readElapsedOverride({})).toBeNull();
    expect(readElapsedOverride({ VERIFY_ELAPSED_SECONDS: "" })).toBeNull();
  });

  it("秒数を渡すと、その値を使う", () => {
    expect(readElapsedOverride({ VERIFY_ELAPSED_SECONDS: "1500" })).toEqual({
      invalid: false,
      seconds: 1500,
    });
  });

  it("秒数でないもの・負の数は受け取らない", () => {
    for (const raw of ["あとで", "-1", "NaN"]) {
      expect(readElapsedOverride({ VERIFY_ELAPSED_SECONDS: raw })?.invalid).toBe(true);
    }
  });

  it("渡したときは、渡したことと実測の両方を必ず出す", () => {
    const notice = describeOverride(readElapsedOverride({ VERIFY_ELAPSED_SECONDS: "1500" }), 42);
    expect(notice).toContain("1500 秒");
    expect(notice).toContain("42 秒");
    expect(notice).toContain("実際にかかった時間ではありません");
  });

  it("渡していないときは、告知を出さない（出す口が空回りしない）", () => {
    expect(describeOverride(null, 42)).toBeNull();
    expect(describeOverride({ invalid: true, raw: "あとで" }, 42)).toBeNull();
  });
});
