# テスト設計 — 写り込みを、画素を見ずに確かめる

**phase**: P04 / SYS-FB-CAPTURE-EXCLUSION-P04

## 何を観測するか

写しの中身は画像で、jsdom には画素が無い。**画素は見ない。**
見るのは「1 枚を取り出す瞬間に、浮いている操作が退避していたか」である。
退避の指示は `html[data-capturing]` として文書に出るので、`drawImage` が
呼ばれた時点の文書の姿を控える。**画素位置にも DOM の形にも依存しない。**
加えて、退避後の次 `requestVideoFrameCallback` が届くまで `drawImage` しないことを
確かめる。これも fresh frame の**代理観測**であり、実際の capture 出力画素の
不在を直接証明するものではない。

## 受入とテストの一意対応

| 受入 | テスト | ファイル |
|---|---|---|
| A1 | 1 枚を取り出す瞬間の退避 / 写しが決まるまで UI 未描画 / 退避後の次 video frame 前に描画しない / API 非対応 fallback | `tests/ui/feedback-capture-exclusion.test.tsx` |
| A2 | 「撮り直す」でも同じ規則 / 多重撮り直しで古い結果を破棄 | 同上 |
| A3 | 拒否・非対応 / 45秒境界 / 遅延 stream / 停止 rAF・video frame callback で開く | 同上 |
| A4 | `captureScreen` 先頭に `await` を置かない（コードレビュー + 型検査） | — |
| A5 | 完了後に復元 / 二重 release / lease の逆順・開始順解放 | 同上 |
| A6 | 起動ボタンが名乗る / 送信モーダルも名乗る / 本文へ戻した配置は名乗らない | 同上 |
| A7 | 名乗っていない浮遊要素は、理由付きの除外に限る | `tests/ui/floating-overlay-declaration.test.ts` |

## 偽陽性・偽陰性の回避

- **A7 の 0 件主張には母集団の床を同居させる**。`position: fixed` の class が 0 件、
  走査対象の `.tsx` が 0 件、掴んだ JSX 開始タグが 0 件——どれでも「違反 0 件」は出る。
  床を**同じ `it` の中**へ置く（別の `it` に切り出すと、両者が別々に緑になれる）。
- **検査が空でないことを変異で確かめる**。送信モーダルから属性を外すと A7 は
  `.feedbackDialog` を名指しして落ち、戻すと通る（P11 に記録）。
- **`captureRetake` は台紙が出るまで待ってから押す**。撮影が成功すると台紙が現れ、
  そこの「撮り直す」で `source` を捨てると `captureTake` に戻る。
  待たずに押すと要素が見つからない。

## A4 を自動検査にしていない理由

transient activation は jsdom に存在しない概念で、「勢いが残っているか」を
再現できない。`await` の有無を静的に見る検査は書けるが、
**呼出しの形が少し変わるだけで空振りする検査**になり、緑が意味を失う。
`captureScreen` の doc comment に理由を残し、レビューで見る側に置いた。
