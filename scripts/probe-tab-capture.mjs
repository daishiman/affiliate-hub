/*
 * 「実 capture の画素を読めるか」だけを確かめる最小の探り。
 *
 * --- 何が詰まっていたか ---
 *
 * 長らく `NotReadableError: Could not start video source` で止まっていた。
 * 原因は **`--use-fake-ui-for-media-stream`** だった。これは getUserMedia
 * (カメラ・マイク) の許可ダイアログを自動承諾するためのフラグで、
 * display capture では「不正な source を選んだことにして承諾する」ため、
 * 開始できない stream を掴んで必ず失敗する。
 *
 * 正しいのは `--auto-accept-this-tab-capture` + `preferCurrentTab: true`。
 * **自タブ取得は Chromium 内部で完結するので OS の画面収録許可を必要としない。**
 * 「許可が要る」という当初の診断は誤りだった。
 *
 * ここで確かめるのは 1 点だけ: getDisplayMedia が stream を返し、
 * その 1 フレームを canvas へ描いて画素を読み出せるか。
 */
import { chromium } from "playwright";

const TITLE = "CaptureProbeTab";

const browser = await chromium.launch({
  headless: false,
  args: [
    // 自タブ取得だけを、選択窓を出さずに承諾する。
    "--auto-accept-this-tab-capture",
    // http://localhost を secure context として扱わせる必要はないが、
    // route 横取りで localhost を名乗る構成に合わせて許可しておく。
    "--allow-http-screen-capture",
  ],
});

const page = await browser.newPage();

/*
 * `setContent` は about:blank 上で動くため `navigator.mediaDevices` が存在しない
 * （secure context ではない）。localhost を名乗る必要があるので、実際には
 * 通信させずに route で横取りして同じ中身を返す。origin が localhost になれば
 * secure context として扱われる。
 */
await page.route("http://localhost:3999/**", (route) =>
  route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: `<!doctype html><title>${TITLE}</title>
      <body style="margin:0;background:rgb(0,128,255)">
        <div id="mark" style="position:fixed;right:0;bottom:0;width:80px;height:80px;background:rgb(255,0,0)"></div>
      </body>`,
  }),
);
await page.goto("http://localhost:3999/");

const result = await page.evaluate(async () => {
  try {
    // アプリ本体 (feedback-button.tsx の captureScreen) と同じ経路を通す。
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      preferCurrentTab: true,
    });
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // 1 フレーム目が届くまで待つ。届かないまま読むと真っ黒になる。
    await new Promise((resolve) => {
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(() => resolve());
      else setTimeout(resolve, 500);
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    const center = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    const corner = ctx.getImageData(canvas.width - 10, canvas.height - 10, 1, 1).data;
    stream.getTracks().forEach((t) => t.stop());
    return {
      ok: true,
      size: [canvas.width, canvas.height],
      center: [center[0], center[1], center[2]],
      corner: [corner[0], corner[1], corner[2]],
    };
  } catch (error) {
    return { ok: false, name: error.name, message: error.message };
  }
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
