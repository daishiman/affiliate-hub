import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.env.BLOCK_EDITOR_E2E_ROOT;
const state = process.env.BLOCK_EDITOR_E2E_STATE;
if (!root || !state || !existsSync(join(root, ".block-editor-e2e-owned")) || state !== join(root, "isolated-state")) {
  throw new Error("Run pnpm exec tsx tests/e2e/block-editor-publish-runtime.mts; shared DB/dev servers are not accepted.");
}
const port = process.env.BLOCK_EDITOR_E2E_PORT ?? "8794";
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: ".", testMatch: "block-editor-publish.e2e.ts", fullyParallel: false, workers: 1,
  timeout: 120_000, expect: { timeout: 12_000 }, retries: 0, reporter: "list",
  outputDir: process.env.BLOCK_EDITOR_E2E_OUTPUT ?? "../../test-results/block-editor-publish",
  use: { baseURL, browserName: "chromium", locale: "ja-JP", colorScheme: "light", actionTimeout: 15_000, navigationTimeout: 30_000, screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: `pnpm exec wrangler dev --local --ip 127.0.0.1 --port ${port} --inspector-port 0 --persist-to "${state}" --cwd "${root}"`,
    url: baseURL, reuseExistingServer: false, timeout: 90_000, stdout: "pipe", stderr: "pipe",
  },
});
