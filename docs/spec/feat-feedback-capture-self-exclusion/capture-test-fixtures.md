# 撮影の差し替え手順（拒否 / 非対応 / 失敗の再現）

**phase**: P04 / SYS-FB-CAPTURE-EXCLUSION-P04

正本は `tests/ui/feedback-capture-exclusion.test.tsx` の `stubCapture`。
ここはその読み方を書く。

## 差し替える 5 つ

| 対象 | なぜ要るか |
|---|---|
| `navigator.mediaDevices.getDisplayMedia` | jsdom に無い。許可 / 拒否 / 非対応を作り分ける入口 |
| `HTMLMediaElement.prototype.play` | jsdom は再生できず、await が解けない |
| `HTMLVideoElement.prototype.requestVideoFrameCallback` | 退避後の次 video frame 到着を手動で決め、Abort と非対応 fallback も分ける |
| `HTMLCanvasElement.prototype.getContext` | **ここが観測点。**`drawImage` の中で文書の姿を控える |
| `HTMLCanvasElement.prototype.toDataURL` | jsdom は画像を作れない |

## 3 つの環境の作り方

```ts
// 許可された
stubCapture({ grant: true });

// 断られた（getDisplayMedia が throw する）
stubCapture({ grant: false });

// 撮る手立てが無い（mediaDevices はあるが getDisplayMedia が無い）
vi.stubGlobal("navigator", { ...window.navigator, mediaDevices: {} });
```

「非対応」を `mediaDevices` ごと消す形にしないのは、実際の非対応環境が
`mediaDevices` は持ち `getDisplayMedia` だけ持たない形だからである。

## 後始末

`afterEach` で `cleanup()` / `vi.unstubAllGlobals()` / `vi.restoreAllMocks()` に加え、
**`document.documentElement.removeAttribute(CAPTURING_ATTR)`** を必ず行う。
属性は文書に立つので、React の後始末では消えない。
消し忘れると、次のテストが「最初から退避していた」状態で始まり、
**退避が効いていなくても緑になる。**

## 待ち方

`requestAnimationFrame` は jsdom にあるが、`afterNextPaint` は 2 フレーム待つ。
対応環境はその後に `requestVideoFrameCallback` を 1 回待つ。そのため
`drawImage` は同期には呼ばれない。テストは callback を渡す前に
`state.hiddenAtDraw` が空であることを確かめ、渡した後は `waitFor` で
`state.hiddenAtDraw` の長さが増えるのを待つ（`dialog` の出現ではなく
**観測点そのもの**を待つ）。
