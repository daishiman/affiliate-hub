/*
  `tests/blog-top-page/` だけ `.spec.ts` を拾う。

  この repo の Vitest は `*.test.ts(x)` しか集めず、`*.spec.ts` は Playwright の
  `tests/e2e/` が使っている。トップ画面の受け入れ条件が求める証跡は
  `tests/blog-top-page/*.spec.ts` という名前で指定されているので、
  **名前を変えるのではなく、その 1 ディレクトリだけを集める側へ足す。**

  tests 配下の spec を丸ごと拾う書き方にしないのは、そうすると Playwright の 6 本が
  Vitest 側にも入って、ブラウザ前提の検査が Node で落ちるため。
*/
export const TEST_FILES = [
  "tests/**/*.test.ts",
  "tests/**/*.test.tsx",
  "tests/blog-top-page/*.spec.ts",
];

export const WORKER_RUNTIME_TEST_FILES = [
  "tests/integration/d1-*.test.ts",
  "tests/integration/local-seed-idempotency.test.ts",
  "tests/integration/r2-feedback-capture.test.ts",
  // HTMLRewriter は Node に無い。本物の workerd を Miniflare で立てて確かめる。
  "tests/integration/workerd-*.test.ts",
];

export const A11Y_TEST_FILES = [
  "tests/ui/affiliate-preview-card.test.tsx",
  "tests/ui/ai-usage-page.test.tsx",
  "tests/ui/article-thumbnail-form.test.tsx",
  "tests/ui/axe-blind-spots.test.ts",
  "tests/ui/axe-rule-coverage.test.ts",
  "tests/ui/blog-ops-a11y-floor.test.tsx",
  "tests/ui/blog-rating-hide-form.test.tsx",
  "tests/ui/capture-canvas.test.tsx",
  "tests/ui/feedback-admin-forms.test.tsx",
  "tests/ui/feedback-button.test.tsx",
  "tests/ui/improvement-forms.test.tsx",
  "tests/ui/page-degraded.test.tsx",
  "tests/ui/page-empty.test.tsx",
  "tests/ui/page-render.test.tsx",
  "tests/ui/prose-editor.test.tsx",
];

/**
 * 通常テストと workerd 実機テストを、同じ Vitest 実行の中で順番に走らせる。
 * カバレッジは1回の実行へ集約したまま、getPlatformProxy の子プロセスだけを直列化する。
 *
 * @param {number} normalMaxWorkers
 * @returns {import("vitest/config").TestProjectConfiguration[]}
 */
export function createTestProjects(normalMaxWorkers) {
  if (!Number.isInteger(normalMaxWorkers) || normalMaxWorkers < 1) {
    throw new TypeError("normalMaxWorkers must be a positive integer");
  }
  return [
    {
      extends: true,
      test: {
        name: "normal",
        include: TEST_FILES,
        exclude: [...A11Y_TEST_FILES, ...WORKER_RUNTIME_TEST_FILES],
        maxWorkers: normalMaxWorkers,
        sequence: { groupOrder: 0 },
      },
    },
    {
      extends: true,
      test: {
        name: "a11y",
        include: A11Y_TEST_FILES,
        // axe は画面全体を走査する。カバレッジ付き全件実行では互いにCPUを奪わせない。
        fileParallelism: false,
        sequence: { groupOrder: 1 },
      },
    },
    {
      extends: true,
      test: {
        name: "worker-runtime",
        include: WORKER_RUNTIME_TEST_FILES,
        // getPlatformProxy は workerd 子プロセスを立てる。ファイル間だけ直列にする。
        fileParallelism: false,
        sequence: { groupOrder: 2 },
      },
    },
  ];
}
