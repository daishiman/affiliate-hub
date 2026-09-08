/**
 * 参考ブログ分析を反映した管理画面の最短業務導線。
 * unit/integrationで固定した判定が、本物のWorkers preview上で操作可能かを見る。
 */
import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { authenticateE2E } from "./auth-fixture";

test.beforeEach(async ({ context }) => {
  await authenticateE2E(context);
});

test.describe("記事編集の迷わない導線", () => {
  test("端末下書きを復元・破棄でき、5状態表示から保存できる", async ({ page }, testInfo) => {
    // desktop と mobile は同時に走る。同じ revision を保存すると、正しい CAS が
    // 片方を競合として止めるため、表示幅ごとに別の記事を使う。
    const articleId = testInfo.project.name === "mobile" ? "ba_seed_review_wait" : "ba_seed_draft";
    await page.goto(`/admin/blog/articles/${articleId}`);
    const title = page.getByLabel("見出し", { exact: true });
    const original = await title.inputValue();

    await title.fill(`${original} 端末下書き`);
    await expect(page.getByText("未保存", { exact: true })).toBeVisible();
    await page.waitForTimeout(700);
    await page.reload();
    await expect(page.getByText("端末下書きを復元しました")).toBeVisible();
    await expect(title).toHaveValue(`${original} 端末下書き`);

    await page.getByRole("button", { name: "端末下書きを破棄" }).click();
    await expect(title).toHaveValue(original);
    await page.getByLabel("書いた人").fill("E2E 保存確認");
    await page.getByRole("button", { name: "記事を保存" }).click();
    await expect(page.getByText("保存済み", { exact: true })).toBeVisible();
  });

  test("改善案の差分を見て1件だけ適用し、すぐ元に戻せる", async ({ page }) => {
    await page.goto("/admin/blog/articles/ba_seed_draft");
    await expect(page.getByText("公開に必要な部品が足りません")).toBeVisible();
    const suggestion = page.locator("article").filter({ hasText: "執筆者・監修者が足りません" });
    await suggestion.getByText("差分を確認", { exact: true }).click();
    await expect(suggestion.getByText(/追加: 空の「執筆者・監修者」/)).toBeVisible();
    await suggestion.getByRole("button", { name: "この1件を適用" }).click();
    await expect(page.getByText("改善を反映しました")).toBeVisible();
    await page.getByRole("button", { name: "元に戻す" }).click();
    await expect(suggestion.getByRole("button", { name: "この1件を適用" })).toBeVisible();
  });
});

test.describe("成果リンクの確認と逆引き", () => {
  test("未対応hostは通信せず図解フォールバックと理由を出す", async ({ page }) => {
    await page.goto("/admin/inbox");
    await page.getByLabel("成果リンクの URL").fill("https://example.com/item/seed");
    await expect(page.getByText("保存前の確認")).toBeVisible();
    await expect(page.locator('[data-status="rejected"]')).toHaveText("自動取得の対象外です");
    await expect(page.getByRole("img", { name: /example\.comの図解プレビュー/ })).toBeVisible();
    await expect(page.getByText("保存後はサイト・記事・ブロックを指定して掲載先を管理できます。")).toBeVisible();
  });

  test("状態フィルターで期限切れだけに絞れる", async ({ page }) => {
    await page.goto("/admin/affiliate/links");
    await page.getByLabel("状態").selectOption("expired");
    await page.getByRole("button", { name: "絞り込む" }).click();
    await expect(page).toHaveURL(/state=expired/);
    await expect(page.getByText(/図で分かるポータブルSSD — 楽天アフィリエイト/)).toBeVisible();
    await expect(page.getByText("図で選べるデスクライト")).toHaveCount(0);
  });

  test("掲載数を1回押すと、掲載中と掲載終了の場所が同じ行に開く", async ({ page }) => {
    await page.goto("/admin/affiliate/links");
    await page.getByText(/図で選べるデスクライト.*稼働中の掲載先1件を見る/).click();
    await expect(page.getByText("稼働中 1件 / 履歴 2件")).toBeVisible();
    await expect(page.getByText(/掲載中: home-office-desk/)).toBeVisible();
    await expect(page.getByText(/掲載終了: home-office-desk/)).toBeVisible();
  });
});

