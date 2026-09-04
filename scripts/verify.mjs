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
import { pathToFileURL } from "node:url";
import { TIERS, checksForTiers, orderViolations, staticChecks } from "../quality-gates.config.mjs";

/**
 * 目標時間を超えたかどうかの判定。**超過は警告どまりで、検査を落とさない**（`REQ-CI12`）。
 *
 * 時間で赤くすると、時間を守るためにテストを削る力が働く。
 * 守りたいのは速さではなく中身なので、超えたことは伝えるが、止めはしない。
 *
 * `blocking` は**常に false** である。ここを `true` にできる分岐を作らない
 * ——「今回だけ落とす」を許すと、次に時間を理由にテストが消える。
 */
export function judgeBudget(totalSeconds, budgetMinutes) {
  if (!(budgetMinutes > 0)) return { over: false, blocking: false, message: null };
  // 目標ちょうどは超過ではない。境目を上に置くのは、
  // 「目標 20 分で 20 分」を超過と呼ぶと、目標が実質 1 秒短くなるため。
  if (totalSeconds <= budgetMinutes * 60) return { over: false, blocking: false, message: null };
  return {
    over: true,
    blocking: false,
    message:
      `\n警告 目標の ${budgetMinutes} 分を超えています（${totalSeconds} 秒）。\n` +
      "テストを消す・skip する・閾値を下げるのではなく、重いものを次の段へ移してください。\n",
  };
}

/**
 * 経過時間を外から受け取る。**測定のためだけにある。**
 *
 * 超過したときの振る舞い（警告は出るが落ちない）は、実測が目標の内側にある限り
 * 一度も通らない。通らない道は、要件を満たしているかどうかを誰も確かめられない。
 *
 * 与えられたことは**必ず画面に出す**（`describeOverride`）。黙って遅さを隠せる形にすると、
 * 測定のための入口が、そのまま遅さを隠す入口になる。
 */
export function readElapsedOverride(env) {
  const raw = env?.VERIFY_ELAPSED_SECONDS;
  if (raw === undefined || raw === "") return null;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return { invalid: true, raw: String(raw) };
  return { invalid: false, seconds };
}

/** 外から時間を与えたことの告知。**出さない経路を作らない。** */
export function describeOverride(override, measuredSeconds) {
  if (!override || override.invalid) return null;
  return (
    `\n**時間を外から与えています（測定用）: ${override.seconds} 秒。実測は ${measuredSeconds} 秒です。**\n` +
    "この行が出ているときの合計時間は、実際にかかった時間ではありません。\n"
  );
}

/**
 * 走り終えたあとの判定をまとめる。
 *
 * **`exitCode` は `budget` を見ていない。**これが `REQ-CI12` そのものである。
 * 落とす理由は「止める検査が落ちたこと」だけで、時間は 1 度も混ざらない。
 */
export function judgeRun({ results, totalSeconds, budgetMinutes }) {
  const failed = results.filter((r) => !r.ok && r.blocking);
  const budget = judgeBudget(totalSeconds, budgetMinutes);
  return { failed, budget, exitCode: failed.length > 0 ? 1 : 0 };
}

/**
 * 実際に走らせる側。**判断は 1 つも持たない**——上の 4 つに渡して、答えを表示するだけ。
 *
 * 関数に入れてあるのは、上の判定を**走らせずに取り込める**ようにするため。
 * 取り込むだけで 15 分の検査が始まるファイルは、判定を検査できない。
 */
function main() {
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

  const staticOnly = argv.includes("--static");
  const selected = checksForTiers(tiers);
  const CHECKS = staticOnly ? staticChecks(selected) : selected;
  if (CHECKS.length === 0) {
    process.stderr.write(`段 ${tierArg} に属する検査がありません。\n`);
    process.exit(1);
  }
  if (staticOnly) {
    // **通ったことを「通った」と言わせない。**
    // ここで「すべて通りました」とだけ出すと、覗き窓が門の代わりに使われる。
    // 何を見ていないかを、見たものと同じ大きさで先に出す。
    const skipped = selected.filter((c) => !CHECKS.includes(c)).map((c) => c.label);
    process.stdout.write(
      `単独で答えを出せる ${CHECKS.length} 件だけを走らせます（push する前の覗き窓）。\n` +
        `**これは門ではありません。** 走らせないもの: ${skipped.join(" / ")}\n`,
    );
  }
  if (tiers) {
    const label = tiers.map((id) => TIERS.find((t) => t.id === id).label).join(" + ");
    process.stdout.write(`段 ${tiers.join(", ")}（${label}）の検査だけを走らせます。\n`);
  }

  // 「安いものから先に落とす」を、**1 本目を走らせる前に**確かめる。
  //
  // 同じ判定は `tests/architecture/quality-gates.test.ts` にもあるが、あれは
  // `test` の中で走る。並びが壊れたことを 858 秒の門の中で知るのでは、
  // **この仕組みが直そうとしている遅さを、この仕組み自身が持つ**ことになる。
  // ここは 0 秒で答えが出るので、ここで先に言う。
  const misordered = orderViolations(CHECKS);
  if (misordered.length > 0) {
    process.stderr.write("\n検査の並びが「安いものから先に落とす」を守っていません。\n");
    for (const v of misordered) process.stderr.write(`  - ${v.message}\n`);
    process.stderr.write("quality-gates.config.mjs の CHECKS を並べ替えてください。\n");
    process.exit(1);
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

  const skipped = CHECKS.length - results.length;
  if (skipped > 0) {
    process.stdout.write(`--   残り ${skipped} 件は実行していません（前の検査で止まったため）\n`);
  }

  const measuredSeconds = Math.round((Date.now() - started) / 1000);
  const override = readElapsedOverride(process.env);
  if (override?.invalid) {
    process.stderr.write(
      `VERIFY_ELAPSED_SECONDS に秒数でないものが入っています: ${override.raw}\n` +
        "0 以上の数を入れるか、変数ごと外してください。\n",
    );
    process.exit(1);
  }
  const totalSeconds = override ? override.seconds : measuredSeconds;
  const notice = describeOverride(override, measuredSeconds);
  if (notice) process.stdout.write(notice);
  process.stdout.write(`合計 ${totalSeconds} 秒\n`);

  const budgetMinutes = (tiers ?? TIERS.filter((t) => t.runOn === "ci").map((t) => t.id))
    .map((id) => TIERS.find((t) => t.id === id)?.targetMinutes ?? 0)
    .reduce((a, b) => a + b, 0);

  const verdict = judgeRun({ results, totalSeconds, budgetMinutes });
  if (verdict.budget.message) process.stdout.write(verdict.budget.message);

  if (verdict.failed.length > 0) {
    process.stdout.write(
      `\n落ちた検査: ${verdict.failed.map((f) => f.label).join(" / ")}\n` +
        "直し方は docs/product/ci-cd-guide.md ④ を見てください。\n" +
        "**閾値を下げて緑にすることは禁止です。**\n",
    );
  }
  if (verdict.exitCode === 0) {
    process.stdout.write(
      staticOnly
        ? "\n覗き窓は通りました。**門はまだ通っていません**（`pnpm run verify` が本番です）。\n"
        : "\nすべて通りました。\n",
    );
  }
  process.exit(verdict.exitCode);
}

// 直に叩かれたときだけ走らせる。取り込まれたときは判定だけを渡す。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
