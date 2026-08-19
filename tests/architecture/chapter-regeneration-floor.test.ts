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
 * ── 2026-08-19: 1 章から 8 章へ広げた ────────────────────────────
 *
 * 最初は `auth.md` 1 章だけだった（8 章まとめて測ると、想定が外れたときに
 * どの想定が外れたのか分からないため）。**しかしそれは、守られているのが
 * 1 章だけということでもあった。**scratchpad の再生成結果を 8 章とも測ると、
 * **非規範注記は 8 章すべてで消える**（true → false、8/8）。残り 7 章は
 * 床が無いので、走らせた日に静かに消える（残課題 78 ㉔ の本体）。
 *
 * **床は章ごとに実測して置いた。auth の 153 行を他章へ写していない。**
 * 写すと 8 章のうち 7 章で床が実態とずれ、ずれた分だけ緑の意味が変わる。
 *
 * ── 行数の床は、この壊れ方を捕まえられない（実測）────────────────────
 *
 * 再生成後の行数は **backend 292 → 329・frontend 172 → 177** と**増える**。
 * 見出しの数も **backend 35 → 35・frontend 21 → 21** で変わらない。
 * それでも節と注記は失われる。**行数と見出しの床だけを置いていたら、
 * この 2 章は緑のまま中身を失う。**だから「断りが 1 つ残っていること」は
 * 行数とは別の 1 件として 8 章分持たせてある（残課題 78 ㉕）。
 *
 * ── 章の形は 2 通りある（これも実測で分かった）──────────────────
 *
 * 5 章（auth / frontend / maintenance-ops / security / ui-ux）は 11 節、
 * 3 章（backend / database / infrastructure）は 6 節で、後者は
 * `状態の意味 (State semantics)` 〜 `Acceptance evidence` の代わりに
 * `状態の意味と実装差分` 1 節を持つ。**必須節の一覧を 1 本にできない。**
 * 1 本にすると 3 章が今日から赤になるか、5 章の 5 節が床から外れるかのどちらかで、
 * どちらも「守っているつもり」を作る。
 *
 * ── 床は現在値そのもの ──────────────────────────────────
 *
 * 等号ではなく `以上` で置いてあるのは、再生成の目的が **decisions[] の追記**——
 * つまり増える方向——だからである。増えるのは通す。**減るところだけを止める。**
 * 上限は章ごとに 1 つだけ（床 + 150 行）。**上限は下げる方向にしか動かさない。**
 *
 * ── 当てどころが無いものは宣言しない ─────────────────────────
 *
 * `backend.md` には `**回答**: ` が **0 件**あり、確定回答の逐語の床を張る先が無い。
 * 0 件に対して「0 件以上」を置くと、壊しようのない緑が 1 件増えるだけである
 * （残課題 78 ㉗ と同じ理由）。**張らずに、張れないことをここに書く。**
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
  const answers = (text.match(/\*\*回答\*\*: [^\n]*/g) ?? []).map((s) => s.length - 8);
  return {
    lines: lines.length - 1,
    sections: lines.filter((l) => /^## /.test(l)).map((l) => l.slice(3)),
    headings: headings.length,
    tableRows,
    principles: (text.match(/^- 原則: /gm) ?? []).length,
    hasNonNormativeNote: text.includes("**非規範・取得証跡なし・実装根拠に使用不可**"),
    answers,
    shortestAnswer: answers.length === 0 ? 0 : Math.min(...answers),
  };
}