test.describe("主要管理画面の表示性能予算", () => {
  test("成果リンク一覧がP06の応答・転送量予算内で開く", async ({ page }, testInfo) => {
    await page.goto("/admin/affiliate/links", { waitUntil: "load" });
    const timing = await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;
      return {
        ttfbMs: navigation.responseStart,
        domContentLoadedMs: navigation.domContentLoadedEventEnd,
        loadMs: navigation.loadEventEnd,
        transferBytes: navigation.transferSize,
      };
    });

    await testInfo.attach("performance.json", {
      body: Buffer.from(JSON.stringify({ project: testInfo.project.name, ...timing }, null, 2)),
      contentType: "application/json",
    });
    await mkdir("test-results/reference-blog-admin-ux/p06", { recursive: true });
    await writeFile(
      `test-results/reference-blog-admin-ux/p06/performance-${testInfo.project.name}.json`,
      `${JSON.stringify({ project: testInfo.project.name, ...timing }, null, 2)}\n`,
      "utf8",
    );

    expect(timing.ttfbMs).toBeLessThan(2_500);
    expect(timing.domContentLoadedMs).toBeLessThan(6_000);
    expect(timing.loadMs).toBeLessThan(8_000);
    expect(timing.transferBytes).toBeLessThan(2_500_000);
  });
});

