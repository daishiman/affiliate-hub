/**
 * @tier 1
 * @req REQ-TS17
 * @types contract, boundary, equivalence
 *
 * `equivalence` を名乗る根拠: この検査の本体は**母集団をテストの外から実行時に集めているか
 * どうか**での 2 分割で、族（32 件）と族に入らないもの（262 件）がその 2 クラスである。
 * 検査 1 は**両方のクラスが空でないこと**を見ている。片方だけを見ると、
 * 分割そのものが壊れて全部が片側へ落ちたときに気づけない。
 * `boundary` の根拠は 0 件・上限 25 件・下限 32 件という境目そのものを見ていること。
 *
 * 「0 件である」と主張している検査に、**その 0 の母集団の件数の床**が同居しているか。
 *
 * --- なぜ要るのか ---
 *
 * ② の形（塞げていない穴を「いま 0 件」と固定し、塞がった日に赤くなる）は、
 * **0 が 2 通りの理由で出る**——悪さが消えたときと、**数える対象そのものが消えたとき**。
 * 後者では検査は緑のまま黙る。2026-08-19 に実測した:
 * `spec-state-writer-gap.test.ts` の走査論理を node で走らせると、
 * 走査対象が 5 件でも 0 件でも同じ `[]` が出る。**この 1 件だけでは区別できない。**
 *
 * 同じ日に C03 を再生成したとき、`doctrine-citation-gap.test.ts` だけが
 * 「穴が塞がった」と「母集団が消えた」を見分けられた。**40 文・8 章の床が
 * 同居していたから**である（残課題 102）。床の有無が、そのまま判別できるかどうかだった。
 *
 * --- 対で見る ---
 *
 * `FORM2_MAX_WITHOUT_FLOOR`（上限・下げる向きのみ）だけでは抜けられる。
 * 床を足す代わりに**検査そのものを消せば**上限は下がるからである。
 * `FORM2_MIN_FAMILY`（下限・上げる向きのみ）がその道を塞ぐ。
 * **逆向きであることが仕掛けの本体で、揃えると抜け道が開く。**
 *
 * --- この検査の限界（先に書く）---
 *
 * 床を「`.length` に対する `toBeGreaterThan` 系」で見つけるので、**別の形の床は見えない。**
 * `guard-inline-python-hole.test.ts` は止まる例を同居させる形で床を張っているが、
 * ここには見えていない。逆に `copy-dictionary.test.ts:125` は床を持つと判定されるが、
 * 張り先が走査対象ではなく辞書である。**2 つの誤りは逆向きで、いまは相殺している。**
 * 数が合っているのは測れているからではない。次に触る人はここを疑うこと。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { FORM2_MAX_WITHOUT_FLOOR, FORM2_MIN_FAMILY } from "../../quality-gates.config.mjs";

const ROOT = process.cwd();

/** 「0 件である」と主張している形。 */
const EMPTY = /toStrictEqual\(\[\]\)|toEqual\(\[\]\)|toHaveLength\(0\)|\.toBe\(0\)/;

/** 母集団の件数そのものに張られた床。**行に依存させない**（整形で改行が入る）。 */
const FLOOR = /(\.length|\.size)[\s\S]{0,120}?toBeGreaterThan|toBeGreaterThan(Or\w+)?\(\s*[0-9]/;

/** 母集団が実行時にテストの外から集められている印。 */
const GATHER = /readdirSync|readFileSync|globSync|pythonSources|CONFIRMED|walk\(/;

function testFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) testFiles(full, out);
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** `it(...)` を波括弧の対応で切り出す。行数で切ると入れ子で位置を間違える。 */
function itBlocks(text: string): { head: string; body: string; line: number }[] {
  const out: { head: string; body: string; line: number }[] = [];
  const re = /\bit(?:\.each\([\s\S]*?\))?\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const open = text.indexOf("{", m.index);
    if (open < 0) continue;
    let depth = 0;
    let i = open;
    for (; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    out.push({
      head: text.slice(m.index, text.indexOf("\n", m.index)).trim(),
      body: text.slice(open, i + 1),
      line: text.slice(0, m.index).split("\n").length,
    });
  }
  return out;
}

type Unit = { where: string; floored: boolean };

function survey(): { family: Unit[]; literalOnly: number } {
  const family: Unit[] = [];
  let literalOnly = 0;
  for (const file of testFiles(join(ROOT, "tests"))) {
    // この検査自身は数えない。自分の中の正規表現が族に見えてしまう。
    if (file.endsWith("form2-population-floor.test.ts")) continue;
    const text = readFileSync(file, "utf8");
    const topVars = [...text.matchAll(/const\s+(\w+)\s*=\s*[^\n;]*(readdirSync|pythonSources|walk\()/g)].map(
      (m) => m[1],
    );
    for (const b of itBlocks(text)) {
      if (!EMPTY.test(b.body)) continue;
      const gathers =
        GATHER.test(b.body) || topVars.some((v) => new RegExp(`\\b${v}\\b`).test(b.body));
      if (!gathers) {
        literalOnly++;
        continue;
      }
      family.push({
        where: `${relative(ROOT, file)}:${b.line} ${b.head.slice(0, 50)}`,
        floored: FLOOR.test(b.body),
      });
    }
  }
  return { family, literalOnly };
}

describe("0 を主張する検査に、母集団の床が同居していること", () => {
  it("数える側が動いている（族も、族に入らないものも、両方見つかっている）", () => {
    // **0 の作り方は 2 通りある。**下の 2 つが 0 なら、それは
    // 「床が全部ある」のではなく「何も見ていない」ときにも出る数である。
    const { family, literalOnly } = survey();
    expect(family.length, "族が 1 件も見つかりません。切り出し方が壊れています").toBeGreaterThan(0);
    expect(literalOnly, "族に入らないものが 1 件も見つかりません。判別が効いていません").toBeGreaterThan(
      0,
    );
  });

  it("族そのものが減っていない（検査を消して数字を良くする道を塞ぐ）", () => {
    const { family } = survey();
    expect(
      family.length,
      `0 を主張する検査が ${FORM2_MIN_FAMILY} 件を下回りました。` +
        "床を足す代わりに検査を消していないか確かめてください。**上げる方向にしか動かしません**",
    ).toBeGreaterThanOrEqual(FORM2_MIN_FAMILY);
  });

  it("床を持たないものが増えていない", () => {
    const { family } = survey();
    const without = family.filter((u) => !u.floored);
    expect(
      without.length,
      `母集団の床が無い検査が ${without.length} 件あります（上限 ${FORM2_MAX_WITHOUT_FLOOR}）。\n` +
        `${without.map((u) => `  ${u.where}`).join("\n")}\n` +
        "**下げてよいのは、実際に床を足したときだけです**",
    ).toBeLessThanOrEqual(FORM2_MAX_WITHOUT_FLOOR);
  });
});
