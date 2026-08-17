import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { GLOBAL_COVERAGE } from "./quality-gates.config.mjs";

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
      既定の 5 秒だと、画面を描く検査（Next.js のページを取り込んで描き、
      読み上げの自動検査までかける）がカバレッジ計測と重なったときに時々超える。
      **判定は 1 つも緩めていない**（違反 0 件・見出しの決まりはそのまま）。
      待ち時間だけを広げる理由は、「たまに赤くなる検査」を放置すると
      赤そのものが無視されるようになり、検査が飾りになるため。
    */
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      // 閾値をここに書かない。`quality-gates.config.mjs` が唯一の正本で、
      // CI・手元・記録の 3 者が同じ数字を見る状態を崩さない。
      thresholds: GLOBAL_COVERAGE,
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
    },
  },
});
