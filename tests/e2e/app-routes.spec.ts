import { expect, test, type Page } from "@playwright/test";
import { authenticateE2E } from "./auth-fixture";
import { readBrowserRoutes, urlOf } from "./source-registries";

const ALL_ROUTES = readBrowserRoutes();
const AUDITED_ROUTES = ALL_ROUTES.filter((route) => route.file !== "signin/page.tsx");

type LayoutAudit = {
  readonly scrollWidth: number;
  readonly clientWidth: number;
  readonly overflowingElements: readonly string[];
  readonly emptyControls: readonly string[];
  readonly offscreenControls: readonly string[];
  readonly overlappingControls: readonly string[];
  readonly coveredControls: readonly string[];
};

async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if (document.fonts !== undefined) await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

async function auditLayout(page: Page): Promise<LayoutAudit> {
  return page.evaluate(() => {
    const visible = (element: Element): boolean => {
      const style = getComputedStyle(element);
      const closedDetails = element.closest("details:not([open])");
      const closedSummary = closedDetails?.querySelector(":scope > summary") ?? null;
      // Chromiumは閉じたdetailsの子にもrectを返す場合がある。実際に押せる
      // summary以外を残すと、折り畳み内の欄同士を「重なり」と誤検出する。
      if (closedDetails !== null && !closedSummary?.contains(element)) return false;
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        element.getClientRects().length > 0
      );
    };
    const label = (element: Element): string => {
      const text = (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
      const name = element.getAttribute("aria-label") ?? element.getAttribute("name") ?? text;
      return `<${element.tagName.toLowerCase()}> ${name}`.trim();
    };
    const reachableByHorizontalScroll = (element: Element): boolean => {
      let ancestor = element.parentElement;
      while (ancestor !== null && ancestor !== document.body) {
        const style = getComputedStyle(ancestor);
        if (
          (style.overflowX === "auto" || style.overflowX === "scroll") &&
          ancestor.scrollWidth > ancestor.clientWidth + 1
        ) {
          return true;
        }
        ancestor = ancestor.parentElement;
      }
      return false;
    };
    const controls = [...document.querySelectorAll(
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"]',
    )].filter(visible);
    const overflowing = [...document.querySelectorAll("body *")].filter((element) => {
      if (!visible(element)) return false;
      // mobile案内は横スクロールする専用領域。document overflowの診断では、
      // その内側の末端ではなく本文側の原因を報告する。
      if (element.closest('nav[aria-label="主な案内"]') !== null) return false;
      const rect = element.getBoundingClientRect();
      return (
        rect.left < -1 ||
        rect.right > innerWidth + 1 ||
        element.scrollWidth > element.clientWidth + 1
      );
    });
    // 親も子のはみ出しに引っ張られるため、原因に一番近い末端だけを報告する。
    const overflowingElements = overflowing
      .filter((element) => !overflowing.some((candidate) => candidate !== element && element.contains(candidate)))
      .slice(0, 12)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const text = (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
        const classes = typeof element.className === "string" ? `.${element.className.split(/\s+/).join(".")}` : "";
        return `<${element.tagName.toLowerCase()}${classes}>「${text}」 ` +
          `left=${rect.left.toFixed(1)} right=${rect.right.toFixed(1)} width=${rect.width.toFixed(1)} ` +
          `scroll/client=${element.scrollWidth}/${element.clientWidth} ` +
          `min-width=${style.minWidth} overflow-x=${style.overflowX} white-space=${style.whiteSpace}`;
      });
    const overflowingText: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node !== null && overflowingText.length < 12) {
      const parent = node.parentElement;
      const value = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (
        parent !== null &&
        value !== "" &&
        parent.closest('nav[aria-label="主な案内"]') === null
      ) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const badRect = [...range.getClientRects()].find(
          (rect) => rect.left < -1 || rect.right > innerWidth + 1,
        );
        if (badRect !== undefined) {
          const classes = typeof parent.className === "string"
            ? `.${parent.className.split(/\s+/).join(".")}`
            : "";
          overflowingText.push(
            `<${parent.tagName.toLowerCase()}${classes}>の文字「${value.slice(0, 80)}」 ` +
              `left=${badRect.left.toFixed(1)} right=${badRect.right.toFixed(1)} ` +
              `width=${badRect.width.toFixed(1)}`,
          );
        }
      }
      node = walker.nextNode();
    }
    // 折り返すinline linkのgetBoundingClientRect()は、行間の空白まで含む外接矩形になる。
    // 実際に押せる各fragmentを測り、存在しない空白域を「重なり」と数えない。
    const boxes = controls.map((element) => ({
      element,
      rects: [...element.getClientRects()],
    }));
    const emptyControls = boxes
      .filter(({ rects }) => rects.every((rect) => rect.width < 1 || rect.height < 1))
      .map(({ element }) => label(element));
    const offscreenControls = boxes
      // 表などの明示的な横scroll領域にある操作は、領域を送れば到達できる。
      // viewport外に固定された操作とは分ける。
      .filter(
        ({ element, rects }) =>
          rects.every((rect) => rect.right <= 0 || rect.left >= innerWidth) &&
          !reachableByHorizontalScroll(element),
      )
      .map(({ element }) => label(element));
    /*
     * **本文の上に浮くと自分で名乗っている操作**（`data-floating-overlay`）。
     * いまは右下固定の「改善したいことを送る」だけ。
     *
     * 重なり判定から外す。外さないと、意図してそこに在る 1 個が、たまたま画面下端に
     * 来ている操作すべてと組になって報告される。2026-08-26 の実測では 21 画面が
     * これだけで落ちた。中身はどれも「浮いたボタンが隅に重なっている」で、
     * **壊れている画面は 1 枚も無かった。**
     *
     * 代わりに `coveredControls` を測る。名乗れば無罪ではなく、
     * **送れば下から逃がせること**を別途確かめる。
     */
    const isFloatingOverlay = (element: Element): boolean =>
      element.closest("[data-floating-overlay]") !== null;
    const overlappingControls: string[] = [];
    for (let index = 0; index < boxes.length; index += 1) {
      const first = boxes[index];
      if (isFloatingOverlay(first.element)) continue;
      for (let otherIndex = index + 1; otherIndex < boxes.length; otherIndex += 1) {
        const second = boxes[otherIndex];
        if (isFloatingOverlay(second.element)) continue;
        if (first.element.contains(second.element) || second.element.contains(first.element)) continue;
        const overlaps = first.rects.some((firstRect) =>
          second.rects.some((secondRect) => {
            const width =
              Math.min(firstRect.right, secondRect.right) - Math.max(firstRect.left, secondRect.left);
            const height =
              Math.min(firstRect.bottom, secondRect.bottom) - Math.max(firstRect.top, secondRect.top);
            if (width <= 1 || height <= 1) return false;
            const overlap = width * height;
            const smaller = Math.min(
              firstRect.width * firstRect.height,
              secondRect.width * secondRect.height,
            );
            return smaller > 0 && overlap / smaller >= 0.2;
          }),
        );
        if (overlaps) {
          overlappingControls.push(`${label(first.element)} ↔ ${label(second.element)}`);
        }
      }
    }
    /*
     * 浮いたボタンの下に**取り残される**操作。
     *
     * 浮いている以上、いまこの瞬間どこかに重なるのは避けられない。害になるのは
     * 「送っても外へ出せない」ときだけである。だから今の位置ではなく、
     * **一番下まで送った後の位置**で測る。
     *
     * 一番下まで送ってもなお、ボタンの帯（横の範囲も見る）に食い込む操作は、
     * その画面で一生隅が隠れたままになる。多くは本文の下余白が足りない画面で、
     * 直す場所は `.content` の `padding-bottom`（`ui.module.css`）である。
     */
    const coveredControls: string[] = [];
    const overlay = document.querySelector("[data-floating-overlay]");
    if (overlay !== null && visible(overlay)) {
      const overlayRect = overlay.getBoundingClientRect();
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      for (const { element, rects } of boxes) {
        if (isFloatingOverlay(element)) continue;
        const trapped = rects.some((rect) => {
          const sideBySide = rect.right <= overlayRect.left + 1 || rect.left >= overlayRect.right - 1;
          if (sideBySide) return false;
          // 一番下まで送ったときの、この操作の下端（画面座標）。
          const bottomAtEnd = rect.bottom + scrollY - maxScroll;
          return bottomAtEnd > overlayRect.top + 1;
        });
        if (trapped) coveredControls.push(label(element));
      }
    }
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      overflowingElements: [...overflowingText, ...overflowingElements].slice(0, 12),
      emptyControls,
      offscreenControls,
      overlappingControls,
      coveredControls,
    };
  });
}

