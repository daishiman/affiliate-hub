/**
 * @tier 2
 * @req REQ-FB02, REQ-FB03
 * @types screen-states, permission-matrix
 */
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UI_COPY } from "@/presentation/ui/copy";
import {
  CAPTURING_ATTR,
  FLOATING_OVERLAY_ATTR,
  hideFloatingOverlays,
} from "@/presentation/ui/patterns/capture-exclusion";
import { FeedbackButton } from "@/presentation/ui/patterns/feedback-button";

const originalRequestVideoFrameCallback = Object.getOwnPropertyDescriptor(
  HTMLVideoElement.prototype,
  "requestVideoFrameCallback",
);
const originalCancelVideoFrameCallback = Object.getOwnPropertyDescriptor(
  HTMLVideoElement.prototype,
  "cancelVideoFrameCallback",
);

/**
 * 改善要望に添える写しから、送信 UI 自身を外す。
 *
 * --- なぜこの検査が要るのか ---
 *
 * 改善したい箇所を撮ると、その真ん中に「改善したいことを送る」画面が載っていた。
 * **伝えたい箇所が、伝える道具に隠されていた。**写しの用途は「利用者が伝えたい箇所」の
 * 提示であり、送信 UI 自身はその情報を 1 ビットも運ばない。
 *
 * --- 何を見ているのか ---
 *
 * 写しの中身は画像で、jsdom には画素が無い。だから画素は見ない。見るのは
 * **1 枚を取り出す瞬間に、浮いている操作が退避していたか**である。退避の指示は
 * `html[data-capturing]` として文書に出るので、`drawImage` が呼ばれた時点の
 * 文書の姿を控えて確かめる。画素位置にも DOM の形にも依存しない。
 */

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalRequestVideoFrameCallback) {
    Object.defineProperty(
      HTMLVideoElement.prototype,
      "requestVideoFrameCallback",
      originalRequestVideoFrameCallback,
    );
  } else {
    Reflect.deleteProperty(HTMLVideoElement.prototype, "requestVideoFrameCallback");
  }
  if (originalCancelVideoFrameCallback) {
    Object.defineProperty(
      HTMLVideoElement.prototype,
      "cancelVideoFrameCallback",
      originalCancelVideoFrameCallback,
    );
  } else {
    Reflect.deleteProperty(HTMLVideoElement.prototype, "cancelVideoFrameCallback");
  }
  document.documentElement.removeAttribute(CAPTURING_ATTR);
});

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function stubVideoFrameCallbacks(): {
  readonly request: ReturnType<typeof vi.fn>;
  readonly cancel: ReturnType<typeof vi.fn>;
  readonly deliver: () => void;
} {
  let callback: VideoFrameRequestCallback | null = null;
  const request = vi.fn((next: VideoFrameRequestCallback): number => {
    callback = next;
    return 17;
  });
  const cancel = vi.fn();
  Object.defineProperties(HTMLVideoElement.prototype, {
    requestVideoFrameCallback: { configurable: true, value: request },
    cancelVideoFrameCallback: { configurable: true, value: cancel },
  });
  return {
    request,
    cancel,
    deliver: () => {
      callback?.(0, {} as VideoFrameCallbackMetadata);
    },
  };
}

