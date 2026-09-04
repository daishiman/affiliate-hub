/**
 * 端末に入っている Chrome を headless で動かし、1 枚の HTML を絵に撮る。
 *
 * ## なぜ Playwright E2Eと別に残すか
 *
 * Playwright は実routeの到達・組版・操作を監査する。こちらは既存UIカタログ5場面の
 * 小さな画像baselineを、端末のChromeと確定済みの比較/承認台帳で守る。
 * 同じ画像をPlaywright側へ複製すると見本が二つになるため統合しない。
 * DevTools Protocol と Node 22 の組み込みWebSocketを使い、既存baselineとの互換を保つ。
 *
 * ## `--screenshot` を使わない理由（実測）
 *
 * `Chrome --headless --screenshot=out.png` は **絵を書き出したあと終了しない**
 * （2026-08-19、Chrome 151 で 2 回とも 180 秒待って戻らず）。
 * 撮れているのに待ち続けるので、外から時間で切ることになり、
 * 「時間切れ」と「撮れなかった」が区別できなくなる。
 * CDP なら撮り終わりが応答として返るので、待つ理由が無くなる。
 */

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * 端末に入っている Chrome を探す。
 *
 * 見つからなければ**投げる**。ここで見つからないことを「撮る場面 0 件」に
 * 落とすと、ブラウザが無い機械で検査が満点になる。
 *
 * @returns {string}
 */
export function findChrome() {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv) {
    if (!existsSync(fromEnv)) throw new Error(`CHROME_PATH が指す先がありません: ${fromEnv}`);
    return fromEnv;
  }
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  const found = candidates.find((path) => existsSync(path));
  if (found === undefined) {
    throw new Error(
      [
        "Chrome が見つかりません。見た目の回帰は撮れません。",
        "探した先: " + candidates.join(" / "),
        "別の場所にあるなら CHROME_PATH で渡してください。",
        "**ここで黙って 0 件にしません。**撮れていないことを緑にすると、",
        "見た目の崩れを見ていない状態が「差分 0 件」として記録に残ります。",
      ].join("\n"),
    );
  }
  return found;
}

/**
 * 撮った環境の名札。**見本はこの名札ごとに分けて置く。**
 *
 * 書体が端末の既定に落ちるため（`scripts/lib/static-preview.mjs` の
 * `KNOWN_DIFFERENCES`）、macOS で撮った見本と Linux で撮った絵は
 * **中身が同じでもほぼ全画素が違う**。分けずに 1 組だけ置くと、
 * 機械が変わった日に全部赤くなり、赤の意味が失われる。
 *
 * NodeだけがRosetta上のx64でも、Chrome・書体・画面はApple Silicon端末のものなので、
 * `process.arch`をそのまま使うと同じ端末の見本がx64/arm64へ分裂する。
 * macOSだけはhostのarm64対応を見て名札を決め、他OSはprocess architectureを使う。
 *
 * @param {NodeJS.Platform} platform
 * @param {string} processArchitecture
 * @param {boolean} hostSupportsArm64
 * @returns {string}
 */
export function baselineArchitecture(platform, processArchitecture, hostSupportsArm64) {
  return platform === "darwin" && hostSupportsArm64 ? "arm64" : processArchitecture;
}

