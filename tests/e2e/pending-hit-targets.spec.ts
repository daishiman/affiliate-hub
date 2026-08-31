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

/**
 * その画面のリンクのうち、**自分で下限を宣言しているもの**の実寸。
 *
 * `required`（`--tap-target-min` をブラウザに解かせた px）も一緒に返す。
 * これが 0 や NaN になると選別が全部素通りして、
 * **測っていないのに緑**という一番たちの悪い形になる。呼ぶ側で見張る。
 */
async function measurementsOn(
  page: Page,
  route: string,
): Promise<{ readonly required: number; readonly links: readonly Measurement[] }> {
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
    const links = anchors.flatMap((anchor) => {
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
    return { required, links };
  }, { route });
}

test("screen-hit-and-currentの保留は0件で、監査対象は110画面", () => {
  expect(PENDING_SELECTORS, "jsdom側に実ブラウザ未計測の保留が残っています").toEqual([]);
  // 53 → 85 → 86 → 110。2026-08-30 に、新しく登録された 24 画面も
  // 実ブラウザ監査の対象に含まれることを数え直した。
  expect(ROUTES).toHaveLength(110);
});

/*
 * **画面ごとに 1 本の test に割ってある。**
 *
 * 2026-08-26 まで、1 本の test が 85 画面を順に開いていた。書かれた日は 53 画面で
 * 45 秒に収まっていたが、画面が増えて収まらなくなり、`/admin/analytics` を開く
 * 途中で時間切れになった。出るのは `net::ERR_ABORTED; maybe frame was detached?`
 * ——**開けなかった画面の名前**であって、壊れている画面の名前ではない。
 * 直す人はその画面を疑うことになる。
 *
 * 割ると、時間は画面ごとに数えられ、落ちた画面の名前がそのまま test 名になる。
 * 走者が 2 人いるので実時間も縮む。
 */
for (const route of ROUTES) {
  test(`${route.file} の下限を宣言したリンクは実寸も基準を満たす`, async ({ context, page }) => {
    await authenticateE2E(context);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const url = urlOf(route);
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${url} に到達できません`).toBeLessThan(400);
    await page.evaluate(async () => {
      if (document.fonts !== undefined) await document.fonts.ready;
    });

    const { required, links } = await measurementsOn(page, url);
    // 下限そのものが読めていないと、選別が素通りして測らないまま緑になる。
    expect(required, "--tap-target-min をブラウザが解けていません").toBeGreaterThan(24);

    const violations = links.filter((item) => item.height + 0.5 < item.required);
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
}
