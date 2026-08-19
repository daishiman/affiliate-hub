/**
 * @tier 1
 * @req REQ-TS15
 * @types equivalence, boundary
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 章を再生成する前に、**下回ってはならない床**を数で置く。
 *
 * なぜ要るか: `completeness-report.json` gaps[0] は 8 章 + `00-requirements-definition.md`
 * の再生成を求めている。前に一度、この種の再生成が **892 行の削除**を伴い、
 * **gaps が引用している当の節を消す形**になった。走らせてからでは、
 * 消えたものが「元から無かった」と読めてしまう。**先に数を置く。**
 *
 * なぜ文書ではなくテストか: 想定を文書にも書くと、数の正本が 2 つできる。
 * 残課題 78 ⑰ の型——同じ文書の中で、書いた瞬間から自分自身と食い違う——を
 * 自分で作ることになる。**数はここ 1 箇所にだけ置く。**
 *
 * ── 何を測っているか (2026-08-19 の実測を床として置いた) ──────────────
 *
 * 対象は `auth.md` **1 章だけ**。8 章まとめて測ると、想定が外れたときに
 * どの想定が外れたのか分からない。auth は確定セル 1 件・deep knowledge card 1 枚で
 * 章の構造が最小のため、外れたときの原因が絞れる。
 *
 * 床は**現在値そのもの**である（153 行、`##` 11 個 等）。等号ではなく
 * `以上` で置いてあるのは、再生成の目的が **decisions[] の追記**——つまり
 * 増える方向——だからである。増えるのは通す。**減るところだけを止める。**
 *
 * 上限も 1 つだけ置く（+150 行）。目的は `decision-auth-method` 1 件を載せることで、
 * その分量は options 3 件 × 12 項目 + 推奨 + 確定で 50〜80 行と見積もった。
 * 倍を超えて増えたら、載せる対象を取り違えている。**上限は下げる方向にしか動かさない。**
 *
 * ── 分かったこと: gaps[0] も名指しを外している ────────────────────
 *
 * gaps[0] は「decisions[] 6 件を本文へ載せる」と言うが、
 * **`00-requirements-definition.md` には 6 件とも既に載っている**（L80 の表）。
 * 載っていないのは 8 章の側である。しかも 00 での載り方は
 * `{'category': 'free', 'amount': 0, ...}` という **Python の dict をそのまま
 * 文字列にした形**で、構造を人の読む形へ直さずに埋めてある。
 * 残課題 78 ⑫ の 3 例目（指摘の一文が名指しした場所だけが外れている）。
 */

const ROOT = process.cwd();

