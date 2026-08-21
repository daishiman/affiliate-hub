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
    /*
      **本体の `vitest.config.mts` と同じ別名を置く。**
      ここが本体より少ないと、読み込めない検査ファイルが出る。

      --- 少ないとどうなるかの実測（2026-08-19） ---
      `server-only` の別名がここに無かったあいだ、
      `import "server-only"` に行き着く検査ファイル **10 本**が
      「読み込めない」で 0 件のまま終わっていた（対象 66 本中）。
      本体の設定では同じ 10 本が動く。

      問題は落ちたことではなく、**落ちても分からなかった**ことである。
      Stryker はこれを「テストが落ちた」ではなく
      **「そのコードにはテストが無い」**として数え、スコアの分母に入れる。
      検査は在るのに、無いことにされた状態で点が出ていた。

      同じ穴が開きっぱなしにならないよう、
      `tests/architecture/mutation-config-alias.test.ts` で
      2 つの設定の別名を突き合わせている。**別名を減らす向きで直さない。**
    */
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/support/server-only-stub.ts", import.meta.url)),
    },
  },
});
