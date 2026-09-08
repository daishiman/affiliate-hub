# 品質・非機能の確認

**phase**: P09 / SYS-FB-CAPTURE-EXCLUSION-P09

## 実行した検査

| 検査 | 結果 |
|---|---|
| `pnpm run typecheck` | エラー 0 |
| `pnpm run lint` | 指摘 0 |
| `pnpm vitest run` | 411 files / 9907 tests passed |
| feature 対象 Vitest（2 ファイル） | 22 passed |
| `pnpm run acceptance:reconcile` | PASS（10 IDs / 196 evidence files、`sha256:35822cc2…`） |
| `pnpm exec vitest run tests/architecture/acceptance-reconciliation.test.ts` | 5 passed |
| `pnpm exec playwright test tests/e2e/capture-self-exclusion.spec.ts` | 4 passed（desktop/mobile） |
| a11y tier（`tests/ui/*` の axe 系一式） | 全緑 |

## e2e を走らせるために直した既存の壊れ（production runtime 変更とは別責務）

`tests/e2e/source-registries.ts` の `readSampleWorkspaceId` は
`ranking-sample-repository.ts` に `const SAMPLE_WORKSPACE_ID = ...` がある前提で
**TypeScript の構文木を手で辿っていた**。`e97e5bc`（同じ規則の実装を 1 本へ寄せる）が
その定数を `sample-identity.ts` へ移し、repository 側は再輸出だけになった。
再輸出には初期化子が無いので読み手は投げる。

**型検査には映らない**ので誰も気付かず、`pnpm test:e2e` は `webServer`
（`tests/e2e/prepare-preview.mts`）の起動時に落ち、**e2e が 1 件も走らない**状態だった。
`readBrowserRoutes` が 2026-08-26 に同じ壊れ方をして import へ移した経緯が
同じファイルに書かれている——**同じ薬が隣の関数にまだ効いていなかった。**

処置は import への置き換え 1 点。次に定数が動いた日は型検査が止める。
本機能の production runtime 要件そのものではないが、**これを直さないと A1 の
CSS 側を測る E2E が起動できない。**変更一覧・影響範囲・切り戻しでも runtime と
検証基盤の責務を分ける。

## アクセシビリティ

送信モーダルの markup は変えていない（`role="dialog"` と焦点管理はそのまま）。
足したのは `data-floating-overlay="true"` だけで、支援技術の解釈に影響しない
（`data-*` は accessibility tree に現れない）。

退避に `visibility: hidden` を使うため、退避中は支援技術からも見えなくなる。
これは意図どおり。退避が続くのは `drawImage` 前後の数フレームだけで、
`finally` で必ず戻る。**戻らない経路が無いことを 3 件のテストで確かめている。**

## 副作用の有無

- **画面の geometry**: `visibility` を使うので折り返しも位置も動かない。
  `display: none` にしていたら、写しの中の景色が実物とずれていた。
- **他の浮遊要素**: スキップリンクは `EXEMPT`。焦点が当たるまで画面外にあり、
  写しにも重なり判定にも現れない。
- **重なり監査 (e2e)**: 属性の意味を変えていないため、既存の除外ロジックはそのまま。
  読む側が 1 つ（写し除外）増えただけ。
- **体感**: 起動ボタンを押してから送信 UI が開くまでに、画面を選ぶ分の間が入る。
  これは仕様上必要な変化で、`release-notes.md` に利用者向けの言葉で書いた。
  撮れない環境では同期で開くので、遅くならない。

## 回帰

本 feature 固有の Vitest 22 件と Playwright 4 件はすべて緑。
受入 receipt は正規の reconciliation write 経路で現 worktree へ同期し、
architecture test 5 件を含む全体 Vitest 411 files / 9907 tests もすべて緑になった。
したがって、現在の全体回帰 gate は PASS と判定する。
`docs/product/test-traceability.md` は Vitest 対象ファイルが 2 件増えたぶんを
`node scripts/traceability.mjs` で生成し直した（`KNOWN_STALE_MAX` は動かしていない）。
`tests/ui/floating-overlay-declaration.test.ts` は
`tests/architecture/form2-population-floor.test.ts` の指摘を受けて
**母集団の床を同じ `it` の中へ移した**（上限は上げていない）。
