# 設計 — 撮影と可視化を別の時点へ分ける

**phase**: P02 / SYS-FB-CAPTURE-EXCLUSION-P02

## 二層で守る

| 層 | 仕掛け | 何を防ぐ | 単独では防げないもの |
|---|---|---|---|
| 1 | 写しが決まるまで送信 UI を描かない | 初回の写り込み | 撮り直し（既にモーダルが開いている） |
| 2 | 撮影中だけ `data-floating-overlay` を退避 | 撮り直しを含む全経路 | 名乗り忘れた要素 |

**一層だけを選ばなかった理由。**層 2 だけに賭けると「どの要素も名乗り忘れない」に
全部を賭けることになる。層 1 だけでは撮り直しを覆えない。
まだ描いていないものは隠し忘れようがない、が層 1 の値打ちである。
そして名乗り忘れは P08 の検査が拾う。

## 状態遷移

```
押す ──canCapture()?──no──▶ setOpen(true)            （同じ tick で開く）
        │yes
        ▼
   captureScreen() ──▶ shot: Promise<string|null>
        │                    │
        │              openWhenShotSettles(shot, open)
        │                    ├─ 解決/棄却 ──▶ open()（1 回だけ）
        │                    └─ 45 秒 ────▶ open()（1 回だけ）
        ▼
   getDisplayMedia ─▶ play ─▶ hide ─▶ 2×rAF ─▶ requestVideoFrameCallback ─▶ drawImage
                                                （対応時。非対応は fallback）       │
                                                                                  ▼
                                                                     restore (finally) ─▶ toDataURL
```

## 決めたことと、その理由

- **`visibility: hidden` を使い `display: none` にしない。**消すと本文の折り返しが
  変わり、**写しの中の景色が実物とずれる**。伝えたい箇所の位置がずれては意味がない。
- **属性は文書 (`html`) に立てる。**React の状態で各部品が自分を隠す形にすると、
  隠す責任が部品ごとに散らばり、付け忘れが必ず生まれる。印は 1 つ。
- **復元は「消す」ではなく「元の値へ戻す」。**撮り直し中の再撮影で撮影が入れ子に
  なったとき、単に消すと内側の終了で外側の退避まで解ける。
- **DOM の再描画後、対応環境では次の video frame を待つ。**`2×rAF` は退避後の
  DOM paint を待つが、画面共有映像へその姿が取り込まれた時点までは示さない。
  `requestVideoFrameCallback` 非対応環境は DOM paint 待ちまでで続行する明示的な
  fallback とし、同等の fresh-frame 保証とは扱わない。
- **待ちに上限 (45 秒) を置く。**許可の窓は放置できる。放置されると
  `getDisplayMedia` は解決も棄却もせず、押したのに何も起きない画面が残る。
  長めなのは、この待ちが機械の遅さではなく**人が画面を選ぶ時間**だからである。
- **非対応は同期で見分ける (`canCapture`)。**1 拍おいて開くと、撮れない端末の人
  だけが「押しても何も起きない」画面を見る。撮れないことは待つ理由にならない。

## transient activation を落とさない

`onClick` から `getDisplayMedia` の呼出しまでに `await` を 1 つも置かない。
`captureScreen` は `async` だが、最初の `await` までは同期に進むので勢いは残る。
**ここに `await` を足すと、許可の窓が出なくなる。**
