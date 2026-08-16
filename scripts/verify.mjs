#!/usr/bin/env node
/**
 * 手元で、機械と同じ検査を同じ順で走らせる。
 *
 * **CI がやることをここに書き写さない。** 書き写した瞬間に 2 つの正本ができ、
 * 「手元では通るのに機械で落ちる」が起きる。CI 側もこのファイルを呼ぶだけにする。
 *
 * 走らせるもの・順番・止めるかどうかは `quality-gates.config.mjs` が決める。
 * ここにあるのは実行の仕方だけで、判断は 1 つも入っていない。
 *
 * 規範: docs/spec/11-CI-CD・品質ゲート仕様.md §2 / docs/product/ci-cd-guide.md ③
 */

import { spawnSync } from "node:child_process";
import { CHECKS } from "../quality-gates.config.mjs";

const started = Date.now();
/** @type {{ id: string, label: string, ok: boolean, blocking: boolean, seconds: number }[]} */
const results = [];

for (const check of CHECKS) {
  const [command, ...args] = check.command;
  process.stdout.write(`\n▶ ${check.label}（${check.command.join(" ")}）\n`);
  const at = Date.now();
  const run = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  const ok = run.status === 0;
  results.push({
    id: check.id,
    label: check.label,
    ok,
    blocking: check.blocking,
    seconds: Math.round((Date.now() - at) / 100) / 10,
  });

  // 止める検査が落ちたら、そこで終わる。
  // 先へ進めると、後続の失敗が最初の失敗の結果なのか別問題なのか分からなくなる。
  if (!ok && check.blocking) break;
}

process.stdout.write("\n" + "=".repeat(60) + "\n");
for (const r of results) {
  const mark = r.ok ? "OK  " : r.blocking ? "NG  " : "警告";
  process.stdout.write(`${mark} ${r.label}（${r.seconds} 秒）\n`);
}

const failed = results.filter((r) => !r.ok && r.blocking);
const skipped = CHECKS.length - results.length;
if (skipped > 0) {
  process.stdout.write(`--   残り ${skipped} 件は実行していません（前の検査で止まったため）\n`);
}
process.stdout.write(`合計 ${Math.round((Date.now() - started) / 1000)} 秒\n`);

if (failed.length > 0) {
  process.stdout.write(
    `\n落ちた検査: ${failed.map((f) => f.label).join(" / ")}\n` +
      "直し方は docs/product/ci-cd-guide.md ④ を見てください。\n" +
      "**閾値を下げて緑にすることは禁止です。**\n",
  );
  process.exit(1);
}
process.stdout.write("\nすべて通りました。\n");
