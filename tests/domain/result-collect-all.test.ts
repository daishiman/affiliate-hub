/** @tier 1 @req REQ-BLOG01 */
import { describe, expect, it } from "vitest";
import { collectAll, err, ok } from "@/domain/shared";

describe("collectAll", () => {
  it("型の違う成功を、位置を保ったまま組で返す", () => {
    const result = collectAll(ok(1), ok("a"), ok([true]));

    expect(result).toEqual({ ok: true, value: [1, "a", [true]] });
    if (result.ok) {
      // 位置ごとに型が保たれる。全部が union に潰れると、
      // 呼び出し側は結局 as で戻すことになり、絞り込みの意味が消える。
      const [first, second, third]: readonly [number, string, boolean[]] = result.value;
      expect([first, second, third]).toEqual([1, "a", [true]]);
    }
  });

  it("1 つでも失敗したら、その失敗をそのまま返す", () => {
    expect(collectAll(ok(1), err("読めません"), ok(3))).toEqual({
      ok: false,
      error: "読めません",
    });
  });

  it("複数失敗しても最初の 1 つだけを返す", () => {
    // 先頭を選ぶのは、呼び出し側が「どれが原因か」を 1 つに決められるようにするため。
    // 全部返すと、受け取った側が代表を選び直す判断をもう一度することになる。
    expect(collectAll(ok(1), err("先"), err("後"))).toEqual({
      ok: false,
      error: "先",
    });
  });

  it("空の組は空の成功になる", () => {
    expect(collectAll()).toEqual({ ok: true, value: [] });
  });
});
