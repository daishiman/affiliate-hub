# 受入判定 — 7 件

**phase**: P07 / SYS-FB-CAPTURE-EXCLUSION-P07
**判定日**: 2026-08-30（A1 を 2026-09-05 に更新）
**overall**: PASS

| # | 受入条件 | 判定 | 根拠 |
|---|---|---|---|
| A1 | 写しに送信モーダルと起動ボタンが 1 画素も含まれない | **達** | **実際の capture 出力の画素で判定した。** `tests/e2e/capture-pixel-exclusion.spec.ts` がアプリ本体の `getDisplayMedia({preferCurrentTab:true})` を走らせ、送信 UI が載せた canvas（写しの原寸 4480x3150）を走査。浮遊要素に置いた目印は **0 画素**、対照として浮遊でない要素に置いた目印は 175,561 画素。根拠は `evidence/12-capture-pixel-e2e.txt` |
| A2 | 撮り直した写しにも同じ除外規則が効く | 達 | 「「撮り直す」でも、同じ規則が効く」（2 枚目の `hiddenAtDraw` が true） |
| A3 | 拒否・非対応・失敗で待たずに開き、待ちが無限に伸びない | 達 | 拒否・非対応に加え、45秒の境界、遅延 stream、停止した rAF / video frame callback の Abort を検証 |
| A4 | transient activation を失わない | 達（レビュー） | `onClick` → `captureScreen()` → `getDisplayMedia` に `await` が無い。自動検査にしない理由は `test-design.md` |
| A5 | 隠した要素が元へ戻り、隠れたまま残らない | 達 | Document 単位の lease を、逆順・開始順・二重 release のすべてで検証 |
| A6 | 属性が写し除外と重なり監査の同一の手掛かり | 達 | `capture-exclusion.ts` と `tests/e2e/app-routes.spec.ts:146,187` が同じ属性名を読む |
| A7 | 付与漏れを検査が失敗として拾う | 達（定義済み範囲） | `src/presentation/ui` 配下の CSS Modules で、単独 class に `position:fixed` を持つ要素を検査。sticky / inline / global CSS / 複合 selector は既知の範囲外 |

## 残る限界

- `requestVideoFrameCallback` 非対応環境は DOM paint 待ちへ fallback するため、
  fresh-frame の代理保証も対応環境より弱い。実画素の判定は対応環境で行っている。
- 実画素の検査は **画面を持つ実行環境でしか走らない**。同梱 Chromium の headless には
  display capture の実装が無い（`NotSupportedError`）。既定の E2E からは外し、
  `pnpm test:e2e:capture-pixel` で明示的に呼ぶ。CI では走らない。

## 2026-08-30 の未達がどう解けたか

判定日時点では「実 capture 出力の画素を観測していない」ため A1 を PARTIAL に据えていた。
当時のプローブ（`evidence/10-display-capture-probe.txt`）は
`NotReadableError: Could not start video source` で止まり、原因を
**macOS の画面収録許可（TCC）の境界**と記録していた。

**この診断は誤りだった。** 真因は起動引数 `--use-fake-ui-for-media-stream` である。
これは getUserMedia 用のフラグで、display capture では開始できない source を
自動承諾するため必ず失敗する。外したところ、OS の許可を足さずに実 capture の画素が
読めた（自タブ取得は Chromium 内部で完結し、画面収録許可を経由しない）。
経緯は `evidence/11-tab-capture-probe.txt` に書き直してある。

## 判定に使った検査

- `tests/ui/feedback-capture-exclusion.test.tsx` — 20 件すべて緑
- `tests/ui/floating-overlay-declaration.test.ts` — 2 件すべて緑
- `tests/e2e/capture-self-exclusion.spec.ts` — desktop/mobile 4 件緑
- `tests/e2e/capture-pixel-exclusion.spec.ts` — 1 件緑（実画素。`pnpm test:e2e:capture-pixel`）
- `pnpm run typecheck` — エラー 0
- `pnpm run lint` — 指摘 0
- `pnpm vitest run` — 411 files / 9907 tests passed

## 全体 gate

`feat-uiux-overhaul` 所有の受入 receipt は正規の reconciliation write 経路で
現 worktree へ同期した。`pnpm run acceptance:reconcile` は 2026-09-05 時点で
10 IDs / 209 evidence files、
digest `sha256:390748458f42cc69479f905ab2fa9e3c57e589209f2f1585e5e4303d5a1cb154`
で PASS である（判定日 2026-08-30 時点は 196 files /
`sha256:35822cc2ef18563aa396c182e6e25a2818138468ffd4f8410d0be4b0b6ba225c`。
A1 の実画素証跡を足したぶん増えている）。architecture test も 5/5 PASS で、
全体品質 gate の赤は残っていない。

この gate の PASS と A1 の判定は別の軸である。前者は証跡と worktree の一致を、
後者は実 capture 出力画素の観測を表す。2026-09-05 に後者の観測限界が解けたことで
両者が揃い、overall を PASS とした。