/*
 * **54 ではなく 111 である**（2026-08-30 に再度数え直した。
 * 2026-08-26 の 87 画面から、管理・公開画面が 24 枚増えた）。
 *
 * 54 は、この spec が最後に実際に走った日の数である。以後この spec は
 * `readBrowserRoutes()` が投げるようになり（`source-registries.ts` 冒頭に経緯）、
 * **収集の時点で落ちて 1 件も走らないまま**、画面だけが 32 枚増えていた。
 * 落ちていたので、数が合わないことも誰にも見えていなかった。
 */
test("route registryは111画面、signin確認済みを除く監査対象は110画面", () => {
  expect(ALL_ROUTES).toHaveLength(111);
  expect(AUDITED_ROUTES).toHaveLength(110);
  expect(new Set(AUDITED_ROUTES.map((route) => urlOf(route))).size).toBe(110);
});

for (const route of AUDITED_ROUTES) {
  test(`${route.file} は実route本体へ到達し、主要見出しと配置が壊れていない`, async ({ context, page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await authenticateE2E(context);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const response = await page.goto(urlOf(route), { waitUntil: "domcontentloaded" });
    await settle(page);

    expect(response, "ナビゲーション応答がありません").not.toBeNull();
    expect(response!.status(), `HTTP ${response!.status()} でした`).toBeLessThan(400);

    const headings = await page.locator("h1").allTextContents();
    const namedHeadings = headings.map((heading) => heading.trim()).filter(Boolean);
    expect(namedHeadings, "文字のある h1 がありません").not.toHaveLength(0);

    const requestedPath = urlOf(route).split("?")[0];
    const finalPath = new URL(page.url()).pathname;
    expect(
      finalPath === requestedPath,
      `${requestedPath} ではなく ${finalPath} に着きました`,
    ).toBe(true);
    test.info().annotations.push({
      type: "実route・画面本体",
      description: `${requestedPath} → ${finalPath}（動的値はtests/ui/route-table.tsのfixture）`,
    });

    const layout = await auditLayout(page);
    expect.soft(
      layout.scrollWidth,
      `横にはみ出しています: ${layout.scrollWidth}px > ${layout.clientWidth}px\n` +
        layout.overflowingElements.join("\n"),
    ).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect.soft(layout.emptyControls, "大きさが0の主要操作があります").toEqual([]);
    expect.soft(layout.offscreenControls, "画面外に隠れた主要操作があります").toEqual([]);
    expect.soft(layout.overlappingControls, "主要操作どうしが重なっています").toEqual([]);
    expect
      .soft(layout.coveredControls, "浮いたボタンの下から出せない主要操作があります")
      .toEqual([]);
    expect.soft(consoleErrors, "console.error が出ています").toEqual([]);
    expect.soft(pageErrors, "pageerror が出ています").toEqual([]);
  });
}
