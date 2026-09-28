import { expect, test, type Page } from "@playwright/test";
import { authenticateE2E } from "./auth-fixture";
import { finalPathOf, readBrowserRoutes, urlOf } from "./source-registries";
import { waitForStreamedContent } from "./streamed-content";

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
  // **描画を待つ前に、本文が画面へ入っているかを待つ。**
  // streaming SSR の途中では中身が hidden の待機領域に居て、可視な要素が
  // 1 つも無い。その状態で重なりを測ると「重なりは無い」と出る——
  // 落ちずに測る対象が消える形の壊れ方になる。
  await waitForStreamedContent(page);
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
    /*
     * **送れる器は、中身を切り取る。**
     *
     * 表は `.tableWrap`（`screen-parts.module.css`）に入っており、
     * `max-block-size` を超えると器の中だけで送る。このとき器から出た行の
     * `getBoundingClientRect()` は**切り取られる前の位置**を返す。そこは
     * 画面に描かれていない。器の外に在る別の操作と重なって見えるのは、
     * 描かれていない矩形どうしを突き合わせているからである。
     *
     * 2026-09-05 の実測（`/admin/settings/members` desktop、幅 1280）:
     *
     *   .tableWrap        下端 874   client/scroll = 510/1464
     *   <button> 役割を変える  886–930   ← 器の外。描かれていない
     *   <input> invitedEmail  915–962   ← 器の後ろ。こちらは描かれている
     *
     * この 2 つは画面上で同時に在ることが無い。器の内側へ切り取ってから測る。
     * 切り取った結果が空になる操作は、いま描かれていないので誰とも重ならない。
     *
     * 閾値（20%）も除外表も動かしていない。**測る位置を、目に見える位置へ
     * 合わせただけである。**器を送り切っても重なる操作は、この後も有罪になる。
     */
    const scrollClipOf = (element: Element): { top: number; right: number; bottom: number; left: number } => {
      const clip = {
        top: Number.NEGATIVE_INFINITY,
        right: Number.POSITIVE_INFINITY,
        bottom: Number.POSITIVE_INFINITY,
        left: Number.NEGATIVE_INFINITY,
      };
      let ancestor = element.parentElement;
      while (ancestor !== null && ancestor !== document.body) {
        const style = getComputedStyle(ancestor);
        const scrollsY =
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          ancestor.scrollHeight > ancestor.clientHeight + 1;
        const scrollsX =
          (style.overflowX === "auto" || style.overflowX === "scroll") &&
          ancestor.scrollWidth > ancestor.clientWidth + 1;
        if (scrollsY || scrollsX) {
          // 枠線の内側（padding box）が、中身の出られる限界である。
          const rect = ancestor.getBoundingClientRect();
          const top = rect.top + ancestor.clientTop;
          const left = rect.left + ancestor.clientLeft;
          clip.top = Math.max(clip.top, top);
          clip.left = Math.max(clip.left, left);
          clip.bottom = Math.min(clip.bottom, top + ancestor.clientHeight);
          clip.right = Math.min(clip.right, left + ancestor.clientWidth);
        }
        ancestor = ancestor.parentElement;
      }
      return clip;
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
    const boxes = controls.map((element) => {
      const rects = [...element.getClientRects()];
      const clip = scrollClipOf(element);
      // 送れる器の内側だけを残す。空になったものは、いま描かれていない。
      const paintedRects = rects
        .map((rect) => ({
          top: Math.max(rect.top, clip.top),
          left: Math.max(rect.left, clip.left),
          bottom: Math.min(rect.bottom, clip.bottom),
          right: Math.min(rect.right, clip.right),
        }))
        .filter((rect) => rect.right - rect.left > 1 && rect.bottom - rect.top > 1)
        .map((rect) => ({
          ...rect,
          width: rect.right - rect.left,
          height: rect.bottom - rect.top,
        }));
      return { element, rects, clip, paintedRects };
    });
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
        // 描かれている面どうしで測る（器から出た分は画面に無い）。
        const overlaps = first.paintedRects.some((firstRect) =>
          second.paintedRects.some((secondRect) => {
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
     *
     * **名乗るものは 1 つとは限らない。**`data-floating-overlay` は写しからの退避と
     * ここの監査で共有する手掛かりであり、退避の側は最初から複数を前提にしている
     * （`capture-exclusion.ts`）。`querySelector` で先頭 1 つだけを見ていると、
     * 2 つ目が増えた日にこの検査は落ちずに *測る対象が減る*。緑のまま黙るので、
     * 名乗っている可視な要素をすべて数える。
     */
    /*
     * **縦に送れる器の中にいる操作は、器の下端より下へは出られない。**
     *
     * 表は `.tableWrap`（`screen-parts.module.css`）に入っており、
     * `max-block-size` を超えると器の中だけで縦に送る。このとき最後の行の
     * `getBoundingClientRect()` は**器の外まではみ出した位置**を返す。
     * そこは画面に出ていない。器を送れば、その行は器の下端に来る。
     *
     * 2026-09-05 の実測（`/admin/site-network` desktop）:
     *
     *   .tableWrap の下端  1175.7   ← 実際に見える一番下
     *   その中の table     1275.7   ← 100px はみ出して切り取られている
     *   最後の「直す」     1256.3   ← 器の外。ここを居場所として測っていた
     *
     * 器の外の 1256.3 で測ると「送っても浮遊ボタンから出せない」になるが、
     * 器の下端 1175.7 で測れば 1175.7 − 364（文書の残り送り量）= 811 で、
     * 帯の上端 838.8 より上にいる。**指は届く。**
     *
     * これは閾値を緩めているのではない。`offscreenControls` が
     * `reachableByHorizontalScroll` で横の器を見ているのと同じ話の、縦版である。
     * 器を送り切っても帯に食い込む操作は、この後も変わらず有罪になる。
     * 器の限界は `scrollClipOf`（上）が 1 か所で持つ。
     */
    const coveredControls: string[] = [];
    const overlayRects = [...document.querySelectorAll("[data-floating-overlay]")]
      .filter((element) => visible(element))
      .map((element) => element.getBoundingClientRect())
      // 畳まれている・高さが無いものは帯を持たない。
      .filter((rect) => rect.width >= 1 && rect.height >= 1);
    if (overlayRects.length > 0) {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      for (const { element, rects, clip } of boxes) {
        if (isFloatingOverlay(element)) continue;
        /*
         * **帯ごとに個別に見る。**全帯を包む外接矩形で測ると、右下と左上に
         * 浮遊要素がある画面で「画面全体が帯」になり、無関係な操作まで有罪になる。
         * 1 つでも取り残す帯があれば取り残されている、という保守側で合成する。
         */
        const trapped = overlayRects.some((overlayRect) =>
          rects.some((rect) => {
            const sideBySide =
              rect.right <= overlayRect.left + 1 || rect.left >= overlayRect.right - 1;
            if (sideBySide) return false;
            // 一番下まで送ったときの、この操作の下端（画面座標）。
            // 縦に送れる器の中にいるなら、器の下端より下へは出られない。
            const bottomAtEnd = Math.min(rect.bottom, clip.bottom) + scrollY - maxScroll;
            return bottomAtEnd > overlayRect.top + 1;
          }),
        );
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
 * **54 ではなく 116 である**（2026-09-05 に数え直した）。
 *
 * 54 は、この spec が最後に実際に走った日の数である。以後この spec は
 * `readBrowserRoutes()` が投げるようになり（`source-registries.ts` 冒頭に経緯）、
 * **収集の時点で落ちて 1 件も走らないまま**、画面だけが 32 枚増えていた。
 * 落ちていたので、数が合わないことも誰にも見えていなかった。
 *
 * **この数は上限ではない。**見張っているのは「知らないうちに画面が増減して
 * いないか」であって、赤くなったら床を上げるのではなく、増えた画面を 1 枚ずつ
 * 数え直して意図どおりか確かめる。111 → 116 の 5 枚の出所は次のとおり:
 *
 *   content/published                        #40 (2026-08-30)
 *   content/published/[site]/[slug]/edit     #40 (2026-08-30)
 *   sites/[site]/appearance                  #46 (2026-09-02)
 *   sites/[site]/placements                  #46 (2026-09-02)
 *   settings/seo                             2026-09-05
 *
 * 116 → 121 の 5 枚は記事タイプの索引で、出所は 1 つ（残課題 ah-milz）:
 *
 *   s/[site]/best      s/[site]/reviews    s/[site]/compare
 *   s/[site]/guides    s/[site]/tools                        2026-09-05
 *
 * `/best/{topic}` の親 `/best` に画面が無く、記事のパンくずの真ん中が
 * 押せない文字だった。5 枚は**その行き先**であって、数を増やすために
 * 足した画面ではない。5 枚とも `ArticleIndexPage` 1 つを呼ぶだけである。
 *
 * **111 は書かれた日から 2 ずれていた。**#41 でこの検査を書いたとき、実数は
 * 既に 113 だった。#34 の時点（111）で数えたまま、同じ日の #40 が足した
 * `content/published` 2 枚を数え落としている。E2E は当時から落ちていたので、
 * ずれたことに気づく機会が無かった。**数え直しは実装の一覧を突き合わせる**
 * ——宣言の側を信じて足し引きしない。
 */
test("route registryは121画面、signin確認済みを除く監査対象は120画面", () => {
  expect(ALL_ROUTES).toHaveLength(121);
  expect(AUDITED_ROUTES).toHaveLength(120);
  expect(new Set(AUDITED_ROUTES.map((route) => urlOf(route))).size).toBe(120);
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
    // **移すだけの入口は、着くまで待ってから読む。**
    // `domcontentloaded` の直後に転送が起きると、DOM を読んでいる最中に
    // 文書が入れ替わり `Execution context was destroyed` になる。
    // 不安定なのではなく、転送されている事実がその形で出ているだけである。
    if (route.redirectTo !== undefined) await page.waitForURL(`**${route.redirectTo}`);
    await settle(page);

    expect(response, "ナビゲーション応答がありません").not.toBeNull();
    expect(response!.status(), `HTTP ${response!.status()} でした`).toBeLessThan(400);

    const headings = await page.locator("h1").allTextContents();
    const namedHeadings = headings.map((heading) => heading.trim()).filter(Boolean);
    expect(namedHeadings, "文字のある h1 がありません").not.toHaveLength(0);

    const requestedPath = urlOf(route).split("?")[0];
    /*
      **着くはずの場所は表が名指しする。**転送を宣言していない入口は開いた
      path のまま、宣言している入口はその行き先。どちらも固い検査であり、
      「転送先でも可」ではない。入口が黙って消えた日も、宣言した転送が
      消えた日も、ここが赤くなる。
    */
    const expectedPath = finalPathOf(route);
    const finalPath = new URL(page.url()).pathname;
    expect(
      finalPath === expectedPath,
      `${expectedPath} ではなく ${finalPath} に着きました`,
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