/** 11 節の形（As-Is / To-Be / Delta を別々に持つ章）。 */
const SHAPE_A = [
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

/** 6 節の形（`状態の意味と実装差分` 1 節にまとめてある章）。 */
const SHAPE_B = [
  "状態の意味と実装差分",
  "カテゴリ別収集状態",
  "確定内容 (質疑録)",
  "上流指針 (doctrine anchor)",
  "適用された設計知識",
  "最新ドキュメント出典",
] as const;

type Chapter = {
  /** ファイル名（`.md` を除く） */
  readonly name: string;
  readonly sections: readonly string[];
  /** 節ごとの表の本文行数の床。**その章に実在する節だけを書く。** */
  readonly tables: ReadonlyArray<readonly [string, number]>;
  readonly lines: number;
  readonly headings: number;
  readonly principles: number;
  /** 確定回答の最短の長さ。`null` は「`**回答**: ` が 0 件で張る先が無い」。 */
  readonly answer: number | null;
};

/**
 * **2026-08-19 に章ごと実測した値をそのまま置いている。**
 * 他章から写した値は 1 つも無い。上の doc comment の「写さない」はこの表のこと。
 */
const CHAPTERS: readonly Chapter[] = [
  {
    name: "auth",
    sections: SHAPE_A,
    tables: [
      ["To-Be", 5],
      ["Acceptance evidence", 6],
      ["カテゴリ別収集状態", 7], // gaps[6] が引用
      ["上流指針 (doctrine anchor)", 3], // gaps[2] が引用
      ["最新ドキュメント出典", 2], // gaps[1] が引用。REQ-TS14 が中身を見ている
    ],
    lines: 153,
    headings: 21,
    principles: 2,
    answer: 321, // qa-auth-web の回答は逐語。要約したら短くなる。
  },
  {
    name: "backend",
    sections: SHAPE_B,
    tables: [
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 3],
      ["最新ドキュメント出典", 2],
    ],
    lines: 292,
    headings: 35,
    principles: 2,
    answer: null, // `**回答**: ` が 0 件。張る先が無いので張らない。
  },
  {
    name: "database",
    sections: SHAPE_B,
    tables: [
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 3],
      ["最新ドキュメント出典", 2],
    ],
    lines: 219,
    headings: 21,
    principles: 2,
    answer: 23,
  },
  {
    name: "frontend",
    sections: SHAPE_A,
    tables: [
      ["To-Be", 5],
      ["Acceptance evidence", 5],
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 3],
      ["最新ドキュメント出典", 2],
      ["確定内容 (質疑録)", 9],
    ],
    lines: 172,
    headings: 21,
    principles: 2,
    answer: 31,
  },
  {
    name: "infrastructure",
    sections: SHAPE_B,
    tables: [
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 3],
      ["最新ドキュメント出典", 2],
    ],
    lines: 179,
    headings: 23,
    principles: 2,
    answer: 86, // 再生成後は 83 に痩せる（実測）。この床が止める。
  },
  {
    name: "maintenance-ops",
    sections: SHAPE_A,
    tables: [
      ["To-Be", 8],
      ["Acceptance evidence", 8],
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 2],
      ["最新ドキュメント出典", 2],
      ["確定内容 (質疑録)", 5],
    ],
    lines: 167,
    headings: 21,
    principles: 2,
    answer: 69,
  },
  {
    name: "security",
    sections: SHAPE_A,
    tables: [
      ["To-Be", 6],
      ["Acceptance evidence", 6],
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 2],
      ["最新ドキュメント出典", 2],
    ],
    lines: 173,
    headings: 21,
    principles: 2,
    answer: 8,
  },
  {
    name: "ui-ux",
    sections: SHAPE_A,
    tables: [
      ["To-Be", 5],
      ["Acceptance evidence", 5],
      ["カテゴリ別収集状態", 7],
      ["上流指針 (doctrine anchor)", 2],
      ["最新ドキュメント出典", 2],
    ],
    lines: 223,
    headings: 28,
    principles: 2,
    answer: 8,
  },
];

const CEILING_MARGIN = 150;

/**
 * 測定用の口。**通常の実行では開かない。**
 *
 * なぜ要るか: 床が再生成を実際に止められるかは、**再生成の結果に同じ床を当てて
 * 赤くなること**でしか示せない。ところが確定章への書き込みは hook が遮断するので、
 * 「実体を壊して測る」ができない（迂回しない）。そこで**読む先だけを差し替える**。
 *
 * **これは自分で満たせる条件＝残課題 78 の族 II そのものである。**
 * 太った別のフォルダを指せば床は通る。だから口が開いていないことを
 * 下の検査 1 件で見張り、**測定のときはその 1 件も一緒に赤くなる**ようにしてある。
 * 赤の件数を報告するとき、この 1 件は床の赤と別に数えること。
 */
const PROBE_DIR = process.env.CHAPTER_FLOOR_PROBE_DIR;
const SPEC_DIR = PROBE_DIR ?? join(ROOT, "system-spec");

function read(name: string): string {
  return readFileSync(join(SPEC_DIR, `${name}.md`), "utf8");
}

