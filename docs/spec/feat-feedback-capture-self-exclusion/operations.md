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
