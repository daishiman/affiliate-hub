# 受入判定 — 7 件

**phase**: P07 / SYS-FB-CAPTURE-EXCLUSION-P07
**判定日**: 2026-08-30
**overall**: PARTIAL

| # | 受入条件 | 判定 | 根拠 |
|---|---|---|---|
| A1 | 写しに送信モーダルと起動ボタンが 1 画素も含まれない | **一部達（PARTIAL）** | 単体で `drawImage` 時の DOM 退避と送信 UI 未描画を確認、Chromium E2E で `visibility:hidden` を確認、対応環境では `requestVideoFrameCallback` による退避後の次フレーム待ちを確認。ただし**実際の capture 出力の画素は観測していない** |
| A2 | 撮り直した写しにも同じ除外規則が効く | 達 | 「「撮り直す」でも、同じ規則が効く」（2 枚目の `hiddenAtDraw` が true） |
| A3 | 拒否・非対応・失敗で待たずに開き、待ちが無限に伸びない | 達 | 拒否・非対応に加え、45秒の境界、遅延 stream、停止した rAF / video frame callback の Abort を検証 |
| A4 | transient activation を失わない | 達（レビュー） | `onClick` → `captureScreen()` → `getDisplayMedia` に `await` が無い。自動検査にしない理由は `test-design.md` |
| A5 | 隠した要素が元へ戻り、隠れたまま残らない | 達 | Document 単位の lease を、逆順・開始順・二重 release のすべてで検証 |
| A6 | 属性が写し除外と重なり監査の同一の手掛かり | 達 | `capture-exclusion.ts` と `tests/e2e/app-routes.spec.ts:146,187` が同じ属性名を読む |
| A7 | 付与漏れを検査が失敗として拾う | 達（定義済み範囲） | `src/presentation/ui` 配下の CSS Modules で、単独 class に `position:fixed` を持つ要素を検査。sticky / inline / global CSS / 複合 selector は既知の範囲外 |

## 未達

- A1 の出力条件「1 画素も含まれない」は、実画像の画素を読まない限り完了とは判定しない。
- `requestVideoFrameCallback` 非対応環境は DOM paint 待ちへ fallback するため、fresh-frame の代理保証も対応環境より弱い。
- 2026-08-30 にローカル Chromium で自動選択した実 display capture を開始するプローブを
  実行したが、OS の screen recording 境界で `NotReadableError: Could not start video source`
  となった。失敗を成功証跡へ読み替えず、結果は `evidence/10-display-capture-probe.txt` に残す。

## 判定に使った検査

- `tests/ui/feedback-capture-exclusion.test.tsx` — 20 件すべて緑
- `tests/ui/floating-overlay-declaration.test.ts` — 2 件すべて緑
- `tests/e2e/capture-self-exclusion.spec.ts` — desktop/mobile 4 件緑
- `pnpm run typecheck` — エラー 0
- `pnpm run lint` — 指摘 0
- `pnpm vitest run` — 411 files / 9907 tests passed

## 全体 gate

`feat-uiux-overhaul` 所有の受入 receipt は正規の reconciliation write 経路で
現 worktree へ同期した。`pnpm run acceptance:reconcile` は 10 IDs / 196 evidence files、
digest `sha256:35822cc2ef18563aa396c182e6e25a2818138468ffd4f8410d0be4b0b6ba225c`
で PASS、architecture test も 5/5 PASS である。全体品質 gate の赤は残っていない。

この gate の PASS と A1 の PARTIAL は別の軸である。前者は証跡と worktree の一致、
後者は実 capture 出力画素をまだ直接観測していないという観測限界を表す。