/** 再生成の前後で比べる、章の構造の数。文字列から測るので合成例にもかけられる。 */
function measure(text: string) {
  const lines = text.split("\n");
  const headings = lines.filter((l) => /^#{2,6} /.test(l));
  /** 見出し `name` の直下から、次の `## ` までにある表の本文行を数える。 */
  const tableRows = (name: string): number => {
    const i = lines.findIndex((l) => l === `## ${name}`);
    if (i < 0) return 0;
    let n = 0;
    for (let j = i + 1; j < lines.length && !/^## /.test(lines[j]); j++) {
      if (lines[j].startsWith("|") && !/^\|\s*-+/.test(lines[j])) n += 1;
    }
    return n;
  };
  return {
    lines: lines.length - 1,
    sections: lines.filter((l) => /^## /.test(l)).map((l) => l.slice(3)),
    headings: headings.length,
    tableRows,
    principles: (text.match(/^- 原則: /gm) ?? []).length,
    hasNonNormativeNote: text.includes("**非規範・取得証跡なし・実装根拠に使用不可**"),
    answerLength: (text.split("**回答**: ")[1] ?? "").split("\n")[0].length,
  };
}

/** 再生成後にも名前ごと残っていなければならない節。順序も含めて固定する。 */
const REQUIRED_SECTIONS = [
  "状態の意味 (State semantics)",
  "As-Is",
  "To-Be",
  "Delta",
  "Dependencies",
  "Acceptance evidence",
  "カテゴリ別収集状態",
  "確定内容 (質疑録)",
  "上流指針 (doctrine anchor)",
  "適用された設計知識",
  "最新ドキュメント出典",
] as const;

/** 節ごとの表の本文行数の床。gaps が引用している節を必ず含める。 */
const TABLE_FLOOR: ReadonlyArray<readonly [string, number]> = [
  ["To-Be", 5],
  ["Acceptance evidence", 6],
  ["カテゴリ別収集状態", 7], // gaps[6] が引用
  ["上流指針 (doctrine anchor)", 3], // gaps[2] が引用
  ["最新ドキュメント出典", 2], // gaps[1] が引用。REQ-TS14 が中身を見ている
];

const LINE_FLOOR = 153;
const LINE_CEILING = 303; // 床 + 150。上げない。
const HEADING_FLOOR = 21;
const PRINCIPLE_FLOOR = 2;
const ANSWER_FLOOR = 321; // qa-auth-web の回答は逐語。要約したら短くなる。

describe("auth.md を再生成しても痩せないこと (C03 の事前の床)", () => {
  const m = measure(readFileSync(join(ROOT, "system-spec/auth.md"), "utf8"));

  it("必須の節が名前と順序ごと残っている", () => {
    expect(m.sections).toEqual([...REQUIRED_SECTIONS]);
  });

  it(`見出しが ${HEADING_FLOOR} 個以上ある（節を残して中身を空にする形を止める）`, () => {
    expect(m.headings).toBeGreaterThanOrEqual(HEADING_FLOOR);
  });

  it.each(TABLE_FLOOR)("表「%s」の本文行が %i 行以上ある", (name, floor) => {
    expect(m.tableRows(name)).toBeGreaterThanOrEqual(floor);
  });

  it("確定回答が逐語のまま残っている（要約に置き換わっていない）", () => {
    expect(m.answerLength).toBeGreaterThanOrEqual(ANSWER_FLOOR);
  });

  it("本章での適用の原則が 2 件以上ある", () => {
    expect(m.principles).toBeGreaterThanOrEqual(PRINCIPLE_FLOOR);
  });

  it("非規範注記が残っている（実装根拠に使えない参照であることの断り）", () => {
    expect(m.hasNonNormativeNote).toBe(true);
  });

  it(`行数が ${LINE_FLOOR} 以上 ${LINE_CEILING} 以下にある`, () => {
    expect(m.lines).toBeGreaterThanOrEqual(LINE_FLOOR);
    expect(m.lines).toBeLessThanOrEqual(LINE_CEILING);
  });

  /**
   * 床は「満たしている」だけでは効いていることを示せない。
   * **痩せた章を合成して、同じ測り方が落とすことを見る。**
   * これが無いと、上の 8 件は測る側が壊れていても同じ緑を返す。
   */
  describe("痩せた章を止められること", () => {
    const full = readFileSync(join(ROOT, "system-spec/auth.md"), "utf8");

    it("節を 1 つ落とすと、必須の節の一致が崩れる", () => {
      const cut = full.replace("## Delta\n", "");
      expect(measure(cut).sections).not.toEqual([...REQUIRED_SECTIONS]);
    });

    it("対象外の 5 行を消すと、収集状態の表が床を割る", () => {
      const cut = full
        .split("\n")
        .filter((l) => !l.includes("approval-platform-web-only"))
        .join("\n");
      expect(measure(cut).tableRows("カテゴリ別収集状態")).toBeLessThan(7);
    });

    it("確定回答を要約に置き換えると、逐語の床を割る", () => {
      const cut = full.replace(/\*\*回答\*\*: .*/, "**回答**: Better Auth を採用。");
      expect(measure(cut).answerLength).toBeLessThan(ANSWER_FLOOR);
    });

    it("非規範注記を消すと見つかる", () => {
      const cut = full.replace("**非規範・取得証跡なし・実装根拠に使用不可**", "参考");
      expect(measure(cut).hasNonNormativeNote).toBe(false);
    });

    it("原則を 1 件に減らすと床を割る", () => {
      const cut = full.split("\n").filter((l) => !l.startsWith("- 原則: 秘密情報")).join("\n");
      expect(measure(cut).principles).toBeLessThan(PRINCIPLE_FLOOR);
    });
  });
});
