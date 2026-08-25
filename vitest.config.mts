import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { GLOBAL_COVERAGE } from "./quality-gates.config.mjs";
import { createTestProjects } from "./vitest.projects.mjs";

const NORMAL_MAX_WORKERS = Math.max(2, Math.ceil(availableParallelism() * 0.6));

/**
 * ドメイン層と依存方向の検査を回すための設定。
 *
 * ドメインは Next.js / Cloudflare の実行環境に依存しないため、
 * ここでは Workers ランタイムを立ち上げずに Node で実行する。
 * 画面と Workers 実行時の確認は `pnpm run preview` で別に行う。
 */
export default defineConfig({
  test: {
    environment: "node",
    // 対象ファイルは下の各 project に置く。親にも置くと extends が配列を結合し、
    // worker-runtime 側でも全テストが重複実行される。
    // 画面を描くのに要る「要求ごとの入れ物」をここで 1 回だけ用意する。
    // テストファイルごとに書くと、書き忘れたファイルだけが落ちる。
    setupFiles: ["tests/setup.ts"],
    /*
      既定の 5 秒だと、画面を描く検査（Next.js のページを取り込んで描き、
      読み上げの自動検査までかける）がカバレッジ計測と重なったときに時々超える。
      **判定は 1 つも緩めていない**（違反 0 件・見出しの決まりはそのまま）。
      待ち時間だけを広げる理由は、「たまに赤くなる検査」を放置すると
      赤そのものが無視されるようになり、検査が飾りになるため。
    */
    testTimeout: 30_000,
    /*
      **走らせる並列度に上限を置く。判定は 1 つも動かしていない。**

      2026-08-25 実測（10 コア、`npx vitest run` 全 296 ファイル / 7036 件）:
        既定の並列度: 6 件が 30 秒超で赤 → 再実行すると**別の 1 件**が赤
        `--maxWorkers=6`: **7036 件すべて緑**、しかも 293 秒 → 226 秒と**速い**

      その後の再実測では、6 worker のうち複数が `getPlatformProxy` を同時起動すると
      workerd が途中停止し、後続が ECONNREFUSED になった。同時に通常側の axe も
      CPU を待って 30 秒を超えた。そこで下の projects で、通常側を先に並列実行し、
      axe の10ファイルと workerd の15ファイルを別々に1ファイルずつ実行する。

      赤くなった中身はいずれも画面を描いて読み上げを自動検査するもので、
      単独で走らせると 143 件 19 秒で通る。つまり遅いのは検査ではなく、
      **コアの数より多くの worker が同時に取り合っていたこと**だった。
      待ち時間をもう一段広げても、取り合いは減らないので同じ日がまた来る。

      毎回違う 1 件が赤くなる検査は、**赤を「またあれか」と読ませる。**
      上の testTimeout の但し書きと同じ理由で、ここを直しておく。
    */
    maxWorkers: NORMAL_MAX_WORKERS,
    projects: createTestProjects(NORMAL_MAX_WORKERS),
    coverage: {
      provider: "v8",
      /*
        閾値をここに書かない。`quality-gates.config.mjs` が唯一の正本で、
        CI・手元・記録の 3 者が同じ数字を見る状態を崩さない。

        段を絞って走らせたとき（`run-tests.mjs --tier`）だけ判定を外す。
        カバレッジは**走らせたテストの集合に対してしか測れない**ので、
        一部の段だけで 80% を要求すると、達成する手段が「閾値を下げる」しか
        無くなる。下げるのは禁じているので、代わりに**測らない**。
        判定は `runOn: "ci"` の段をまとめて走らせる毎 PR で必ず行う。
      */
      thresholds: process.env.VITEST_TIER_PARTIAL ? undefined : GLOBAL_COVERAGE,
      /*
        測る対象を `src` 全体にする。ここを絞ると、
        **1 度も import されていないファイルが分母から消える**ため、
        手つかずの場所ほど数字に貢献しないどころか、存在ごと見えなくなる。
      */
      include: ["src/**/*.ts", "src/**/*.tsx"],
      // `.css` を含めると v8 が解析に失敗して PARSE_ERROR が並ぶ。
      exclude: ["src/**/*.d.ts", "src/**/*.css"],
      reporter: ["text-summary", "json-summary", "html"],
      reportsDirectory: "coverage",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      /*
        `server-only` は読み込まれた時点で例外を投げる仕掛けである
        （ブラウザ向けの束に入ったことをビルドの失敗として知らせるため）。
        検査は Node で走るので、身代わりに差し替えないと検査のほうが落ちる。
        **守りは外していない**: 本物を読むのは Next.js のビルドで、
        client から読んだら壊れる性質はそのまま残る。
      */
      "server-only": fileURLToPath(new URL("./tests/support/server-only-stub.ts", import.meta.url)),
    },
  },
});