describe("8 章を再生成しても痩せないこと (C03 の事前の床)", () => {
  it("測定用の口が開いていない（通常の実行では確定章そのものを見ている）", () => {
    // 口が開いたままだと、床は「どこかの太ったフォルダ」を見て緑になる。
    // 測定のときはここも赤くなるので、赤の件数を数えるときに床の赤と混ぜないこと。
    expect(PROBE_DIR, "CHAPTER_FLOOR_PROBE_DIR が設定されたまま走っています").toBeUndefined();
  });

  it("床を置いた章が、確定 8 章と過不足なく一致している", () => {
    // 章を 1 つ足したときに床を置き忘れる形を止める。
    // **数える対象そのものが消える形**（残課題 78 ㉗）への当てでもある——
    // CHAPTERS が空になれば下の it.each は 0 件になり、全部緑のまま黙る。
    expect([...CHAPTERS].map((c) => c.name).sort()).toEqual([
      "auth",
      "backend",
      "database",
      "frontend",
      "infrastructure",
      "maintenance-ops",
      "security",
      "ui-ux",
    ]);
  });

  describe.each(CHAPTERS)("$name.md", (ch) => {
    const m = measure(read(ch.name));

    it("必須の節が名前と順序ごと残っている", () => {
      expect(m.sections).toEqual([...ch.sections]);
    });

    it("非規範注記が残っている（実装根拠に使えない参照であることの断り）", () => {
      // **行数とは別の 1 件**として持たせてある。行数の床だけだと、
      // 注記 1 行が消えても他が 1 行増えれば通る（backend と frontend は実際に増える）。
      expect(m.hasNonNormativeNote).toBe(true);
    });

    it(`見出しが ${ch.headings} 個以上ある（節を残して中身を空にする形を止める）`, () => {
      expect(m.headings).toBeGreaterThanOrEqual(ch.headings);
    });

    it.each(ch.tables)("表「%s」の本文行が %i 行以上ある", (name, floor) => {
      expect(m.tableRows(name)).toBeGreaterThanOrEqual(floor);
    });

    it(`本章での適用の原則が ${ch.principles} 件以上ある`, () => {
      expect(m.principles).toBeGreaterThanOrEqual(ch.principles);
    });

    it(`行数が ${ch.lines} 以上 ${ch.lines + CEILING_MARGIN} 以下にある`, () => {
      expect(m.lines).toBeGreaterThanOrEqual(ch.lines);
      expect(m.lines).toBeLessThanOrEqual(ch.lines + CEILING_MARGIN);
    });

    if (ch.answer !== null) {
      it(`確定回答が逐語のまま残っている（最短 ${ch.answer} 字以上）`, () => {
        expect(m.shortestAnswer).toBeGreaterThanOrEqual(ch.answer as number);
      });
    }
  });

  /**
   * 床は「満たしている」だけでは効いていることを示せない。
   * **痩せた章を合成して、同じ測り方が落とすことを見る。**
   * これが無いと、上の床は測る側が壊れていても同じ緑を返す。
   */
  describe("痩せた章を止められること", () => {
    describe.each(CHAPTERS)("$name.md", (ch) => {
      const full = read(ch.name);

      it("節を 1 つ落とすと、必須の節の一致が崩れる", () => {
        const last = ch.sections[ch.sections.length - 1];
        const cut = full.replace(`## ${last}\n`, "");
        expect(measure(cut).sections).not.toEqual([...ch.sections]);
      });

      it("非規範注記を消すと見つかる", () => {
        const cut = full.replace("**非規範・取得証跡なし・実装根拠に使用不可**", "参考");
        expect(measure(cut).hasNonNormativeNote).toBe(false);
      });

      it("収集状態の表から 1 行消すと床を割る", () => {
        const i = full.split("\n").findIndex((l) => l === "## カテゴリ別収集状態");
        const lines = full.split("\n");
        const at = lines.findIndex((l, j) => j > i && l.startsWith("|") && !/^\|\s*-+/.test(l));
        const cut = [...lines.slice(0, at), ...lines.slice(at + 1)].join("\n");
        expect(measure(cut).tableRows("カテゴリ別収集状態")).toBeLessThan(7);
      });
    });

    /** auth だけに置いてある壊し方（他章に同じ形の当てどころが無いもの）。 */
    describe("auth.md（この章にしかない当てどころ）", () => {
      const full = read("auth");

      it("対象外の 5 行を消すと、収集状態の表が床を割る", () => {
        const cut = full
          .split("\n")
          .filter((l) => !l.includes("approval-platform-web-only"))
          .join("\n");
        expect(measure(cut).tableRows("カテゴリ別収集状態")).toBeLessThan(7);
      });

      it("確定回答を要約に置き換えると、逐語の床を割る", () => {
        const cut = full.replace(/\*\*回答\*\*: .*/, "**回答**: Better Auth を採用。");
        expect(measure(cut).shortestAnswer).toBeLessThan(321);
      });

      it("原則を 1 件に減らすと床を割る", () => {
        const cut = full
          .split("\n")
          .filter((l) => !l.startsWith("- 原則: 秘密情報"))
          .join("\n");
        expect(measure(cut).principles).toBeLessThan(2);
      });
    });
  });
});