/** @returns {boolean} */
function darwinHostSupportsArm64() {
  if (process.platform !== "darwin") return false;
  try {
    return execFileSync("/usr/sbin/sysctl", ["-n", "hw.optional.arm64"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() === "1";
  } catch {
    return process.arch === "arm64";
  }
}

/**
 * @param {string} chromeVersion `Browser.getVersion` の `product`
 * @returns {string}
 */
export function environmentTag(chromeVersion) {
  const major = /\/(\d+)\./.exec(chromeVersion)?.[1] ?? "unknown";
  const architecture = baselineArchitecture(
    process.platform,
    process.arch,
    darwinHostSupportsArm64(),
  );
  return `${process.platform}-${architecture}-chrome${major}`;
}

/**
 * @typedef {object} Viewport
 * @property {number} width
 * @property {number} height 撮る前の見える高さ。実際の絵は中身の高さまで伸びる
 */

/**
 * Chrome を 1 回だけ立ち上げて、渡された HTML を順に撮る。
 *
 * 場面ごとに立ち上げ直さないのは、立ち上げに約 0.8 秒かかるため
 * （実測 2026-08-19）。同じ 1 つのブラウザで撮ることには
 * 「場面ごとに条件が変わらない」という別の効き目もある。
 *
 * @param {readonly { readonly name: string, readonly html: string, readonly viewport: Viewport }[]} pages
 * @returns {Promise<{ environment: string, chromeVersion: string, shots: { name: string, png: Buffer }[] }>}
 */
export async function captureAll(pages) {
  if (typeof globalThis.WebSocket !== "function") {
    throw new Error(
      `この Node には WebSocket がありません（${process.version}）。Node 22 以上で走らせてください。`,
    );
  }

  const chrome = findChrome();
  const profile = mkdtempSync(join(tmpdir(), "visual-regression-"));
  const child = spawn(
    chrome,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--hide-scrollbars",
      // 端末の拡大率に引きずられると、同じ画面でも人によって大きさが変わる。
      "--force-device-scale-factor=1",
      // 検査中に更新や翻訳の案内が出ると、その分だけ絵が変わる。
      "--disable-extensions",
      "--disable-component-update",
      "--disable-translate",
      "--disable-features=Translate,MediaRouter",
      "--mute-audio",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  /** @type {string[]} */
  const chromeLog = [];
  child.stderr.on("data", (d) => chromeLog.push(String(d)));

  /** @type {import("node:child_process").ChildProcess} */
  let closed = false;
  child.once("exit", () => {
    closed = true;
  });

  try {
    const port = await waitForPort(join(profile, "DevToolsActivePort"), () => closed, chromeLog);
    const meta = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const cdp = await connect(meta.webSocketDebuggerUrl);

    const chromeVersion = meta.Browser ?? "unknown";
    /** @type {{ name: string, png: Buffer }[]} */
    const shots = [];

    for (const page of pages) {
      const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      await cdp.send("Page.enable", {}, sessionId);
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: page.viewport.width,
        height: page.viewport.height,
        deviceScaleFactor: 1,
        mobile: false,
      }, sessionId);
      /*
        動きを止める。入場のアニメーションが途中で写ると、
        同じ画面が撮るたびに違う絵になり、**赤が毎回出る**。
        毎回出る赤は無視されるようになるので、動きは検査の対象から外す。
        （動きそのものは `docs/product/T2-experience-spec.md` の受け持ち）
      */
      /*
        **明暗の既定を固定する。** headless Chrome の `prefers-color-scheme` は
        既定が `dark` である（実測 2026-08-19、Chrome 151）。固定しないと
        `color-scheme: light dark`（＝利用者が選んでいない状態）の画面が暗く描かれ、
        「明るいほう」として撮った絵が実は暗いほうになる。
        **実際にそれで、明るい 1 枚と暗い 1 枚が同じ絵になっていた**
        （5 場面あるのに見ているのは 4 場面、という状態が絵の枚数からは見えない）。
        ここを `light` に固定すると、`auto` の場面は明るいほうに落ち着く。
        暗いほうを見たい場面は `data-color-mode="dark"` を明示する。
      */
      await cdp.send("Emulation.setEmulatedMedia", {
        features: [
          { name: "prefers-reduced-motion", value: "reduce" },
          { name: "prefers-color-scheme", value: "light" },
        ],
      }, sessionId);

      await cdp.send("Page.setDocumentContent", {
        frameId: targetId,
        html: page.html,
      }, sessionId);
      await settle(cdp, sessionId);

      const { data } = await cdp.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
        optimizeForSpeed: false,
      }, sessionId);
      shots.push({ name: page.name, png: Buffer.from(data, "base64") });

      await cdp.send("Target.closeTarget", { targetId });
    }

    await cdp.send("Browser.close").catch(() => {});
    cdp.close();
    return { environment: environmentTag(chromeVersion), chromeVersion, shots };
  } finally {
    /*
      片づける前に、Chrome が**本当に終わったこと**を待つ。
      待たずに消すと、まだ書いている最中のファイルに当たって ENOTEMPTY で落ちる
      （実測 2026-08-19）。撮影は済んでいるのに後片づけだけで赤くなる形で、
      これを放置すると「たまに赤くなる検査」になり、赤そのものが無視される。
    */
    if (!closed) {
      child.kill("SIGKILL");
      await new Promise((resolve) => {
        if (closed) resolve(undefined);
        else child.once("exit", () => resolve(undefined));
        setTimeout(() => resolve(undefined), 5_000);
      });
    }
    /*
      片づけるのは、この関数が `mkdtempSync` で作った一時領域だけ。
      リポジトリには一切触れない。消せなくても撮影の結果は返す
      （片づけの失敗で検査の判定を変えない）。
    */
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // 残っても困るのは容量だけ。OS の一時領域なので、いずれ消える。
    }
  }
}

/**
 * 描き終わりを待つ。
 *
 * 「絵が動かなくなるまで」ではなく**書体が使える状態になるまで**を待つ。
 * 時間で待つと、遅い機械でだけ字の無い絵が撮れて、そこだけ赤くなる。
 *
 * @param {{ send: (m: string, p?: object, s?: string) => Promise<any> }} cdp
 * @param {string} sessionId
 */
async function settle(cdp, sessionId) {
  await cdp.send("Runtime.evaluate", {
    expression: `new Promise((resolve) => {
      const ready = document.fonts ? document.fonts.ready : Promise.resolve();
      ready.then(() => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    })`,
    awaitPromise: true,
  }, sessionId);
}

/**
 * @param {string} file
 * @param {() => boolean} died
 * @param {string[]} log
 * @returns {Promise<string>}
 */
async function waitForPort(file, died, log) {
  const started = Date.now();
  while (!existsSync(file)) {
    if (died()) throw new Error("Chrome が立ち上がる前に終了しました:\n" + log.join(""));
    if (Date.now() - started > 30_000) {
      throw new Error("Chrome の口が 30 秒開きませんでした:\n" + log.join(""));
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return readFileSync(file, "utf8").split("\n")[0].trim();
}

/**
 * DevTools Protocol の口を開く。返り値は `send` と `close` だけ。
 *
 * @param {string} url
 */
async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => {
    ws.onopen = () => res(undefined);
    ws.onerror = () => rej(new Error("Chrome の口につながりませんでした"));
  });

  let nextId = 0;
  /** @type {Map<number, { res: (v: any) => void, rej: (e: Error) => void }>} */
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(String(event.data));
    if (typeof message.id !== "number") return;
    const waiting = pending.get(message.id);
    if (waiting === undefined) return;
    pending.delete(message.id);
    if (message.error) waiting.rej(new Error(JSON.stringify(message.error)));
    else waiting.res(message.result);
  };
  ws.onclose = () => {
    for (const waiting of pending.values()) waiting.rej(new Error("Chrome の口が閉じました"));
    pending.clear();
  };

  return {
    /**
     * @param {string} method
     * @param {object} [params]
     * @param {string} [sessionId]
     */
    send(method, params = {}, sessionId) {
      const id = (nextId += 1);
      return new Promise((res, rej) => {
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close() {
      ws.close();
    },
  };
}