/** 1 枚を取り出した瞬間の、退避の有無を控える台。 */
function stubCapture(options: { readonly grant: boolean }): {
  readonly hiddenAtDraw: boolean[];
  readonly attempts: number;
  readonly stops: number;
} {
  const state = { hiddenAtDraw: [] as boolean[], attempts: 0, stops: 0 };
  vi.stubGlobal("navigator", {
    ...window.navigator,
    mediaDevices: {
      getDisplayMedia: async () => {
        state.attempts += 1;
        if (!options.grant) throw new Error("利用者が断りました");
        return {
          getTracks: () => [{ stop: () => (state.stops += 1) }],
        } as unknown as MediaStream;
      },
    },
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: () => {
      // **ここが観測点。**取り出した瞬間の文書の姿を控える。
      state.hiddenAtDraw.push(document.documentElement.getAttribute(CAPTURING_ATTR) === "true");
    },
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/png;base64,iVBORw0KGgo=",
  );
  return state;
}

function mount(): void {
  render(
    <FeedbackButton
      screenName="順位表"
      route="/admin/rankings"
      canSubmit
      onSubmit={async () => ({ message: UI_COPY.feedback.sent })}
    />,
  );
}

const launcher = (): HTMLElement =>
  screen.getByRole("button", { name: UI_COPY.feedback.openButton });

describe("写しに送信 UI が写らない", () => {
  it("1 枚を取り出す瞬間、浮いている操作は退避している", async () => {
    const state = stubCapture({ grant: true });
    mount();
    fireEvent.click(launcher());

    await waitFor(() => expect(state.hiddenAtDraw).toHaveLength(1));
    expect(state.hiddenAtDraw[0], "撮った瞬間に浮いた操作が退避していません").toBe(true);
  });

  it("退避後の次の映像フレームが届くまで、古いフレームを描画しない", async () => {
    const frames = stubVideoFrameCallbacks();
    const state = stubCapture({ grant: true });
    mount();
    fireEvent.click(launcher());

    await waitFor(() => expect(frames.request).toHaveBeenCalledOnce());
    expect(state.hiddenAtDraw, "次フレームより前の画像を使っています").toEqual([]);
    expect(screen.queryByRole("dialog"), "古いフレームのまま送信 UI を開いています").toBeNull();

    act(() => frames.deliver());

    await waitFor(() => expect(state.hiddenAtDraw).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole("dialog")).not.toBeNull());
  });

  it("次の映像フレームを待てない環境は、DOM の描画待ち後に従来どおり撮れる", async () => {
    Reflect.deleteProperty(HTMLVideoElement.prototype, "requestVideoFrameCallback");
    Reflect.deleteProperty(HTMLVideoElement.prototype, "cancelVideoFrameCallback");
    const state = stubCapture({ grant: true });
    mount();
    fireEvent.click(launcher());

    await waitFor(() => expect(state.hiddenAtDraw).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole("dialog")).not.toBeNull());
  });

  /*
    **開くのを遅らせていること自体を見る。**隠す仕掛けだけに賭けると、
    隠し忘れが 1 つ生まれた日に写り込みが戻る。まだ描いていないものは
    隠し忘れようがない、という二重目の守りがここ。
  */
  it("写しが決まるまで、送信 UI は描かれない", async () => {
    stubCapture({ grant: true });
    mount();
    fireEvent.click(launcher());
    expect(screen.queryByRole("dialog"), "写しより先に送信 UI が開いています").toBeNull();

    await waitFor(() => expect(screen.getByRole("dialog")).not.toBeNull());
  });

  it("撮り終わったら、退避は必ず解ける", async () => {
    stubCapture({ grant: true });
    mount();
    fireEvent.click(launcher());

    await waitFor(() => expect(screen.getByRole("dialog")).not.toBeNull());
    expect(
      document.documentElement.hasAttribute(CAPTURING_ATTR),
      "撮影が終わったのに退避したままです",
    ).toBe(false);
    expect(launcher()).not.toBeNull();
  });

  it("「撮り直す」でも、同じ規則が効く", async () => {
    const state = stubCapture({ grant: true });
    mount();
    fireEvent.click(launcher());
    await waitFor(() => expect(screen.getByRole("dialog")).not.toBeNull());

    // 台紙が出るまで待ってから、そこの「撮り直す」で 1 枚目を捨てる。
    await waitFor(() =>
      expect(screen.getByRole("button", { name: UI_COPY.feedback.captureRetake })).not.toBeNull(),
    );
    fireEvent.click(screen.getByRole("button", { name: UI_COPY.feedback.captureRetake }));

    // 送信 UI が開いている状態から撮り直す。**隠す対象に、この画面自身が入る。**
    fireEvent.click(screen.getByRole("button", { name: UI_COPY.feedback.captureTake }));
    await waitFor(() => expect(state.hiddenAtDraw).toHaveLength(2));
    expect(state.hiddenAtDraw[1], "撮り直した写しに送信 UI が写ります").toBe(true);
    await waitFor(() =>
      expect(document.documentElement.hasAttribute(CAPTURING_ATTR)).toBe(false),
    );
  });
});

