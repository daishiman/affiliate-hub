import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

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
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
