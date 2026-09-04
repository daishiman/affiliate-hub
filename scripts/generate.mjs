#!/usr/bin/env node
/**
 * 生成物を、まとめて作り直す 1 つの入口。
 *
 * --- なぜ要るか ---
 *
 * 生成物が古くなったことは `tests/architecture/generated-doc-freshness.test.ts`
 * が捕まえる。捕まえた後の文面には直し方まで書いてある
 * （`node scripts/traceability.mjs` を走らせてください）。
 * それでも古いまま出ていくことが続いた。理由は 2 つある。
 *
 *   1. **直す道具の名前を覚えていないと直せない。** 生成物は 3 つあり、
 *      作り直す script も 3 本ある。どれが何を書くかは、書いた人しか知らない。
 *   2. **`pnpm verify` は 14 分かかる。** 8 秒で終わる直しのために
 *      14 分の門を通す人はいない。通さないので、古いまま push される。
 *
 * ここは 2 に効く。3 本を続けて走らせて 8 秒で返す。
 * 1 に効かせるのは `GENERATED_DOC_CHECKS` のほうで、
 * 「どれを走らせるか」を人の記憶から `quality-gates.config.mjs` へ移してある。
 *
 * --- 途中で止めない ---
 *
 * `pnpm verify` は止める検査が落ちたらそこで終わる。原因の切り分けのためで、
 * あちらではそれが正しい。**ここでは逆にする。** 走らせる目的は判定ではなく
 * 生成なので、1 本目が赤でも 2 本目・3 本目の生成物は作り直したい。
 * 途中で止めると「1 回走らせるたびに 1 つずつ直る」形になり、
 * ここが解こうとしている待ち時間の問題がそのまま戻ってくる。
 *
 * ```
 * pnpm run generate
 * ```
 *
 * 判定は落ちたままにする（赤は赤で返す）。作り直しは全部やる。
 */

import { spawnSync } from "node:child_process";
import { CHECKS, GENERATED_DOC_CHECKS } from "../quality-gates.config.mjs";

const targets = GENERATED_DOC_CHECKS.map((id) => {
  const check = CHECKS.find((c) => c.id === id);
  if (check === undefined) {
    // 名簿だけが残って検査が消えた状態。黙って 0 本走らせるより落とす。
    process.stderr.write(
      `GENERATED_DOC_CHECKS の "${id}" に対応する検査が CHECKS にありません。\n` +
        "どちらかを消したときに、もう片方が取り残されています。\n",
    );
    process.exit(1);
  }
  return check;
});

/** @type {{label: string, ok: boolean}[]} */
const results = [];
for (const check of targets) {
  const [command, ...args] = check.command;
  process.stdout.write(`\n▶ ${check.label}（${[command, ...args].join(" ")}）\n`);
  const run = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  results.push({ label: check.label, ok: run.status === 0 });
}

process.stdout.write("\n" + "=".repeat(60) + "\n");
for (const r of results) process.stdout.write(`${r.ok ? "OK  " : "NG  "} ${r.label}\n`);

const failed = results.filter((r) => !r.ok);
if (failed.length === 0) {
  process.stdout.write("\n生成物は最新です。\n");
  process.exit(0);
}
process.stdout.write(
  `\n生成物は全部作り直しました。判定が落ちたのは ${failed.length} 件です: ` +
    `${failed.map((f) => f.label).join(" / ")}\n` +
    "**上限を上げて緑にすることは禁止です。**直し方は各検査の出力に出ています。\n",
);
process.exit(1);
