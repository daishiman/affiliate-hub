# リリースノート — 改善要望の写しから送信 UI を外す

**phase**: P13 / SYS-FB-CAPTURE-EXCLUSION-P13
**宛先**: `dev`（`AGENTS.md` の枝の順番に従い、`main` へは直接出さない）
**release_status**: `not-published`（commit / PR / CI / merge は未実施）

## 変わること

改善したい箇所を撮った写しに、「改善したいことを送る」画面と右下の起動ボタンが
写らなくなる。撮り直しでも同じ。写しが撮れない環境では、これまでどおり待たずに
送信 UI が開く。

## 変更点

| ファイル | 変更 |
|---|---|
| `src/presentation/ui/patterns/capture-exclusion.ts` | 新規。Document 単位の退避 lease、再描画待ち、対応環境の次 video frame 待ち |
| `src/presentation/ui/patterns/feedback-button.tsx` | 撮影と可視化の時点分離、撮影中の退避、モーダルへの名乗り付与、待ちの上限 |
| `src/presentation/ui/patterns/patterns.module.css` | `html[data-capturing="true"] [data-floating-overlay]` を `visibility: hidden` |
| `tests/ui/feedback-capture-exclusion.test.tsx` | 新規。20 件 |
| `tests/ui/floating-overlay-declaration.test.ts` | 新規。名乗り漏れの静的検査 |
| `tests/e2e/capture-self-exclusion.spec.ts` | 新規。desktop/mobile で撮影中の退避と復帰を検証 |
| `tests/e2e/source-registries.ts` | 既存 E2E の起動前提を修正。production runtime 変更とは別責務 |
| `docs/spec/12-改善要望フィードバック仕様.md` | FB-AC-25 追補 |
| `docs/spec/feat-feedback-capture-self-exclusion/` | 設計・テスト設計・運用・証跡 |
| `docs/product/test-traceability.md` | 生成し直し（テストファイル数の追従） |

## 影響範囲

production runtime の影響は改善要望フィードバックの UI だけ。送信経路・保存・一覧・
詳細・払い出しは変更なし。これとは別に、検証を実行可能にする E2E infrastructure として
`tests/e2e/source-registries.ts` の既存前提崩れを修正した（production bundle には入らない）。
`data-floating-overlay` は既に重なり監査が使っていた属性で、**意味は変えていない**。
読む側が 1 つ増えた。

## 体感の変わり方（利用者向け）

起動ボタンを押してから送信 UI が開くまでに、**画面を選ぶ分の間が入る**。
これまでは押した瞬間に開いていた。撮れない環境では変わらない。

## 切り戻し

production runtime の変更を部分的に戻すなら、
`feedback-button.tsx` の `onClick` を `setPendingShot(captureScreen()); setOpen(true);`
に戻せば旧挙動（写り込みも戻る）。CSS と `capture-exclusion.ts` は残しても無害。
`tests/e2e/source-registries.ts` は別責務の検証基盤修正なので、runtime の切り戻しへ
巻き込まない。戻す必要がある場合も独立に扱う。

## 既知の限界

- `position: fixed` を CSS module に書かない浮かせ方（インラインスタイル・`sticky`）は
  名乗り漏れ検査に現れない。
- 実際の capture 出力画素は未観測。DOM・CSS・対応環境の次 video frame までが代理証跡。
- 待ちの上限 45 秒は経験値で、根拠のある数字ではない。
