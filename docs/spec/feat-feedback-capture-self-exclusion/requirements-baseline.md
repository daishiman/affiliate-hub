# 要求ベースライン — 写しに送信 UI が写り込む

**phase**: P01 / SYS-FB-CAPTURE-EXCLUSION-P01
**feature**: feat-feedback-capture-self-exclusion

## 何が起きていたか

改善したい箇所を伝えるために画面の写しを撮ると、その写しの真ん中に
「改善したいことを送る」画面（送信モーダル）が載っていた。
**伝えたい箇所が、伝える道具に隠されていた。**

写しの用途は「利用者が伝えたい箇所」の提示である。送信 UI 自身は、その情報を
1 ビットも運ばない。**観測器を被写体に含めない**、が本 feature の 1 行の要求である。

## 受入 7 件の観測可能化

| # | 受入条件 | 観測できる形 | 現行コードの該当箇所 |
|---|---|---|---|
| A1 | 写しに送信モーダルと右下固定の起動ボタンが 1 画素も含まれない | 代理観測: `drawImage` 時の `html[data-capturing="true"]`、実 CSS の `visibility:hidden`、対応環境の次 video frame。出力画素の観測は別途必要 | `feedback-button.tsx` `captureScreen()` |
| A2 | 「撮り直す」で取り直した写しにも同じ除外規則が効く | 2 枚目の `drawImage` 時点でも同じ | `CaptureCanvas` の撮り直し → `captureTake` |
| A3 | 拒否・非対応・失敗のとき、送信 UI は待たずに開き、待ちが無限に伸びない | 拒否時は解決後ただちに `dialog` が現れる。非対応は同じ tick で現れる | `canCapture()` / `openWhenShotSettles()` |
| A4 | 押した勢い（transient activation）を失わず、許可の窓が出る | `onClick` から `getDisplayMedia` までに `await` が 1 つも無い | `captureScreen()` 先頭 |
| A5 | 写しの確定後、隠した要素が元へ戻り、隠れたまま残らない | 撮影後に `html[data-capturing]` が消えている | `hideFloatingOverlays()` の返す復元手続き |
| A6 | `data-floating-overlay="true"` が写し除外と重なり監査の同一の手掛かり | 両方が同じ属性名を読む | `capture-exclusion.ts` / `tests/e2e/app-routes.spec.ts` |
| A7 | 属性の付与漏れがある浮遊要素を検査が失敗として拾う | 属性を外すと検査が赤くなる（変異で確認） | `tests/ui/floating-overlay-declaration.test.ts` |

## 数えない要求（scope_out）

改善要望機能そのものの無効化、起動ボタンの撤去、写しの書き込み仕様の変更、
一覧・詳細・払い出し経路の変更、写し以外の添付手段の追加。
**起動ボタンは残す。**撮影中だけ写しの対象から外す。

## 関連

- `capture-timeline.md` — 各時点で送信 UI がどう見えていたか
- `floating-overlay-inventory.json` — 浮いている要素の棚卸し
- `docs/spec/12-改善要望フィードバック仕様.md` — 上位の仕様（P12 で追補）
