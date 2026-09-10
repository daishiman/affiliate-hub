import { expect, test } from "@playwright/test";
import { authenticateE2E } from "./auth-fixture";

/**
 * 受入 A1「写しに送信 UI が 1 画素も含まれない」を、**実際に撮った画素**で判定する。
 *
 * --- 隣の検査との違い ---
 *
 * `capture-self-exclusion.spec.ts` は `getDisplayMedia` を非対応にして、
 * 「退避の指示が CSS に効くか」だけを見る。画面共有そのものは走らせない。
 * こちらは逆で、**本物の `getDisplayMedia` を走らせて出てきた 1 枚の画素を読む**。
 * 隠す指示が出ていても、退避が絵の取り出しより後に効けば写り込みは残る——
 * その順序の誤りは CSS を見るだけでは捕まらない。ここが唯一それを捕まえる。
 *
 * --- なぜ別 project なのか ---
 *
 * 自タブ取得を選択窓なしで承諾させる `--auto-accept-this-tab-capture` が要る。
 * これを既定の project へ入れると、隣の検査が前提にしている
 * 「選ぶ操作を必ず伴う」が崩れる。起動引数ごと分ける。
 * また display capture は headless の Chromium に実装が無く（`NotSupportedError`）、
 * 画面を持つ実行環境でしか走らない。既定の実行からは外し、
 * `pnpm test:e2e:capture-pixel` で明示的に呼ぶ。
 *
 * --- 判定の作り ---
 *
 * 色を当てずに、撮る直前へ目印を 2 つ置く。
 *
 * - `MARK_FLOATING`: 浮遊要素（`[data-floating-overlay]`）に塗る。**写ってはいけない。**
 * - `MARK_ANCHOR`: 浮遊でない要素に塗る。**写らねばならない。**
 *
 * 後者が対照である。これが無いと「走査が壊れていて何も見つからなかった」場合も
 * 前者 0 件で緑になる。両方を同じ走査で数え、
 * 「対照は在る・浮遊は 0」でだけ受かる。
 */

const ROUTE = "/admin";

/** 画面共有の映像は色差が間引かれて届く。厳密一致では拾えないので幅を持たせる。 */
const TOLERANCE = 48;

/** 浮遊要素に塗る色。写しに 1 画素でも出たら A1 は破れている。 */
const MARK_FLOATING = [255, 0, 255] as const;

/** 浮遊でない要素に塗る色。走査が効いていることの対照。 */
const MARK_ANCHOR = [0, 255, 255] as const;

/** 対照がこの数だけ見つからなければ、走査そのものを疑う。 */
const ANCHOR_MIN_PIXELS = 200;

