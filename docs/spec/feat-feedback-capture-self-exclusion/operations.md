# 運用 — 本文の上に浮く要素を足すとき

**phase**: P12 / SYS-FB-CAPTURE-EXCLUSION-P12

## 手順

1. CSS で `position: fixed` を書く。
2. その class を使う **JSX の開始タグへ `data-floating-overlay="true"` をリテラルで**書く。
   spread（`{...props}`）で渡すと静的検査が読めない。
3. `pnpm vitest run tests/ui/floating-overlay-declaration.test.ts` で確かめる。

これだけで、写しからの退避と重なり監査からの除外の両方が同時に効く。
CSS 側に追加は要らない（`patterns.module.css` の `:global(html[data-capturing="true"]
[data-floating-overlay])` が属性で拾う）。

## 名乗らせたくないとき

`tests/ui/floating-overlay-declaration.test.ts` の `EXEMPT` に
**理由を 1 行添えて**登録する。理由が空だと検査が落ちる。
浮かなくなった要素の除外が残っていても落ちる（腐った除外を残さないため）。

## 検査が落ちたときの読み方

| 落ち方 | 意味 | すること |
|---|---|---|
| `.<class> が名乗っていません` | 付け忘れ | 開始タグへ属性を書く |
| `position: fixed の class が 1 つも見つかりません` | 走査が壊れた | 検査側を直す。**上限を緩めない** |
| `<name> はもう浮いていません` | 除外が腐った | `EXEMPT` から消す |

## 待ちの上限 (45 秒) を変えるとき

`feedback-button.tsx` の `CAPTURE_OPEN_DEADLINE_MS`。
短くすると、画面を選んでいる最中に送信 UI が開き、その姿が写しに入る。
長くすると、許可の窓を放置した人の待ちが伸びる。
**どちらが痛いかは実際の苦情で決める。**根拠のない微調整はしない。

## 撮影中の見え方を確かめたいとき

開発者ツールで `document.documentElement.setAttribute("data-capturing", "true")`
を実行すると、退避後の画面がそのまま見える。戻すときは
`removeAttribute("data-capturing")`。

## 名乗りを**読む**側を足すとき（2026-09-05 追補）

`data-floating-overlay` を読む場所は現在 3 つある。

| 読む場所 | 何のために |
|---|---|
| `patterns.module.css` の `:global(html[data-capturing="true"] [data-floating-overlay])` | 撮影中の退避 |
| `tests/e2e/app-routes.spec.ts` の `coveredControls` | 重なり監査からの除外 |
| `tests/e2e/capture-pixel-exclusion.spec.ts` | 実画素の判定 |

**読む側を足すときは、必ず「複数ある」前提で書く。**

```ts
document.querySelectorAll("[data-floating-overlay]")   // ○
document.querySelector("[data-floating-overlay]")      // ✗ 先頭 1 つしか返さない
```

`querySelector` を使うと、名乗る要素が 2 つ目に増えた日に**検査は赤くならず、
測る対象が静かに減る。**2026-09-05 に重なり監査でこの形が 1 件見つかった
（名乗る側は既に起動ボタンと送信 UI の 2 箇所あったのに、読む側だけが単数前提だった）。

帯を合成して 1 つの外接矩形にするのも避ける。右下と左上に浮遊要素があると、
外接矩形が画面のほぼ全体になり、間にある操作が全部「覆われている」ことになる。
**帯ごとに個別に判定する。**

## `position: sticky` を名乗らせないこと

追従ヘッダー・表の見出し・目次のように**流れの中に席を持つ**ものは名乗らせない。
名乗ると写しからヘッダーが消え、重なり監査も本物の重なりを見逃す。
`floating-overlay-declaration.test.ts` の 2 つ目の `it` がこの向きを数えている。

画面幅で `fixed` と `sticky` を切り替える class は、**浮くときがある側**として扱う。

## 実画素で確かめたいとき

```bash
pnpm test:e2e:capture-pixel        # = PLAYWRIGHT_CAPTURE_PIXEL=1 playwright test
```

**画面を持つ実行環境でしか走らない**（同梱 Chromium の headless に display capture の
実装が無い）。CI へ混ぜると環境依存で赤くなるので project ごと分けてあり、
既定の `pnpm run test:e2e` には現れない。CI で毎回効く網は代理証跡の側である。

読み方は `evidence/12-capture-pixel-e2e.txt`。`floatingHits` が 0 でも、
**`anchorHits`（対照）が 0 なら走査が壊れている。**先に対照を見ること。
