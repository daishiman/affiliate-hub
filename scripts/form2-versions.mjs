#!/usr/bin/env node
/**
 * 「② の形の検査」を、**数え方の版ごとに**数え直す道具。
 *
 * 背景（`docs/product/backlog.md` 78 ㉝）:
 * 上限は下げる向きにしか動かさない、という約束は、**数え方の定義が固定されている
 * 場合にしか効かない**。定義を動かせば、実態が同じでも数は動く。
 * だから「数える条件を動かしたら、動かす前の条件と、そのとき出た数も一緒に残す」。
 *
 * この道具は、その約束を**実行できる形**にしたもの。定義を 1 つの配列に名前つきで
 * 並べ、同じ木を全版で数えて並べて出す。次に定義を変える人は、`DEFINITIONS` の
 * 末尾へ 1 つ足すだけでよい。**既存の版を書き換えないこと。**書き換えると、
 * 「前の条件で数えるといくつだったか」が復元できなくなり、この道具の存在理由が消える。
 *
 * 使い方:
 *   node scripts/form2-versions.mjs             # この作業ツリーを数える
 *   node scripts/form2-versions.mjs <path> ...  # 別の木（過去の worktree など）も数える
 *
 * 出せないもの:
 * - **実態を変えずに書き方だけを機械に見える形へ寄せた変更（78 ㉝ の (iii)）は、
 *   この道具では見つからない。**全版が同じように下がるだけで、版どうしの差が出ない。
 *   (iii) を見つける手は陽性対照（足した床だけを消して緑に戻るか）のほうであり、
 *   この道具ではない。数字が全版で下がったことを改善の根拠に使わないこと。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// ---------------------------------------------------------------------------
// 版によって動く部分
// ---------------------------------------------------------------------------

/** 「空であること」の言い方。D1 は 1 行で書いていたため、整形で折れた形を落としていた。 */
const EMPTY_ONELINE = /toStrictEqual\(\[\]\)|toHaveLength\(0\)|\.toBe\(0\)/;
const EMPTY_WRAPPED =
  /(toStrictEqual|toEqual)\(\s*\[\s*\]\s*,?\s*\)|toHaveLength\(\s*0\s*,?\s*\)|\.toBe\(\s*0\s*,?\s*\)/;

/** 集めた結果を受ける変数の見つけ方。直書きだけを見る版。 */
const VARS_DIRECT = (text) =>
  [...text.matchAll(/const\s+(\w+)\s*=\s*[^\n;]*(readdirSync|pythonSources|walk\()/g)].map(
    (m) => m[1],
  );

/** 同上。集める関数を先に拾い、その関数を通した変数も数える 2 段の版。 */
const VARS_TWO_STEP = (text) => {
  const collectors = [
    ...text.matchAll(/function\s+(\w+)\s*\([^)]*\)[\s\S]{0,800}?(readdirSync|globSync)/g),
  ].map((m) => m[1]);
  const via = collectors.length ? `|${collectors.join("|")}` : "";
  const source = new RegExp(`readdirSync|globSync|pythonSources|walk\\(${via}`);
  return [...text.matchAll(/const\s+(\w+)\s*=\s*(?=([\s\S]{0,300}))/g)]
    .filter((m) => source.test(m[2].split(/\n\s*(?:const|let|function|describe|it)\b/)[0]))
    .map((m) => m[1]);
};

/**
 * 版の一覧。**足すのは末尾だけ。既存の行は書き換えない。**
 * `id` は報告に書くときの呼び名（78 と backlog の表がこの id を使う）。
 */
const DEFINITIONS = [
  {
    id: "D1",
    label: "初版（空の言い方は 1 行のみ／集めた変数は直書きのみ）",
    empty: EMPTY_ONELINE,
    vars: VARS_DIRECT,
  },
  {
    id: "D2",
    label: "4 度目（空の言い方が改行に対応／集めた変数は直書きのみ）",
    empty: EMPTY_WRAPPED,
    vars: VARS_DIRECT,
  },
  {
    id: "D3",
    label: "現行（空の言い方が改行に対応／集めた変数は 2 段）",
    empty: EMPTY_WRAPPED,
    vars: VARS_TWO_STEP,
  },
];

// ---------------------------------------------------------------------------
// 版によって動かない部分（一度も変えていない）
// ---------------------------------------------------------------------------

/** 床（母集団そのものの件数の下限）の見つけ方。 */
const FLOOR = /(\.length|\.size)[\s\S]{0,120}?toBeGreaterThan|toBeGreaterThan(Or\w+)?\(\s*[0-9]/;
/** 「集めている」ことの手がかり。 */
const GATHER = /readdirSync|readFileSync|globSync|pythonSources|CONFIRMED|walk\(/;
/** この道具自身を数えると自己言及で数が濁るため、床の検査そのものは母集団から外す。 */
const SELF = "form2-population-floor.test.ts";

function testFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) testFiles(path, out);
    else if (path.endsWith(".ts") || path.endsWith(".tsx")) out.push(path);
  }
  return out;
}

/** `it(...)` の本体を、括弧の対応を数えて切り出す。 */
function itBlocks(text) {
  const blocks = [];
  const head = /\bit(?:\.each\([\s\S]*?\))?\s*\(/g;
  let match;
  while ((match = head.exec(text))) {
    const open = text.indexOf("{", match.index);
    if (open < 0) continue;
    let depth = 0;
    let i = open;
    for (; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}" && --depth === 0) break;
    }
    blocks.push({ body: text.slice(open, i + 1), line: text.slice(0, match.index).split("\n").length });
  }
  return blocks;
}

function count(root, definition) {
  let family = 0;
  let outside = 0;
  const withoutFloor = [];
  for (const file of testFiles(join(root, "tests"))) {
    if (file.endsWith(SELF)) continue;
    const text = readFileSync(file, "utf8");
    const vars = definition.vars(text);
    for (const block of itBlocks(text)) {
      if (!definition.empty.test(block.body)) continue;
      const gathers =
        GATHER.test(block.body) || vars.some((v) => new RegExp(`\\b${v}\\b`).test(block.body));
      if (!gathers) {
        outside++;
        continue;
      }
      family++;
      if (!FLOOR.test(block.body)) withoutFloor.push(`${relative(root, file)}:${block.line}`);
    }
  }
  return { family, withoutFloor, outside };
}

const roots = process.argv.slice(2).map((p) => resolve(p));
const targets = roots.length > 0 ? roots : [resolve(import.meta.dirname, "..")];
const verbose = process.env.FORM2_LIST === "1";

for (const root of targets) {
  console.log(`\n### ${root}`);
  console.log("| 版 | 数え方 | 族 | 床なし | 族外 |");
  console.log("| --- | --- | ---: | ---: | ---: |");
  for (const definition of DEFINITIONS) {
    const r = count(root, definition);
    console.log(
      `| ${definition.id} | ${definition.label} | ${r.family} 件 | ${r.withoutFloor.length} 件 | ${r.outside} 件 |`,
    );
    if (verbose) for (const where of r.withoutFloor) console.log(`      床なし: ${where}`);
  }
}