test.describe("撮った 1 枚に送信 UI が写らない（実画素）", () => {
  test("浮遊要素の色は写しに 0 画素、浮遊でない色は写っている", async ({ context, page }) => {
    /*
     * 既定の 45 秒では足りない。アプリ側が「写しが決まるまで送信 UI を開かずに待つ」
     * 上限（`CAPTURE_OPEN_DEADLINE_MS`）が 45 秒あるので、撮影が滞った場合の
     * 挙動——上限で送信 UI が開く——まで見届けるには、それより長い猶予が要る。
     * 短いままだと「撮れなかった」と「間に合わなかった」が区別できない。
     */
    test.setTimeout(150_000);

    await authenticateE2E(context);

    /*
     * **撮影が転んだ理由を残す。**アプリは「撮れないことは失敗ではない」として
     * 例外を握り潰す（feedback-button.tsx の captureScreen の catch）。
     * 握り潰されたままだと、ここでの失敗が全部「写しが載らない」に見えて、
     * 環境の問題か実装の問題か切り分けられない。
     *
     * 差し込むのは**記録だけ**で、本物の `getDisplayMedia` をそのまま呼ぶ。
     * 偽の stream を返して検査を通すためのものではない。
     */
    await page.addInitScript(() => {
      const devices = navigator.mediaDevices;
      const original = devices.getDisplayMedia.bind(devices);
      Object.defineProperty(devices, "getDisplayMedia", {
        configurable: true,
        value: async (constraints: DisplayMediaStreamOptions) => {
          try {
            const stream = await original(constraints);
            Object.assign(window, { __captureOutcome: { ok: true } });
            return stream;
          } catch (error) {
            const failure = error as Error;
            Object.assign(window, {
              __captureOutcome: { ok: false, name: failure.name, message: failure.message },
            });
            throw error;
          }
        },
      });
    });

    await page.goto(ROUTE, { waitUntil: "domcontentloaded" });

    const launcher = page.locator("[data-floating-overlay]").first();
    await expect(launcher, "名乗っている浮遊要素が 1 つも見つかりません").toBeVisible();

    // 目印を置く。塗るのは背景色だけで、退避が見ている `visibility` には触れない。
    await page.evaluate(
      ([floating, anchor]) => {
        const overlay = document.querySelector<HTMLElement>("[data-floating-overlay]");
        if (!overlay) throw new Error("浮遊要素が見つかりません");
        /*
         * **子（アイコンや文字）には触れない。**隠すと押す先の名前が消え、
         * `getByRole("button", { name: ... })` が掴めなくなる。
         * 子が上に乗っても面の大半は塗り色のままなので、写り込めば必ず出る。
         */
        overlay.style.background = `rgb(${floating.join(",")})`;

        const control = document.createElement("div");
        control.id = "capture-pixel-anchor";
        // `position: fixed` だが `data-floating-overlay` を名乗らないので退避対象外。
        control.style.cssText = [
          "position:fixed",
          "left:0",
          "top:0",
          "width:120px",
          "height:120px",
          "z-index:2147483647",
          `background:rgb(${anchor.join(",")})`,
        ].join(";");
        // `append` は Node 側の型（Body.append）と衝突して解決されるので使わない。
        document.body.appendChild(control);
      },
      [MARK_FLOATING, MARK_ANCHOR] as const,
    );

    /*
     * **窓を前面へ出す。**撮影は `afterNextPaint`（`requestAnimationFrame`）を
     * 待ってから 1 枚を取り出す。背面や隠れた窓では rAF が止まるので、
     * 待ちが解けず写しが `null` のまま送信 UI だけが開く。
     * 実行中に別の窓が前に来ると同じことが起きる。
     */
    await page.bringToFront();

    // 撮る。ここで本物の getDisplayMedia が走る（自タブ取得を自動承諾）。
    await page.getByRole("button", { name: "改善したいことを送る" }).first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog, "撮ったのに送信 UI が開きません").toBeVisible({ timeout: 60_000 });

    const canvas = dialog.locator("canvas").first();
    /*
     * canvas が現れ、かつ**原寸へ差し替わる**まで待つ。
     * 現れるだけでは足りない——画像が載る瞬間に `canvas.width` が
     * `image.naturalWidth` へ書き換わるので、そこを合図にする。
     * 落ちたときは、握り潰された撮影の結末を添えて理由を見えるようにする。
     */
    await expect
      .poll(
        async () =>
          canvas.evaluate((el: HTMLCanvasElement) => el.width).catch(() => 0),
        { message: "写しが canvas へ載りません", timeout: 60_000 },
      )
      .toBeGreaterThan(1)
      .catch(async (error: unknown) => {
        const outcome = await page.evaluate(
          () => (window as unknown as { __captureOutcome?: unknown }).__captureOutcome ?? null,
        );
        throw new Error(
          `写しが canvas へ載りません。撮影の結末: ${JSON.stringify(outcome)}\n${String(error)}`,
        );
      });

    const counted = await canvas.evaluate(
      (el: HTMLCanvasElement, [floating, anchor, tolerance]) => {
        const ctx = el.getContext("2d");
        if (!ctx) throw new Error("canvas の描画文脈が取れません");
        const { data } = ctx.getImageData(0, 0, el.width, el.height);
        const near = (i: number, target: readonly number[]): boolean =>
          Math.abs(data[i] - target[0]) <= tolerance &&
          Math.abs(data[i + 1] - target[1]) <= tolerance &&
          Math.abs(data[i + 2] - target[2]) <= tolerance;

        let floatingHits = 0;
        let anchorHits = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (near(i, floating)) floatingHits += 1;
          if (near(i, anchor)) anchorHits += 1;
        }
        return { floatingHits, anchorHits, size: [el.width, el.height] as const };
      },
      [MARK_FLOATING, MARK_ANCHOR, TOLERANCE] as const,
    );

    // 実数を残す。受入報告はこの出力を引く。
    console.log(`[capture-pixel] ${JSON.stringify(counted)}`);

    // 先に対照を見る。ここが落ちているなら、下の 0 件は無意味である。
    expect(
      counted.anchorHits,
      `対照の色が写しに見つかりません（${counted.size.join("x")}）。撮れていないか、走査が効いていません`,
    ).toBeGreaterThan(ANCHOR_MIN_PIXELS);

    expect(
      counted.floatingHits,
      `送信 UI が写しに ${counted.floatingHits} 画素写り込んでいます（${counted.size.join("x")}）`,
    ).toBe(0);
  });
});
