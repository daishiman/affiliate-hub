import { expect, test, type Page } from "@playwright/test";
import { authenticateE2E } from "./auth-fixture";
import {
  readBrowserRoutes,
  readPendingTargetSelectors,
  urlOf,
} from "./source-registries";

const ROUTES = readBrowserRoutes().filter((route) => route.file !== "signin/page.tsx");
const PENDING_SELECTORS = readPendingTargetSelectors();

type Measurement = {
  readonly route: string;
  readonly text: string;
  readonly className: string;
  readonly width: number;
  readonly height: number;
  readonly declaredMinimum: number;
  readonly required: number;
};

async function measurementsOn(page: Page, route: string): Promise<readonly Measurement[]> {
  return page.locator("a[href]").evaluateAll((anchors, input) => {
    const probe = document.createElement("div");
    probe.style.cssText = [
      "position:fixed",
      "visibility:hidden",
      "pointer-events:none",
      "inline-size:var(--tap-target-min)",
      "block-size:var(--tap-target-min)",
    ].join(";");
    document.body.appendChild(probe);
    const required = probe.getBoundingClientRect().height;
    probe.remove();
    return anchors.flatMap((anchor) => {
      const style = getComputedStyle(anchor);
      const declaredMinimum = Math.max(
        Number.parseFloat(style.minHeight) || 0,
        Number.parseFloat(style.minBlockSize) || 0,
      );
      // 保留だった4 selectorを書き写さず、ブラウザが読んだ下限を正本にする。
      // これなら同じ契約を持つリンクが今後増えても自動で監査対象になる。
      if (declaredMinimum + 0.5 < required) return [];
      const text = (anchor.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
      const rect = anchor.getBoundingClientRect();
      return [{
        route: input.route,
        text,
        className: anchor.className,
        width: rect.width,
        height: rect.height,
        declaredMinimum,
        required,
      }];
    });
  }, { route });
}

test("screen-hit-and-currentの保留は0件で、下限を宣言したリンクの実寸も基準を満たす", async ({ context, page }) => {
  expect(PENDING_SELECTORS, "jsdom側に実ブラウザ未計測の保留が残っています").toEqual([]);
  expect(ROUTES).toHaveLength(53);

  const measured: Measurement[] = [];
  await authenticateE2E(context);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of ROUTES) {
    const url = urlOf(route);
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${url} に到達できません`).toBeLessThan(400);
    await page.evaluate(async () => {
      if (document.fonts !== undefined) await document.fonts.ready;
    });
    measured.push(...(await measurementsOn(page, url)));
  }

  expect(measured.length, "下限を宣言したリンクを実DOMで1本も測れていません").toBeGreaterThan(4);
  const violations = measured.filter((item) => item.height + 0.5 < item.required);

  if (violations.length > 0) {
    await page.goto(violations[0].route, { waitUntil: "domcontentloaded" });
  }
  expect(
    violations,
    violations
      .slice(0, 80)
      .map(
        (item) =>
          `${item.route} a.${item.className}「${item.text}」` +
          ` 宣言${item.declaredMinimum.toFixed(1)}px / 実寸` +
          `${item.width.toFixed(1)}×${item.height.toFixed(1)}px < ${item.required.toFixed(1)}px`,
      )
      .join("\n"),
  ).toEqual([]);
});
