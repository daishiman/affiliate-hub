import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * ミューテーションテスト専用の設定。
 *
 * 本体の `vitest.config.mts` と分けてあるのは 1 点だけ、**カバレッジを測らないため**。
 * ミューテーションは同じテストを何百回も走らせるので、
 * そのたびにカバレッジを計測すると時間が数倍になる。
 * 判定に使う数字はミューテーションスコアであって、行の網羅率ではない。
 *
 * 対象は 1 段（速い門）のテストだけにする。
 * 画面や結合を混ぜると、1 つの変異を殺したのがドメインのテストなのか
 * 画面のテストなのか分からなくなる。**どのテストが守っているか**を知るための計測なので、
 * ここは絞る方が情報が増える。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §10
 */
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/domain/**/*.test.ts",
      "tests/application/**/*.test.ts",
      "tests/property/**/*.test.ts",
    ],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
