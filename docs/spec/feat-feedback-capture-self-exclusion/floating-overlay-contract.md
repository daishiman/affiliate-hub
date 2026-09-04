# `data-floating-overlay` の約束

**phase**: P02 / SYS-FB-CAPTURE-EXCLUSION-P02

## 意味

「この要素は本文の上に浮いている」と、要素が自分で名乗る印。
`true` 以外の値は使わない。

## 1 つの名乗りが、2 つの用途を支える

| 用途 | 読む側 | 何をするか |
|---|---|---|
| 写しからの退避 | `src/presentation/ui/patterns/capture-exclusion.ts` + `patterns.module.css` の `:global()` 規則 | 撮影中だけ `visibility: hidden` |
| 重なり監査からの除外 | `tests/e2e/app-routes.spec.ts` | 重なり判定の対象から外し、代わりに「下へ送れば逃がせるか」を測る |

**手掛かりを 2 系統に割らない。**割ると、片方だけ付けた要素が必ず生まれる。
どちらの側も「付いていない」ことを自分からは言わないので、その要素は静かに
両方の網から漏れる。

## 付ける条件

`src/presentation/ui` 配下の CSS Modules で、単独の class セレクタに
`position: fixed` を持ち、画面上に実際に見えている要素。JSX の開始タグへ
**リテラルで**書く（spread で渡すと静的検査が読めない）。

`position: sticky`、inline style、global CSS、複合 selector による浮遊は、
現在の inventory と `floating-overlay-declaration.test.ts` の**検出範囲外**である。
これらを runtime で無条件に隠す意味ではない。退避対象に広げるときは、
利用者が伝えたい文脈まで消さないかを別の変更で判定する。

## 付けなくてよいもの

焦点が当たるまで画面外にあるもの（スキップリンク）。
写しにも重なり判定にも現れないため、名乗らせると「常に浮いているもの」と混ざる。
除外は `tests/ui/floating-overlay-declaration.test.ts` の `EXEMPT` に
**理由を 1 行添えて**登録する。空の配列に足すのは作業だが、理由を書くのは判断になる。

## 破ったときに何が起きるか

付け忘れると、写しにその要素が写り、重なり監査には「重なっている」と報告される。
どちらも*名乗っていないこと*は言わない。だから P08 の検査が名乗りの側を数える。
