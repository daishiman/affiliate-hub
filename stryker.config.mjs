/**
 * ミューテーションテスト（Stryker）の設定。
 *
 * **カバレッジが答えていないことを、外から確かめるための道具**である。
 * 約 91% の行カバレッジは「その行を通った」としか言っていない。
 * `return 42` を返すだけの関数に `expect(f()).toBe(42)` と書けば 100% になるが、
 * 仕様は 1 つも確かめていない。
 *
 * やり方は単純で、**コードをわざと壊して、テストが落ちるかを見る**。
 *   - 落ちた（killed）  そのテストは、その場所を本当に守っている
 *   - 落ちない（survived）その場所には、実質的にテストが無い
 *
 * 対象を `domain` と `application` に限る理由:
 *   - この 2 つはポートで外界から切れていて、単体で回せる（速い）
 *   - 壊れたときの被害が最も大きい（業務の決まりごとと手順）
 * `infrastructure` / `presentation` / `app` は対象外。
 * スタブが多く、外部との接続が本体なので、変異させても意味のある結果が出ない。
 * **対象外であることを隠さない**（`docs/spec/10-テスト戦略仕様.md` §10 に明記する）。
 *
 * ```
 * pnpm run mutation                  domain + application 全体（重い。3 段向け）
 * pnpm run mutation:changed          変更したファイルだけ（2 段向け）
 * ```
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §10 / docs/spec/11-CI-CD・品質ゲート仕様.md §8
 */

import { MUTATION_SCORE } from "./quality-gates.config.mjs";

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: "pnpm",
  plugins: ["@stryker-mutator/vitest-runner"],
  testRunner: "vitest",
  vitest: {
    configFile: "vitest.mutation.config.mts",
  },
  reporters: ["progress", "clear-text", "json"],
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  htmlReporter: { fileName: "reports/mutation/index.html" },

  mutate: ["src/domain/**/*.ts", "src/application/**/*.ts", "!src/**/*.d.ts"],

  /*
    Stryker はプロジェクト全体を作業用フォルダへ複製してから変異を当てる。
    その複製に、テストと無関係なものまで含めない。

    `.claude/` を外すのは速さのためではなく、**外さないと動かない**ため。
    中に通信用の特殊なファイル（socket）があり、複製の途中で ENOTSUP で止まる。
    速さのためだけなら書かない（外した分だけ見落としが増えるので、理由を要る）。
  */
  ignorePatterns: [
    ".claude/",
    ".dev-graph/",
    ".beads/",
    ".next/",
    ".open-next/",
    ".wrangler/",
    "coverage/",
    "reports/",
    "eval-log/",
    ".git/",
  ],

  /*
    閾値の正本は `quality-gates.config.mjs`。ここには書き写さない。

    `break` は「これを割ったら失敗」。**ゼロにしない。**
    ゼロにすると、走らせているだけで何も守らない状態になり、
    「ミューテーションテストがあります」という説明だけが残る。
  */
  thresholds: {
    high: MUTATION_SCORE.high,
    low: MUTATION_SCORE.low,
    break: MUTATION_SCORE.break,
  },

  // 1 つの変異でテストが無限ループに入ることがある（`i++` を `i--` にした等）。
  // 素の実行時間を測ってから、その何倍までを許すかを決める。
  timeoutFactor: 2,
  timeoutMS: 30_000,

  // 手元の CPU をすべて食うと他の作業が止まる。機械の上では自動で増える。
  concurrency: process.env.CI ? 4 : 6,

  /*
    static mutant（モジュール読込み時に 1 回だけ動く箇所＝トップレベル定数など）を対象外にする。

    **これは見落としを増やす設定なので、理由を書く。**
    domain + application 全体を `ignoreStatic: false` で 1 度実測したところ、
    12,927 個の変異のうち 3,876 個（30%）が static で、
    Stryker の見積りでそれが**実行時間の 98%**、全体で 20 時間超だった。
    static な変異はテストの絞り込みが効かず、1 個ごとに全テストを読み直すため。
    20 時間かかる検査は誰も走らせないので、走らないまま「やっています」になる。

    外した結果どこが見られなくなるかは `docs/product/mutation.md` に書く。
    主に `ALLOWED_RANKING_CRITERIA` や `GATE_REQUIREMENT_LABEL` のような定数表で、
    ここは中身が正しいかを表そのものに対するテストで確かめる（`tests/domain/` 側の責務）。

    全部を見たいときは `STRYKER_STATIC=1 pnpm run mutation`（20 時間かかる）。
  */
  ignoreStatic: process.env.STRYKER_STATIC !== "1",
  disableTypeChecks: "{src,tests}/**/*.{ts,tsx}",

  tempDirName: ".stryker-tmp",
  cleanTempDir: true,
};