test.describe("P09の表示品質preflight", () => {
  test("LCP・CLS・INPのlab計測が予算内に収まる", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      type LabVitalsState = {
        lcpMs: number | null;
        cls: number;
        inpMs: number | null;
        supported: {
          lcp: boolean;
          cls: boolean;
          event: boolean;
        };
        observedEntries: {
          lcp: number;
          cls: number;
          event: number;
        };
      };

      const supported = PerformanceObserver.supportedEntryTypes;
      const state: LabVitalsState = {
        lcpMs: null,
        cls: 0,
        inpMs: null,
        supported: {
          lcp: supported.includes("largest-contentful-paint"),
          cls: supported.includes("layout-shift"),
          event: supported.includes("event"),
        },
        observedEntries: { lcp: 0, cls: 0, event: 0 },
      };
      Object.defineProperty(window, "__referenceBlogLabVitals", {
        configurable: false,
        enumerable: false,
        value: state,
        writable: false,
      });

      if (state.supported.lcp) {
        new PerformanceObserver((list) => {
          const entries = list.getEntries() as Array<
            PerformanceEntry & { renderTime?: number; startTime: number }
          >;
          state.observedEntries.lcp += entries.length;
          const last = entries[entries.length - 1];
          if (last !== undefined) state.lcpMs = last.renderTime || last.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
      }

      if (state.supported.cls) {
        new PerformanceObserver((list) => {
          const entries = list.getEntries() as Array<
            PerformanceEntry & { value?: number; hadRecentInput?: boolean }
          >;
          state.observedEntries.cls += entries.length;
          for (const entry of entries) {
            if (!entry.hadRecentInput) state.cls += entry.value ?? 0;
          }
        }).observe({ type: "layout-shift", buffered: true });
      }

      if (state.supported.event) {
        new PerformanceObserver((list) => {
          const entries = list.getEntries() as Array<
            PerformanceEntry & { duration: number; interactionId?: number }
          >;
          const interactions = entries.filter((entry) => (entry.interactionId ?? 0) > 0);
          state.observedEntries.event += interactions.length;
          for (const entry of interactions) {
            state.inpMs = Math.max(state.inpMs ?? 0, entry.duration);
          }
        }).observe({
          type: "event",
          buffered: true,
          durationThreshold: 16,
        } as PerformanceObserverInit);
      }
    });

    await page.goto("/admin/affiliate/links", { waitUntil: "load" });
    await page.getByText(/図で選べるデスクライト.*稼働中の掲載先1件を見る/).click();
    await expect(page.getByText("稼働中 1件 / 履歴 2件")).toBeVisible();
    await page.waitForTimeout(600);

    const observed = await page.evaluate(() => {
      type LabVitalsState = {
        lcpMs: number | null;
        cls: number;
        inpMs: number | null;
        supported: { lcp: boolean; cls: boolean; event: boolean };
        observedEntries: { lcp: number; cls: number; event: number };
      };
      return (window as unknown as Window & { __referenceBlogLabVitals: LabVitalsState })
        .__referenceBlogLabVitals;
    });
    const metrics = {
      lcpMs: observed.lcpMs,
      cls: observed.cls,
      // Event Timingは16ms未満の操作をentryにしない。未観測は0msと断定せず、
      // 「16ms未満」という上限値で予算を判定する。
      inpUpperBoundMs: observed.inpMs ?? 16,
      inpObservedMs: observed.inpMs,
      inpDetectionFloorMs: 16,
    };
    const artifact = {
      measurement: "Chromium PerformanceObserver lab preflight (not field RUM)",
      project: testInfo.project.name,
      route: "/admin/affiliate/links",
      interaction: "掲載先の逆引きを開く",
      budgets: { lcpMs: 2_500, cls: 0.1, inpMs: 200 },
      metrics,
      supported: observed.supported,
      observedEntries: observed.observedEntries,
    };

    await testInfo.attach("core-web-vitals-lab.json", {
      body: Buffer.from(JSON.stringify(artifact, null, 2)),
      contentType: "application/json",
    });
    await mkdir("test-results/reference-blog-admin-ux/qa", { recursive: true });
    await writeFile(
      `test-results/reference-blog-admin-ux/qa/core-web-vitals-${testInfo.project.name}.json`,
      `${JSON.stringify(artifact, null, 2)}\n`,
      "utf8",
    );

    expect(observed.supported).toEqual({ lcp: true, cls: true, event: true });
    expect(metrics.lcpMs).not.toBeNull();
    expect(metrics.lcpMs ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(2_500);
    expect(metrics.cls).toBeLessThanOrEqual(0.1);
    expect(metrics.inpUpperBoundMs).toBeLessThanOrEqual(200);
  });

  test("768pxと1600pxでpublic・adminの主要操作が欠けない", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "375px is covered by every mobile flow");
    const results: Array<{
      width: number;
      route: string;
      overflowPx: number;
      primaryControlVisible: boolean;
    }> = [];

    for (const width of [768, 1_600]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin/affiliate/links");
      const filter = page.getByRole("button", { name: "絞り込む" });
      await expect(filter).toBeVisible();
      const adminOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      results.push({
        width,
        route: "/admin/affiliate/links",
        overflowPx: adminOverflow,
        primaryControlVisible: await filter.isVisible(),
      });
      expect(adminOverflow).toBeLessThanOrEqual(1);

      await page.goto("/s/home-office-desk");
      const publicHeading = page.locator("h1").first();
      await expect(publicHeading).toBeVisible();
      const publicOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      results.push({
        width,
        route: "/s/home-office-desk",
        overflowPx: publicOverflow,
        primaryControlVisible: await publicHeading.isVisible(),
      });
      expect(publicOverflow).toBeLessThanOrEqual(1);
    }

    const artifact = {
      measurement: "responsive lab preflight",
      project: testInfo.project.name,
      viewports: [768, 1_600],
      results,
    };
    await testInfo.attach("responsive-lab.json", {
      body: Buffer.from(JSON.stringify(artifact, null, 2)),
      contentType: "application/json",
    });
    await mkdir("test-results/reference-blog-admin-ux/qa", { recursive: true });
    await writeFile(
      "test-results/reference-blog-admin-ux/qa/responsive-desktop.json",
      `${JSON.stringify(artifact, null, 2)}\n`,
      "utf8",
    );
  });
});

test.describe("キーボードと200%相当の再レイアウト", () => {
  test("絞り込み入力を順にたどりEnterで送信できる", async ({ page }) => {
    await page.goto("/admin/affiliate/links");
    const state = page.getByLabel("状態");
    // 値とURLの対応は上の絞り込みE2Eで固定済み。ここでは native select 3個を
    // キーボードで順に通過し、主操作へ到達できることだけを測る。
    await state.selectOption("disabled");
    await state.focus();
    const submit = page.getByRole("button", { name: "絞り込む" });
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(submit).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/state=disabled/);
  });

  test("1280pxを200%で見た相当幅でも主操作が欠けず横スクロールを強制しない", async (
    { page },
    testInfo,
  ) => {
    test.skip(testInfo.project.name === "mobile", "200% desktop zoom equivalent is measured once");
    await page.setViewportSize({ width: 640, height: 450 });
    await page.goto("/admin/affiliate/links");

    await expect(page.getByRole("button", { name: "絞り込む" })).toBeVisible();
    await expect(page.getByText(/図で選べるデスクライト.*稼働中の掲載先1件を見る/)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
