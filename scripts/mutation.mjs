/**
 * ミューテーションテストを走らせて、スコアで合否を出す。
 *
 * Stryker を直に呼ばずに 1 枚かぶせている理由は 3 つある。
 *
 *   1. **対象 0 件を失敗にしない。** 変更が画面だけの PR では
 *      domain / application に変異させる場所が無い。そこで赤くすると、
 *      「関係ない検査が落ちる」経験が積み上がり、検査ごと外される。
 *   2. **閾値の正本を 1 つにする。** 判定は `quality-gates.config.mjs` の
 *      `MUTATION_SCORE.break` だけを見る。Stryker 側の設定とここで
 *      別々の数字を持たない。
 *   3. **スコアを必ず出力する。** 通ったときも数字を出す。
 *      出さないと、悪化しているのに緑のまま気づけない。
 *
 * ```
 * node scripts/mutation.mjs                domain + application 全体（3 段。16 分前後）
 * node scripts/mutation.mjs --changed      変更したファイルだけ（2 段）
 * node scripts/mutation.mjs --report-only  測り直さず、手元の報告書だけを judge する
 * ```
 *
 * `--report-only` は、夜間の結果を後から見直すときと、
 * **この門が本当に赤くなるかを数秒で確かめる**ときに使う
 * （落ちない門は、無い門と見分けが付かない）。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §10 / 実測: docs/product/mutation.md
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { MUTATION_MAX_CHANGED_FILES, MUTATION_SCORE } from "../quality-gates.config.mjs";

const REPORT = "reports/mutation/mutation.json";

/** 変更範囲を測るときの比較元。CI では PR の向き先を渡す。 */
const BASE = process.env.MUTATION_BASE ?? "origin/dev";

const changed = process.argv.includes("--changed");
const reportOnly = process.argv.includes("--report-only");

/**
 * 変異させる価値のある変更があるか。
 *
 * Stryker の `--since` は内部で同じことをするが、
 * **比較元が取れない環境**（浅い clone・比較元が未取得）で黙って
 * 全体実行に落ちることがある。2 段で全体が走ると 20 分近くかかるので、
 * ここで先に確かめて、取れないなら全体を走らせずに見送る。
 */
function changedTargets() {
  const base = spawnSync("git", ["rev-parse", "--verify", `${BASE}^{commit}`], {
    encoding: "utf8",
  });
  if (base.status !== 0) return { ok: false, files: [] };

  const diff = spawnSync("git", ["diff", "--name-only", `${BASE}...HEAD`], { encoding: "utf8" });
  if (diff.status !== 0) return { ok: false, files: [] };

  const files = diff.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^src\/(domain|application)\/.*\.ts$/.test(l) && !l.endsWith(".d.ts"));
  return { ok: true, files };
}

const args = ["stryker", "run"];

if (reportOnly) {
  console.log(`ミューテーション: 測り直さず、${REPORT} をそのまま judge します。`);
} else if (changed) {
  const target = changedTargets();
  if (!target.ok) {
    /*
      機械の上では比較元が必ず取れる（checkout の fetch-depth: 0 と
      MUTATION_BASE をそのために置いてある）。取れないなら設定が壊れており、
      **検査が走らなかったのに緑になる**という一番まずい状態にあたる。
      手元では比較元を持たないこともあるので、そこだけ見送りを許す。
    */
    if (process.env.CI) {
      console.error(`NG 比較元 ${BASE} が取れません。ミューテーションが走らないまま緑になります。`);
      console.error("checkout の fetch-depth と MUTATION_BASE を確認してください。");
      process.exit(1);
    }
    console.log(`ミューテーション: 比較元 ${BASE} が取れないため見送りました（手元のみ）。`);
    console.log("全体は 3 段（夜間）で走ります。手元で見たいときは `node scripts/mutation.mjs`。");
    process.exit(0);
  }
  if (target.files.length === 0) {
    console.log("ミューテーション: 今回の変更に domain / application のファイルがありません（対象 0 件）。");
    process.exit(0);
  }
  if (target.files.length > MUTATION_MAX_CHANGED_FILES) {
    console.log(
      `ミューテーション: 変更が ${target.files.length} 件で、2 段の上限 ${MUTATION_MAX_CHANGED_FILES} 件を超えています。`,
    );
    console.log("ここでは測らず、**3 段（夜間）の全体実測に回します**。");
    console.log("検査は消えていません。測る場所が変わるだけで、翌朝には同じコードが全体として測られます。");
    console.log("急ぐ場合は手元で `node scripts/mutation.mjs`（全体・12 分前後）を走らせてください。");
    process.exit(0);
  }
  console.log(`ミューテーション: 変更した ${target.files.length} 件だけを対象にします。`);
  for (const f of target.files) console.log(`  ${f}`);
  args.push("--mutate", target.files.join(","));
} else {
  console.log("ミューテーション: domain + application の全体を対象にします。");
}

const run = reportOnly
  ? { status: 0 }
  : spawnSync("pnpm", ["exec", ...args], { stdio: "inherit" });

/*
  Stryker 自身も閾値で終了コードを返すが、それに任せない。
  任せると「どの数字で落ちたか」がこちらの記録に残らず、
  設定を 2 か所で持つことになる。ここでは報告書から読み直して判定する。
*/
if (!existsSync(REPORT)) {
  console.error(`\nNG 報告書が出ていません（${REPORT}）。実行そのものが失敗しています。`);
  process.exit(run.status === 0 ? 1 : (run.status ?? 1));
}

const report = JSON.parse(readFileSync(REPORT, "utf8"));
const counts = { killed: 0, timeout: 0, survived: 0, noCoverage: 0, ignored: 0, error: 0 };
for (const file of Object.values(report.files ?? {})) {
  for (const mutant of file.mutants ?? []) {
    switch (mutant.status) {
      case "Killed":
        counts.killed++;
        break;
      case "Timeout":
        counts.timeout++;
        break;
      case "Survived":
        counts.survived++;
        break;
      case "NoCoverage":
        counts.noCoverage++;
        break;
      case "Ignored":
        counts.ignored++;
        break;
      default:
        counts.error++;
    }
  }
}

// 分母に「対象外にしたもの（Ignored）」を入れない。
// 入れると、対象外を増やすだけでスコアが動く。
const detected = counts.killed + counts.timeout;
const valid = detected + counts.survived + counts.noCoverage;
const score = valid === 0 ? null : Math.round((detected / valid) * 10000) / 100;

console.log("\nミューテーションスコア");
console.log(`  倒した        ${counts.killed}（時間切れ ${counts.timeout}）`);
console.log(`  生き残った    ${counts.survived}`);
console.log(`  テストが無い  ${counts.noCoverage}`);
console.log(`  対象外        ${counts.ignored}（分母に入れない）`);
console.log(`  スコア        ${score === null ? "測定なし" : `${score}%`}（下限 ${MUTATION_SCORE.break}%）`);

if (score === null) {
  console.log("\n変異させられる場所がありませんでした。判定はしません。");
  process.exit(0);
}

if (score < MUTATION_SCORE.break) {
  console.error(`\nNG スコアが下限を割りました（${score}% < ${MUTATION_SCORE.break}%）。`);
  console.error("生き残った変異を見て、テストを足してください。");
  console.error("**下限を下げて緑にすることを禁じます。** 下げる場合は docs/product/mutation.md に理由を書いてから下げます。");
  process.exit(1);
}

console.log("\nOK 下限を満たしています。");
