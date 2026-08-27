import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { GLOBAL_COVERAGE, SCREEN_RENDER_BUDGET_MS } from "./quality-gates.config.mjs";

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
    // .tsx を入れ忘れると、部品の描画テストが 1 件も走らないまま全部緑になる。
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // 画面を描くのに要る「要求ごとの入れ物」をここで 1 回だけ用意する。
    // テストファイルごとに書くと、書き忘れたファイルだけが落ちる。
    setupFiles: ["tests/setup.ts"],
    /*
      待ち時間の正本は `quality-gates.config.mjs` にある。**数字をここへ書き写さない。**
      画面を描く検査は自前の待ち時間を持つものと既定に任せるものが混ざっており、
      2 か所に数字があると**既定に任せている側だけが古い数字のまま取り残される。**
      2026-08-26 に実際そうなった: 自前で 20 秒を持つ検査を直しても、
      既定の 30 秒で走る `page-degraded` / `page-empty` が別の日に同じ形で落ちた。

      **判定は 1 つも緩めていない。**なぜ広げてよいのか、代わりに何が見えなく
      なるのかは向こうの説明に書いてある。
    */
    testTimeout: SCREEN_RENDER_BUDGET_MS,
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
