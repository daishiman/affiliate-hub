import type { Page } from "@playwright/test";

/**
 * React の streaming SSR が**本文を画面へ差し込み終える**まで待つ。
 *
 * サーバーは Suspense の外側だけを先に送り、中身は後から届ける。届いた中身は
 * いったん `<body>` 直下の `<div hidden id="S:0">` へ置かれ、`$RV` が本来の位置
 * （`<!--$--><!--/$-->` の間）へ移す。**移す前は `hidden` の中に居る**ので、
 * `getBoundingClientRect()` はどの子孫を測っても 0×0 を返す。
 *
 * `waitUntil: "domcontentloaded"` も `"load"` も `document.readyState === "complete"`
 * も、この移設の完了を意味しない。HTML の受信と JS による移設は別の出来事である。
 *
 * **これを待たずに実寸を測ると、赤くなる画面が実行ごとに変わる。**
 * 2026-09-05 に `pending-hit-targets` が 94 件落ちていたのはこれで、
 * `a.navLink` が 0.0×0.0px と報告されていたが、案内は実際には 44px あった。
 * 待ってから測ると 44px が出る（`/admin/analytics` で before 0 / after 44 を実測）。
 *
 * 待ちきれないときは例外にする。**測れていないのに緑にしない**ためで、
 * `pending-hit-targets` が `--tap-target-min` を解けたか見張っているのと同じ考え方。
 */
export async function waitForStreamedContent(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector('body > div[hidden][id^="S:"]') === null,
    undefined,
    { timeout: 15_000 },
  );
}
