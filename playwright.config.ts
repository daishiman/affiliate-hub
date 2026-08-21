import { defineConfig } from "@playwright/test";

// 8787 は他ワークスペースの preview が共有端末で使うことがある。
// アプリのローカル認証URLと同じ 8788 を、E2E専用の既定ポートにする。
const previewPort = process.env.PLAYWRIGHT_PORT ?? "8788";
const baseURL = `http://127.0.0.1:${previewPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: "list",
  timeout: 45_000,
  expect: { timeout: 5_000 },
  outputDir: "test-results/playwright",
  use: {
    baseURL,
    browserName: "chromium",
    colorScheme: "light",
    locale: "ja-JP",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: {
    command: `pnpm test:e2e:prepare && pnpm preview --port ${previewPort}`,
    url: baseURL,
    // 別ワークツリーのサーバーを誤って監査しない。常にこのビルドを起動する。
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
  projects: [
    {
      name: "desktop",
      use: { viewport: { width: 1280, height: 900 } },
    },
    {
      name: "mobile",
      use: {
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
});
