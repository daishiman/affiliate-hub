/**
 * 段で絞ってテストを走らせる。
 *
 * ```
 * node scripts/run-tests.mjs --coverage       既定（= 1 段 + 2 段）。閾値も見る
 * node scripts/run-tests.mjs --tier 1         1 段だけ。閾値は見ない
 * node scripts/run-tests.mjs --tier 2,3       複数指定
 * ```
 *
 * **閾値を「段を絞ったとき」に見ない理由。**
 * カバレッジは走らせたテストの集合に対してしか測れない。
 * 1 段だけで 80% を要求すると、達成する手段は「閾値を下げる」しか無くなる。
 * それは禁じているので、閾値は `runOn: "ci"` の段をまとめて走らせたとき
 * ——つまり毎 PR、マージを止める場所——でだけ判定する。
 *
 * 段は「これから足す重いテストの置き場所」であって、
 * いまの 23 秒のスイートを分割するためのものではない。
 *
 * 規範: docs/spec/11-CI-CD・品質ゲート仕様.md §8
 */

import { spawnSync } from "node:child_process";
import { TIERS } from "../quality-gates.config.mjs";
import { filesForTiers } from "./tier-scan.mjs";

const argv = process.argv.slice(2);
const wantCoverage = argv.includes("--coverage");

const tierArg = argv[argv.indexOf("--tier") + 1];
const explicit = argv.includes("--tier")
  ? tierArg
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n))
  : null;

const defaultTiers = TIERS.filter((t) => t.runOn === "ci").map((t) => t.id);
const tiers = explicit && explicit.length > 0 ? explicit : defaultTiers;

const unknown = tiers.filter((id) => !TIERS.some((t) => t.id === id));
if (unknown.length > 0) {
  console.error(`知らない段です: ${unknown.join(", ")}`);
  process.exit(1);
}

const files = filesForTiers(tiers);

/**
 * 対象 0 件を通さない。
 *
 * 印の書き間違い 1 つで対象が空になり、**テストを 1 件も走らせないまま緑**になる。
 * 3 段だけはまだ中身が無いので、空でも通す（これから足す置き場所）。
 */
const allCiTiers = tiers.every((id) => TIERS.find((t) => t.id === id)?.runOn === "ci");
if (files.length === 0 && allCiTiers) {
  console.error(`段 ${tiers.join(", ")} に属するテストが 1 件もありません。`);
  console.error("印の書き間違いの可能性があります（node scripts/tier-audit.mjs で確認）。");
  process.exit(1);
}
if (files.length === 0) {
  console.log(`段 ${tiers.join(", ")} は対象 0 件（まだ中身がありません）。`);
  process.exit(0);
}

/**
 * 段を絞ったときに閾値を外す。
 *
 * 下げるのではなく**測らない**。下げた値は次に見た人には
 * 「元からこの水準だった」としか見えないが、外したことは記録に残る。
 */
const partial = tiers.length !== defaultTiers.length || !defaultTiers.every((id) => tiers.includes(id));

const args = ["vitest", "run", ...files];
if (wantCoverage) args.push("--coverage");

const label = tiers.map((id) => TIERS.find((t) => t.id === id).label).join(" + ");
console.log(`段 ${tiers.join(", ")}（${label}）: ${files.length} ファイル`);
if (partial && wantCoverage) {
  console.log("段を絞っているため、カバレッジ閾値は判定しません（走らせた集合が全体ではないため）。");
}

const result = spawnSync("pnpm", ["exec", ...args], {
  stdio: "inherit",
  env: { ...process.env, VITEST_TIERS: tiers.join(","), VITEST_TIER_PARTIAL: partial ? "1" : "" },
});

process.exit(result.status ?? 1);
