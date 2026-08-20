#!/usr/bin/env node
/**
 * 層ごとのカバレッジと、スタブとの差を出す。
 *
 * 全体 1 個の数字は、**どこが薄いかを隠す**。
 * スタブ（呼ばれたら失敗を返すだけの短い関数）は分母が小さくテストが通りやすいので、
 * そこだけ厚くしても全体の数字は上がる。
 * この「上げ方」を見抜くために、全体と実質（スタブを除く）を必ず並べて出す。
 *
 * `docs/product/coverage.md` の §2・§3 を、実測から書き換える。
 * 手で書き換えないのは、手で書いた数字は**古くなっても古く見えない**ため。
 *
 * 使い方: `pnpm run test:coverage` の後に実行する（`pnpm verify` が両方やる）。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2-1
 */

import { readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { writeGeneratedBlock } from "./lib/generated-doc.mjs";
import {
  COVERAGE_AXES,
  GLOBAL_COVERAGE,
  LAYER_COVERAGE,
  MAX_STUB_GAP_POINTS,
  STUB_PATTERNS,
  judgeLayerCoverage,
  judgeStubGap,
} from "../quality-gates.config.mjs";

/** 表示名。軸そのものの一覧は `COVERAGE_AXES` が正本で、ここでは持たない。 */
const AXIS_LABEL = { lines: "行", branches: "分岐", functions: "関数", statements: "文" };

const ROOT = process.cwd();
const SUMMARY = join(ROOT, "coverage/coverage-summary.json");
const DOC = join(ROOT, "docs/product/coverage.md");
// **2 つ目の一覧を作らない。**軸の正本は `COVERAGE_AXES` 1 つで、
// ここに別の並びを書くと、片方だけ増えた日に静かに食い違う。
const KEYS = COVERAGE_AXES;

if (!existsSync(SUMMARY)) {
  process.stderr.write(
    `カバレッジの記録が見つかりません: ${relative(ROOT, SUMMARY)}\n` +
      "先に `pnpm run test:coverage` を実行してください。\n",
  );
  process.exit(1);
}

const raw = JSON.parse(readFileSync(SUMMARY, "utf8"));

/** 空の集計箱。 */
const empty = () => Object.fromEntries(KEYS.map((k) => [k, { covered: 0, total: 0 }]));

const buckets = new Map(
  [...LAYER_COVERAGE.map((l) => l.layer), "全体", "実質", "スタブ"].map((n) => [n, empty()]),
);

const isStub = (path) => STUB_PATTERNS.some((p) => path.includes(p));

for (const [file, value] of Object.entries(raw)) {
  if (file === "total") continue;
  const path = relative(ROOT, file);
  const layer = LAYER_COVERAGE.find((l) => path.startsWith(l.dir))?.layer;
  const names = [layer, "全体", isStub(path) ? "スタブ" : "実質"].filter(Boolean);
  for (const key of KEYS) {
    for (const name of names) {
      const box = buckets.get(name)[key];
      box.covered += value[key].covered;
      box.total += value[key].total;
    }
  }
}

const pct = (box) => (box.total === 0 ? 0 : Math.round((box.covered * 1000) / box.total) / 10);
const row = (name) => Object.fromEntries(KEYS.map((k) => [k, pct(buckets.get(name)[k])]));

const overall = row("全体");
const real = row("実質");
const stub = row("スタブ");
/**
 * スタブが実質より何ポイント高いか。**広がる方向が数字合わせの兆候**。
 * 判定は片側だけ（理由は `judgeStubGap` と docs/product/coverage.md §3）。
 */
const { gap, exceeded: gapExceeded, note: gapNote } = judgeStubGap(real.lines, stub.lines);

// ─── 画面に出す ───────────────────────────────────────────
// UTC ではなく手元の日付にする。`toISOString()` だと朝 9 時前は前日になり、
// 記録が 1 日ずれる。ずれた記録は「いつ測ったか」を確かめる手段そのものを壊す。
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const pad = (s, n) => String(s).padEnd(n, " ");
process.stdout.write(`\nカバレッジ（${today} 実測）\n`);
process.stdout.write(`${pad("対象", 18)}${COVERAGE_AXES.map((a) => AXIS_LABEL[a].padStart(8)).join("")}\n`);

let failures = [];
for (const layer of LAYER_COVERAGE) {
  const r = row(layer.layer);
  // **4 列すべてを見る。**かつては `r.lines >= layer.target` だけを見ながら
  // 4 列を表示していたので、下限の無い列（分岐・関数・文）が守られていると誤読された。
  // 実測 2026-08-21: app の分岐 62.5 が、隣に印刷された 70 を下回ったまま緑を通っていた。
  // 判定式はここに書かない。`judgeLayerCoverage` を呼ぶ（正本は quality-gates.config.mjs）。
  // ここに式を持つと、外から合成例（分岐 62.5 など）を通せず、今回の穴が再び黙って通る。
  const shortfalls = judgeLayerCoverage(r, layer);
  const ok = shortfalls.length === 0;
  failures.push(...shortfalls);
  // 下限は**軸ごとに**印刷する。1 つの「下限」列を 4 列の隣に置くと、
  // その 1 個が 4 列すべてに効いていると読める（それが 2026-08-21 まで実際に起きていた）。
  process.stdout.write(
    `${pad(layer.layer, 18)}${COVERAGE_AXES.map((a) => String(r[a]).padStart(8)).join("")}${ok ? "" : "  ← 不足"}\n`,
  );
  process.stdout.write(
    `${pad("  └ 下限", 18)}${COVERAGE_AXES.map((a) => String(layer.floors[a]).padStart(8)).join("")}\n`,
  );
}
process.stdout.write(
  `${pad("全体", 18)}${COVERAGE_AXES.map((a) => String(overall[a]).padStart(8)).join("")}\n`,
);
process.stdout.write(
  `${pad("  └ 下限", 18)}${COVERAGE_AXES.map((a) => String(GLOBAL_COVERAGE[a]).padStart(8)).join("")}\n`,
);
process.stdout.write(`${pad("実質（スタブ除く）", 18)}${String(real.lines).padStart(8)}\n`);
process.stdout.write(`${pad("スタブのみ", 18)}${String(stub.lines).padStart(8)}\n`);
process.stdout.write(`スタブと実質の差: ${gap >= 0 ? "+" : ""}${gap}pt — ${gapNote}\n`);

if (gapExceeded) {
  failures.push(gapNote);
}

// ─── 記録を書き換える ─────────────────────────────────────
const table = [
  // 下限は軸ごとに `実測 / 下限` の形で並べる。1 列にまとめると 4 列すべてに
  // 効いていると読める（2026-08-21 まで実際にそう読めていた）。
  "| 層 | 行 | 分岐 | 関数 | 文 | 判定 |",
  "|---|---:|---:|---:|---:|---|",
  ...LAYER_COVERAGE.map((l) => {
    const r = row(l.layer);
    const cells = COVERAGE_AXES.map((a) => `${r[a]} / ${l.floors[a]}`);
    const ok = judgeLayerCoverage(r, l).length === 0;
    return `| ${l.dir} | ${cells.join(" | ")} | ${ok ? "達成" : "不足"} |`;
  }),
  `| **全体** | ${overall.lines} | ${overall.branches} | ${overall.functions} | ${overall.statements} | ${GLOBAL_COVERAGE.lines} | ${overall.lines >= GLOBAL_COVERAGE.lines ? "達成" : "不足"} |`,
  `| 実質（スタブ除く） | ${real.lines} | ${real.branches} | ${real.functions} | ${real.statements} | — | — |`,
  `| スタブのみ | ${stub.lines} | ${stub.branches} | ${stub.functions} | ${stub.statements} | — | — |`,
].join("\n");

const block = [
  "<!-- ここから下は scripts/coverage-report.mjs が書き換えます。手で編集しないでください。 -->",
  "<!-- 末尾の指紋がその見張りです。手で 1 文字でも書くと、次の実行が上書きせずに止まります（書いた行は残ります）。 -->",
  "",
  `計測日: ${today}`,
  "",
  table,
  "",
  `スタブと実質の差: **${gap >= 0 ? "+" : ""}${gap}pt** — ${gapNote}。`,
  `判定は片側だけ（スタブが実質を **${MAX_STUB_GAP_POINTS}pt** 超えて上回ったときだけ落とす）。`,
  "スタブは短くて分母が小さいため、そこを厚くするだけで全体の数字は上がってしまう。",
  "逆向き（実質のほうが厚い）は求めている姿なので止めない。理由は §3。",
  "",
  "<!-- ここまで -->",
].join("\n");

if (existsSync(DOC)) {
  // 指紋は**囲みの中身にだけ**かける。囲みの外は人が書く場所なので、
  // そこまで見ると本文を直すたびに赤くなり、やがて誰も見なくなる。
  // 式が指紋の行まで拾えていないと、囲みの外に指紋が溜まっていく。
  const marker =
    /<!-- ここから下は scripts\/coverage-report\.mjs[\s\S]*?<!-- ここまで -->(?:\n<!-- 生成物の指紋[^\n]*-->)?/;
  writeGeneratedBlock(DOC, marker, block);
  process.stdout.write(`\n${relative(ROOT, DOC)} を更新しました。\n`);
}

if (failures.length > 0) {
  process.stdout.write(`\n下限に届いていないものがあります:\n  - ${failures.join("\n  - ")}\n`);
  process.stdout.write("**下限を下げて緑にすることは禁止です**（docs/product/ci-cd-guide.md ④）。\n");
  process.exit(1);
}
process.stdout.write("\nすべての層が下限を満たしています。\n");