describe("撮れないときは、待たせない", () => {
  it("断られたら、送信 UI は開く（待ちは残らない）", async () => {
    stubCapture({ grant: false });
    mount();
    fireEvent.click(launcher());

    await waitFor(() => expect(screen.getByRole("dialog")).not.toBeNull());
    expect(document.documentElement.hasAttribute(CAPTURING_ATTR)).toBe(false);
  });

  /*
    **非対応は「待ってから開く」ではなく「そのまま開く」。**
    1 拍おくと、撮れない端末の人だけが「押しても何も起きない」画面を見る。
  */
  it("撮る手立てが無い環境では、押した瞬間に開く", () => {
    vi.stubGlobal("navigator", { ...window.navigator, mediaDevices: {} });
    mount();
    fireEvent.click(launcher());
    expect(screen.queryByRole("dialog"), "非対応の環境で開くのが遅れています").not.toBeNull();
  });

  it("許可待ちが解けなくても45秒で開き、遅れて届いた写しは使わない", async () => {
    vi.useFakeTimers();
    const lateStream = deferred<MediaStream>();
    const stop = vi.fn();
    const drawImage = vi.fn();
    vi.stubGlobal("navigator", {
      ...window.navigator,
      mediaDevices: { getDisplayMedia: () => lateStream.promise },
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);

    mount();
    fireEvent.click(launcher());

    await act(async () => vi.advanceTimersByTimeAsync(44_999));
    expect(screen.queryByRole("dialog"), "上限の手前で開いています").toBeNull();

    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(screen.queryByRole("dialog"), "45秒の上限で開いていません").not.toBeNull();

    await act(async () => {
      lateStream.resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(stop, "期限後に届いた映像を手放していません").toHaveBeenCalledOnce();
    expect(drawImage, "期限切れの古い写しを描画しています").not.toHaveBeenCalled();
  });

  it("次の描画が止まっても、45秒で退避と映像を手放す", async () => {
    vi.useFakeTimers();
    const stop = vi.fn();
    const drawImage = vi.fn();
    vi.stubGlobal("navigator", {
      ...window.navigator,
      mediaDevices: {
        getDisplayMedia: async () =>
          ({ getTracks: () => [{ stop }] }) as unknown as MediaStream,
      },
    });
    // 非表示タブでは rAF が長時間呼ばれない。その状態を作る。
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);

    mount();
    fireEvent.click(launcher());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(document.documentElement.getAttribute(CAPTURING_ATTR)).toBe("true");

    await act(async () => vi.advanceTimersByTimeAsync(45_000));

    expect(screen.queryByRole("dialog"), "描画待ちのまま開いていません").not.toBeNull();
    expect(
      document.documentElement.hasAttribute(CAPTURING_ATTR),
      "期限後も画面が退避したままです",
    ).toBe(false);
    expect(stop, "期限後も映像trackを借りたままです").toHaveBeenCalledOnce();
    expect(drawImage).not.toHaveBeenCalled();
  });

  it("次の映像フレームが止まっても、45秒で待ちを取り消す", async () => {
    vi.useFakeTimers();
    const frames = stubVideoFrameCallbacks();
    const state = stubCapture({ grant: true });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    mount();
    fireEvent.click(launcher());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(frames.request).toHaveBeenCalledOnce();
    expect(state.hiddenAtDraw).toEqual([]);

    await act(async () => vi.advanceTimersByTimeAsync(45_000));

    expect(screen.queryByRole("dialog"), "映像フレーム待ちのまま開いていません").not.toBeNull();
    expect(frames.cancel).toHaveBeenCalledWith(17);
    expect(state.stops, "期限後も映像trackを借りたままです").toBe(1);
    expect(document.documentElement.hasAttribute(CAPTURING_ATTR)).toBe(false);
    expect(state.hiddenAtDraw).toEqual([]);
  });
});

describe("撮影が重なっても、最新の1回だけを使う", () => {
  it("後から始めた撮影が先に決まったら、古い撮影結果を描画しない", async () => {
    const first = deferred<MediaStream>();
    const second = deferred<MediaStream>();
    const firstStop = vi.fn();
    const secondStop = vi.fn();
    const drawImage = vi.fn();
    let attempts = 0;
    vi.stubGlobal("navigator", {
      ...window.navigator,
      mediaDevices: {
        getDisplayMedia: () => {
          attempts += 1;
          return attempts === 1 ? first.promise : second.promise;
        },
      },
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/png;base64,iVBORw0KGgo=",
    );

    mount();
    fireEvent.click(launcher());
    fireEvent.click(launcher());
    second.resolve({ getTracks: () => [{ stop: secondStop }] } as unknown as MediaStream);

    await waitFor(() => expect(screen.getByRole("dialog")).not.toBeNull());
    await waitFor(() => expect(drawImage).toHaveBeenCalledOnce());

    first.resolve({ getTracks: () => [{ stop: firstStop }] } as unknown as MediaStream);
    await waitFor(() => expect(firstStop).toHaveBeenCalledOnce());
    expect(secondStop).toHaveBeenCalledOnce();
    expect(drawImage, "古い撮影が後から画面を上書きします").toHaveBeenCalledOnce();
    const captureActiveAfterStaleInitial = document.documentElement.hasAttribute(CAPTURING_ATTR);
    expect(
      captureActiveAfterStaleInitial,
      "古い撮影の完了後に退避状態が戻っていません",
    ).toBe(false);
  });

  it("「撮る」を続けて押しても、後から届いた古い撮り直しは使わない", async () => {
    vi.stubGlobal("navigator", { ...window.navigator, mediaDevices: {} });
    mount();
    fireEvent.click(launcher());
    const first = deferred<MediaStream>();
    const second = deferred<MediaStream>();
    const firstStop = vi.fn();
    const secondStop = vi.fn();
    const drawImage = vi.fn();
    let attempts = 0;
    vi.stubGlobal("navigator", {
      ...window.navigator,
      mediaDevices: {
        getDisplayMedia: () => {
          attempts += 1;
          return attempts === 1 ? first.promise : second.promise;
        },
      },
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/png;base64,iVBORw0KGgo=",
    );

    const take = screen.getByRole("button", { name: UI_COPY.feedback.captureTake });
    fireEvent.click(take);
    fireEvent.click(take);
    second.resolve({ getTracks: () => [{ stop: secondStop }] } as unknown as MediaStream);
    await waitFor(() => expect(drawImage).toHaveBeenCalledOnce());

    first.resolve({ getTracks: () => [{ stop: firstStop }] } as unknown as MediaStream);
    await waitFor(() => expect(firstStop).toHaveBeenCalledOnce());
    expect(secondStop).toHaveBeenCalledOnce();
    expect(drawImage, "古い撮り直しが後から画面を上書きします").toHaveBeenCalledOnce();
    const captureActiveAfterStaleRetake = document.documentElement.hasAttribute(CAPTURING_ATTR);
    expect(
      captureActiveAfterStaleRetake,
      "古い撮り直しの完了後に退避状態が戻っていません",
    ).toBe(false);
  });
});

describe("映像を借りたら、どの経路でも返す", () => {
  it("再生で失敗しても、全trackを停止する", async () => {
    const firstStop = vi.fn(() => {
      throw new Error("停止中の例外");
    });
    const secondStop = vi.fn();
    vi.stubGlobal("navigator", {
      ...window.navigator,
      mediaDevices: {
        getDisplayMedia: async () =>
          ({
            getTracks: () => [{ stop: firstStop }, { stop: secondStop }],
          }) as unknown as MediaStream,
      },
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(new Error("再生できません"));

    mount();
    fireEvent.click(launcher());

    await waitFor(() => expect(screen.getByRole("dialog")).not.toBeNull());
    expect(firstStop).toHaveBeenCalledOnce();
    expect(secondStop, "1本の停止失敗で後続trackが残っています").toHaveBeenCalledOnce();
    const captureActiveAfterPlaybackFailure = document.documentElement.hasAttribute(CAPTURING_ATTR);
    expect(
      captureActiveAfterPlaybackFailure,
      "再生失敗後に画面が退避したままです",
    ).toBe(false);
  });
});

describe("名乗りが、写し除外と重なり監査で共通である", () => {
  it("右下固定の起動ボタンが名乗る", () => {
    mount();
    expect(launcher().getAttribute(FLOATING_OVERLAY_ATTR)).toBe("true");
  });

  it("送信モーダルも名乗る（撮り直しのとき隠す対象になる）", () => {
    vi.stubGlobal("navigator", { ...window.navigator, mediaDevices: {} });
    mount();
    fireEvent.click(launcher());
    expect(screen.getByRole("dialog").getAttribute(FLOATING_OVERLAY_ATTR)).toBe("true");
  });

  it("本文へ戻した見本帳の配置は名乗らない（浮いていないため）", () => {
    render(
      <FeedbackButton
        screenName="部品の見本帳"
        route="/admin/ui-catalog"
        canSubmit
        placement="inline"
        onSubmit={async () => ({ message: UI_COPY.feedback.sent })}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: UI_COPY.feedback.openButton });
    expect(buttons.some((b) => b.hasAttribute(FLOATING_OVERLAY_ATTR))).toBe(false);
  });
});

describe("退避の始末（元の状態へ戻る）", () => {
  it("戻す手続きを 2 回呼んでも、他人の印を消さない", () => {
    document.documentElement.setAttribute(CAPTURING_ATTR, "true");
    const restore = hideFloatingOverlays();
    restore();
    restore();
    expect(
      document.documentElement.getAttribute(CAPTURING_ATTR),
      "先に立っていた印まで消えました",
    ).toBe("true");
  });

  it("撮影が入れ子でも、外側が終わるまで退避は解けない", () => {
    const outer = hideFloatingOverlays();
    const inner = hideFloatingOverlays();
    inner();
    expect(
      document.documentElement.getAttribute(CAPTURING_ATTR),
      "内側の撮影が終わった時点で外側の退避まで解けています",
    ).toBe("true");
    outer();
    expect(document.documentElement.hasAttribute(CAPTURING_ATTR)).toBe(false);
  });

  it("撮影を始めた順に終えても、最後の1件まで退避が続く", () => {
    const first = hideFloatingOverlays();
    const second = hideFloatingOverlays();

    first();
    first();
    expect(
      document.documentElement.getAttribute(CAPTURING_ATTR),
      "先に始めた撮影の終了で、まだ活動中の退避まで解けています",
    ).toBe("true");

    second();
    expect(document.documentElement.hasAttribute(CAPTURING_ATTR)).toBe(false);
  });
});
