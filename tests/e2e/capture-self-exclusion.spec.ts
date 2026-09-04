import { expect, test } from "@playwright/test";
import { authenticateE2E } from "./auth-fixture";

/**
 * 撮影中の退避が、**本物のブラウザで実際に効いている**ことを見る。
 *
 * --- なぜ単体テストだけでは足りないのか ---
 *
 * 退避の仕掛けは 2 つに分かれている。`html[data-capturing="true"]` を立てる側
 * （TypeScript）と、それを見て隠す側（CSS Modules の `:global()` 規則）である。
 * **jsdom は CSS を当てない。**だから単体テストは前者しか見ておらず、
 * 規則の綴りが 1 文字違っても、セレクタが CSS Modules に握り潰されても、
 * **全部緑のまま写り込みだけが戻る。**
 *
 * ここは後者を見る。属性を立てて、`getComputedStyle` が実際に隠すかを確かめる。
 *
 * --- なぜ本物の画面共有を使わないのか ---
 *
 * `getDisplayMedia` は利用者が画面を選ぶ操作を必ず伴う。自動で選ばせる起動引数は
 * あるが、**入れた瞬間この検査は「許可の窓が出ること」を確かめられなくなる**
 * （出ない設定で走らせているため）。撮影そのものは単体テストが観測点で見ている。
 * ここは「退避の指示が画面に効くか」だけを見る。
 */

const ROUTE = "/admin";

test.describe("撮影中の退避が本物のブラウザで効く", () => {
  test.beforeEach(async ({ context, page }) => {
    await authenticateE2E(context);
    /*
     * **画面共有の手立てが無い環境**に見せる。押した瞬間に送信 UI が開く経路になる。
     *
     * 「断られる環境」（`getDisplayMedia` が棄却する）でも同じ結果に着くが、
     * こちらを選んだのは**待ちが 1 つも挟まらない**からである。棄却させると
     * 約束が解けるまでの猶予が入り、開かないときの原因が
     * 「規則が効いていない」のか「まだ開いていない」のか切り分けられない。
     * 撮影そのものの経路は単体テストが観測点で見ている。
     *
     * **`context` ではなく `page` へ載せる。** Playwright はテストが要求した
     * fixture を `beforeEach` より先に組み立てるので、`page` を使うテストでは
     * `context.addInitScript` が間に合わない。2026-08-30 に実際そうなり、
     * 画面共有の窓が出たまま 45 秒（`CAPTURE_OPEN_DEADLINE_MS`）待って落ちた。
     */
    await page.addInitScript(() => {
      // `navigator.mediaDevices` 自体を上書きすると、Chromium が後から
      // 実体を再設定する版で撮影対応が復活する。判定が実際に見ている
      // `getDisplayMedia` だけを非対応にし、「撮れない環境」を固定する。
      Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
        configurable: true,
        value: undefined,
      });
    });
  });

  test("名乗った浮遊要素は data-capturing のあいだだけ隠れる", async ({ page }) => {
    await page.goto(ROUTE, { waitUntil: "domcontentloaded" });

    const launcher = page.locator("[data-floating-overlay]").first();
    await expect(launcher, "名乗っている浮遊要素が 1 つも見つかりません").toBeVisible();

    const visibilityNow = async (): Promise<string> =>
      launcher.evaluate((element) => getComputedStyle(element).visibility);

    expect(await visibilityNow(), "撮影していないのに隠れています").toBe("visible");

    await page.evaluate(() => document.documentElement.setAttribute("data-capturing", "true"));
    expect(
      await visibilityNow(),
      "撮影中の退避規則が効いていません。CSS 側（patterns.module.css の :global 規則）を疑ってください",
    ).toBe("hidden");

    await page.evaluate(() => document.documentElement.removeAttribute("data-capturing"));
    expect(await visibilityNow(), "撮影が終わったのに隠れたままです").toBe("visible");
  });

  test("送信モーダルも同じ規則で隠れる（撮り直しのときの対象）", async ({ page }) => {
    await page.goto(ROUTE, { waitUntil: "domcontentloaded" });

    // 撮る手立てが無いので、押すと待たずに送信 UI が開く。
    await page.getByRole("button", { name: "改善したいことを送る" }).first().click();
    /*
     * **役割ではなく CSS で掴む。**`visibility: hidden` は要素を
     * accessibility tree から外すので、隠れた瞬間 `getByRole("dialog")` は
     * *何も見つけられなくなる*。開いたことの確認には使えるが、
     * 隠れたことの確認には使えない——退避の成功が「要素が消えた」に化ける。
     * 掴む側は a11y tree を見ない selector に統一する。
     */
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog, "撮れない環境なのに送信 UI が開きません").toBeVisible();

    expect(
      await dialog.getAttribute("data-floating-overlay"),
      "送信モーダルが浮遊要素として名乗っていません",
    ).toBe("true");

    await page.evaluate(() => document.documentElement.setAttribute("data-capturing", "true"));
    expect(
      await dialog.evaluate((element) => getComputedStyle(element).visibility),
      "撮り直しのとき、送信モーダルが写しに入ります",
    ).toBe("hidden");
  });
});
