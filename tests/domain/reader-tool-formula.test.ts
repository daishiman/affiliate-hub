/**
 * @tier 1
 * @req REQ-B07
 * @types equivalence, boundary, adversarial
 *
 * 読者向けの「診断・計算」の計算式。
 *
 * --- ここで最も守りたいこと ---
 * 1. **式は実行されない。** 保存先に入った文字列が、そのままサーバーで動く命令に
 *    ならないこと。道具の登録欄が乗っ取りの入口になるのを、字句の段階で止める。
 * 2. **数字をでっち上げない。** 足りない入力を 0 とみなして計算しない。
 * 3. **打ち直させない。** 「1,200」も「１２００」も受ける。
 */
import { describe, expect, it } from "vitest";
import {
  type ReaderToolFormula,
  evaluateExpression,
  parseReaderNumber,
  runReaderToolFormula,
} from "@/domain/authoring/reader-tool-formula";

const INPUTS = [
  { key: "a", label: "あ" },
  { key: "b", label: "い" },
];

function formula(rows: ReaderToolFormula["rows"], summary = "{結果}"): ReaderToolFormula {
  return { rows, summary };
}

describe("式の読み取り", () => {
  it("掛け算と割り算は足し算より先に効く", () => {
    const r = evaluateExpression("1 + 2 * 3", {});
    expect(r.ok && r.value).toBe(7);
  });

  it("括弧で順番を変えられる", () => {
    const r = evaluateExpression("(1 + 2) * 3", {});
    expect(r.ok && r.value).toBe(9);
  });

  it("引き算と割り算は左から順に解く", () => {
    // 右から解くと 10 - (3 - 2) = 9 になる。並びの意味が変わる。
    expect(evaluateExpression("10 - 3 - 2", {})).toEqual(expect.objectContaining({ value: 5 }));
    expect(evaluateExpression("100 / 5 / 2", {})).toEqual(expect.objectContaining({ value: 10 }));
  });

  it("先頭の負号を読む", () => {
    expect(evaluateExpression("-3 * 2", {})).toEqual(expect.objectContaining({ value: -6 }));
  });

  it("入力欄の名前を値に置き換える", () => {
    expect(evaluateExpression("a * b", { a: 3, b: 4 })).toEqual(
      expect.objectContaining({ value: 12 }),
    );
  });
});

describe("式に書けないもの", () => {
  // ここが緩むと、道具の登録欄がそのまま乗っ取りの入口になる。
  it.each([
    ["process.env.SECRET", "."],
    ["fetch('https://example.com')", "'"],
    ["a; b", ";"],
    ["a ** b", ""],
    ["globalThis['x']", "["],
  ])("%s は解かない", (expression) => {
    const r = evaluateExpression(expression, { a: 1, b: 2 });
    expect(r.ok).toBe(false);
  });

  it("使えない文字は、その文字を名指しして返す", () => {
    const r = evaluateExpression("a . b", { a: 1, b: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain("「.」");
  });

  it("括弧が閉じていない式は失敗する", () => {
    expect(evaluateExpression("(1 + 2", {}).ok).toBe(false);
  });

  it("入力欄に無い名前を使う式は、登録側の間違いとして失敗する", () => {
    const r = evaluateExpression("a + missing", { a: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("missing");
  });

  it("余分な部分が残る式は失敗する", () => {
    expect(evaluateExpression("1 2", {}).ok).toBe(false);
  });
});

describe("読者が打った数の読み取り", () => {
  it.each([
    ["1200", 1200],
    ["1,200", 1200],
    ["  12.5 ", 12.5],
    ["１２００", 1200],
    ["-3", -3],
  ])("%s は %s として読む", (raw, expected) => {
    expect(parseReaderNumber(raw)).toBe(expected);
  });

  it.each(["", "たくさん", "12abc", "1.2.3", "--3"])("%s は数として読まない", (raw) => {
    expect(parseReaderNumber(raw)).toBeNull();
  });
});

describe("道具を 1 回動かす", () => {
  it("空の欄は、その欄を名指しして止める", () => {
    const r = runReaderToolFormula(formula([{ label: "結果", expression: "a + b" }]), INPUTS, {
      a: "1",
      b: "   ",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.field).toBe("b");
      // 「い」を 0 とみなして 1 と出さない。読者はその数字を信じる。
      expect(r.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("数字でない欄は、その欄を名指しして止める", () => {
    const r = runReaderToolFormula(formula([{ label: "結果", expression: "a" }]), INPUTS, {
      a: "たくさん",
      b: "1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("a");
  });

  it("0 で割るときは Infinity ではなく理由を返す", () => {
    const r = runReaderToolFormula(formula([{ label: "結果", expression: "a / b" }]), INPUTS, {
      a: "1",
      b: "0",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain("0 では割れない");
  });

  it("計算式が 1 行も無い道具は、未実装として返す", () => {
    const r = runReaderToolFormula(formula([]), INPUTS, { a: "1", b: "1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("前の行の結果を、名前を付けて次の行から使える", () => {
    const r = runReaderToolFormula(
      formula(
        [
          { label: "小計", expression: "a * b", as: "sub" },
          { label: "合計", expression: "sub * 2" },
        ],
        "{合計} です",
      ),
      INPUTS,
      { a: "3", b: "4" },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.rows).toEqual([
        { label: "小計", value: "12" },
        { label: "合計", value: "24" },
      ]);
      expect(r.value.summary).toBe("24 です");
    }
  });

  it("単位と桁数と桁区切りを付けて返す", () => {
    const r = runReaderToolFormula(
      formula([{ label: "容量", expression: "a * b", unit: " GB", decimals: 1 }]),
      INPUTS,
      { a: "1234", b: "1" },
    );
    expect(r.ok && r.value.rows[0]?.value).toBe("1,234.0 GB");
  });

  it("見出しが別の見出しの一部でも、1 文の置き換えが壊れない", () => {
    // 「合計」が「合計金額」の一部。短いほうが先に当たると文が壊れる。
    const r = runReaderToolFormula(
      formula(
        [
          { label: "合計", expression: "a" },
          { label: "合計金額", expression: "b" },
        ],
        "{合計} と {合計金額}",
      ),
      INPUTS,
      { a: "1", b: "2" },
    );
    expect(r.ok && r.value.summary).toBe("1 と 2");
  });
});
