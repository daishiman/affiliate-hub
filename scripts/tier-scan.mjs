/**
 * テストファイルに付いた「段の印」を読む。
 *
 * 印は **`@tier <番号>`** の 1 行だけ。ファイルが持つのはこれだけで、
 * どこで走らせるか（機械 / 手元 / 手動）は書かない。実行場所は
 * `quality-gates.config.mjs` の `TIERS` が 1 か所で決める。
 *
 * 分けてある理由は 1 つ。**将来このリポジトリを非公開にしたとき、
 * テストを消すのではなく移せるようにする**ため。
 * 消す判断は戻せないが、移す判断は戻せる。
 * ファイル側に実行場所を書くと、移すたびに全テストを触ることになり、
 * そのとき人は「移す」より「消す」を選ぶ。
 *
 * 読み手は 3 つ:
 *   - `scripts/tier-audit.mjs`   印の無いファイルを見つけて落とす
 *   - `scripts/run-tests.mjs`    段で絞って走らせる
 *   - `vitest.config.mts`        絞り込みを vitest の対象に渡す
 *
 * 規範: docs/spec/11-CI-CD・品質ゲート仕様.md §8
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { TIER_IDS } from "../quality-gates.config.mjs";

/**
 * 印の書き方。`// @tier 1` でも `* @tier 1` でも拾う。
 *
 * `g` を付けてあるのは、**2 つ書いてあることを見つける**ため。
 * 1 つ目だけ読むと、`@tier 3` を書き足して重いテストを夜間へ逃がしたつもりの人が、
 * 実は 1 段のまま走り続けていることに気づけない。
 */
const MARKER = /@tier\s+(\d+)/g;

/** 印を書く場所。ファイルの先頭付近に限る（本文の途中に隠さない）。 */
const HEADER_LINES = 40;

/**
 * `tests/` 以下のテストファイルを全部集める。
 *
 * @param {string} dir
 * @returns {string[]}
 */
function collect(dir) {
  /** @type {string[]} */
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...collect(full));
    else if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) out.push(full);
  }
  return out.sort();
}

/**
 * 1 ファイルの印を判定する。ファイルを読まないので単体で試せる。
 *
 * @param {string} source ファイルの中身
 * @returns {{ tier: number | null, problem: null | "missing" | "unknown" | "duplicate", found: number[] }}
 */
export function readTier(source) {
  const header = source.split("\n").slice(0, HEADER_LINES).join("\n");
  const found = [...header.matchAll(MARKER)].map((m) => Number(m[1]));
  if (found.length === 0) return { tier: null, problem: "missing", found };
  if (new Set(found).size > 1) return { tier: null, problem: "duplicate", found };
  const tier = found[0];
  if (!TIER_IDS.includes(tier)) return { tier: null, problem: "unknown", found };
  return { tier, problem: null, found };
}

/**
 * `tests/` 以下を全部見る。
 *
 * @param {string} [root]
 * @returns {{ path: string, tier: number | null, problem: null | "missing" | "unknown" | "duplicate", found: number[] }[]}
 */
export function scanTiers(root = process.cwd()) {
  return collect(join(root, "tests")).map((file) => ({
    path: relative(root, file).split("\\").join("/"),
    ...readTier(readFileSync(file, "utf8")),
  }));
}

/**
 * 指定した段に属するテストファイルの一覧。
 *
 * 印に問題のあるファイルはここから**黙って落ちる**。
 * だから `tier-audit.mjs` を必ず先に走らせる（`CHECKS` の並びでそうしてある）。
 *
 * @param {number[]} tiers
 * @param {string} [root]
 * @returns {string[]}
 */
export function filesForTiers(tiers, root = process.cwd()) {
  return scanTiers(root)
    .filter((f) => f.tier !== null && tiers.includes(f.tier))
    .map((f) => f.path);
}
