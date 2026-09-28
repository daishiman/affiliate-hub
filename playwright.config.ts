import { defineConfig } from "@playwright/test";

// 8787 は他ワークスペースの preview が共有端末で使うことがある。
// アプリのローカル認証URLと同じ 8788 を、E2E専用の既定ポートにする。
const previewPort = process.env.PLAYWRIGHT_PORT ?? "8788";
const baseURL = `http://127.0.0.1:${previewPort}`;

/**
 * 実画素で受入 A1 を見る検査（`capture-pixel-exclusion.spec.ts`）だけを分けるための旗。
 *
 * 分ける理由は 2 つある。**起動引数が既定と両立しない**こと——
 * 自タブ取得を選択窓なしで承諾させる引数は、隣の検査が前提にしている
 * 「選ぶ操作を必ず伴う」を崩す。そして **display capture は headless の Chromium に
 * 実装が無い**こと（`NotSupportedError`）。画面を持つ環境でしか走らないので、
 * 既定の実行へ混ぜると環境依存で赤くなる。呼ぶときだけ呼ぶ。
 */
const capturePixel = process.env.PLAYWRIGHT_CAPTURE_PIXEL === "1";
const CAPTURE_PIXEL_SPEC = "**/capture-pixel-exclusion.spec.ts";

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
  projects: capturePixel
    ? [
        {
          name: "capture-pixel",
          testMatch: CAPTURE_PIXEL_SPEC,
          use: {
            viewport: { width: 1280, height: 900 },
            // headless の Chromium は display capture の source を持たない。
            // `use.headless` は `launchOptions.headless` より優先されるので、
            // 打ち消されないようこちら側で下ろす。
            headless: false,
            launchOptions: {
              args: [
                // 自タブ取得だけを、選択窓を出さずに承諾する。
                // **`--use-fake-ui-for-media-stream` を足さないこと。**
                // あれは getUserMedia 用で、display capture では開始できない
                // source を掴んで `NotReadableError` になる。
                "--auto-accept-this-tab-capture",
                "--allow-http-screen-capture",
                /*
                 * **窓が他の窓に隠れても描画を止めさせない。**
                 * 撮影は `afterNextPaint`（requestAnimationFrame）を待ってから
                 * 1 枚を取り出す。Chromium は隠れた窓の rAF を止めるので、
                 * 走らせている間に別の窓が前に来ると待ちが解けず、
                 * 撮影が期限で中断されて写しが `null` になる。
                 * 撮影の中身を偽るものではなく、描画を止めさせないだけ。
                 */
                "--disable-backgrounding-occluded-windows",
                "--disable-renderer-backgrounding",
                "--disable-background-timer-throttling",
              ],
            },
          },
        },
      ]
    : [
        {
          name: "desktop",
          testIgnore: CAPTURE_PIXEL_SPEC,
          use: { viewport: { width: 1280, height: 900 } },
        },
        {
          name: "mobile",
          testIgnore: CAPTURE_PIXEL_SPEC,
          use: {
            viewport: { width: 375, height: 812 },
            deviceScaleFactor: 1,
            hasTouch: true,
            isMobile: true,
          },
        },
      ],
});
