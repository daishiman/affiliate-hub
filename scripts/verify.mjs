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
 * ```
 * pnpm run verify              既定（= 機械の上で走る段。いまは 1 段 + 2 段）
 * pnpm run verify --tier 1     1 段だけ。push ごとの速い門
 * ```
 *
 * 規範: docs/spec/11-CI-CD・品質ゲート仕様.md §2 §8 / docs/product/ci-cd-guide.md ③
 */

import { spawnSync } from "node:child_process";
import { TIERS, checksForTiers } from "../quality-gates.config.mjs";

const argv = process.argv.slice(2);
const tierArg = argv.includes("--tier") ? argv[argv.indexOf("--tier") + 1] : null;
const tiers = tierArg
  ? tierArg
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n))
  : null;

const unknown = (tiers ?? []).filter((id) => !TIERS.some((t) => t.id === id));
if (unknown.length > 0) {
  process.stderr.write(`知らない段です: ${unknown.join(", ")}\n`);
  process.exit(1);
}

const CHECKS = checksForTiers(tiers);
if (CHECKS.length === 0) {
  process.stderr.write(`段 ${tierArg} に属する検査がありません。\n`);
  process.exit(1);
}
if (tiers) {
  const label = tiers.map((id) => TIERS.find((t) => t.id === id).label).join(" + ");
  process.stdout.write(`段 ${tiers.join(", ")}（${label}）の検査だけを走らせます。\n`);
}

const started = Date.now();
/** @type {{ id: string, label: string, ok: boolean, blocking: boolean, seconds: number }[]} */
const results = [];

for (const check of CHECKS) {
  const [command, ...args] = check.command;
  // 段を絞ったときは、テストの実行にも同じ絞り込みを伝える。
  // 伝えないと「段 1 だけのつもりが全部走る」ことになり、段の意味が消える。
  if (tiers && check.id === "test") args.push("--tier", tiers.join(","));
  process.stdout.write(`\n▶ ${check.label}（${[command, ...args].join(" ")}）\n`);
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
const totalSeconds = Math.round((Date.now() - started) / 1000);
process.stdout.write(`合計 ${totalSeconds} 秒\n`);

/*
  時間の目標は**警告どまり**にする。時間で赤くすると、
  時間を守るためにテストを削る力が働く。守りたいのは速さではなく中身なので、
  超えたことは伝えるが、止めはしない。
*/
const budget = (tiers ?? TIERS.filter((t) => t.runOn === "ci").map((t) => t.id))
  .map((id) => TIERS.find((t) => t.id === id)?.targetMinutes ?? 0)
  .reduce((a, b) => a + b, 0);
if (budget > 0 && totalSeconds > budget * 60) {
  process.stdout.write(
    `\n警告 目標の ${budget} 分を超えています（${totalSeconds} 秒）。\n` +
      "テストを消す・skip する・閾値を下げるのではなく、重いものを次の段へ移してください。\n",
  );
}

if (failed.length > 0) {
  process.stdout.write(
    `\n落ちた検査: ${failed.map((f) => f.label).join(" / ")}\n` +
      "直し方は docs/product/ci-cd-guide.md ④ を見てください。\n" +
      "**閾値を下げて緑にすることは禁止です。**\n",
  );
  process.exit(1);
}
process.stdout.write("\nすべて通りました。\n");
