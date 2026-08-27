export const TEST_FILES = ["tests/**/*.test.ts", "tests/**/*.test.tsx"];

export const WORKER_RUNTIME_TEST_FILES = [
  "tests/integration/d1-*.test.ts",
  "tests/integration/r2-feedback-capture.test.ts",
];

export const A11Y_TEST_FILES = [
  "tests/ui/ai-usage-page.test.tsx",
  "tests/ui/axe-blind-spots.test.ts",
  "tests/ui/axe-rule-coverage.test.ts",
  "tests/ui/blog-ops-a11y-floor.test.tsx",
  "tests/ui/capture-canvas.test.tsx",
  "tests/ui/feedback-admin-forms.test.tsx",
  "tests/ui/feedback-button.test.tsx",
  "tests/ui/improvement-forms.test.tsx",
  "tests/ui/page-degraded.test.tsx",
  "tests/ui/page-empty.test.tsx",
  "tests/ui/page-render.test.tsx",
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
