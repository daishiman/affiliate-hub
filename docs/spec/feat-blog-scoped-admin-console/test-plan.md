# テスト計画 — ブログごとの管理画面 (feat-blog-scoped-admin-console)

P04 の成果物。

## この feature で壊れやすいもの

管理画面の再編で最も起きやすい誤りは
**「画面はあるが辿り着けない」**である。

- コードは動く
- 型は通る
- その画面のテストも通る
- サイドバーにも親のリンクにも出ていない

P05 で実際に起きた（`appearance` / `placements`）。

**この状態を検出するテストを最優先に置く。**

## 層の割り当て

| 層 | 何を確かめるか | ファイル |
|---|---|---|
| 台帳の整合 | 4 つの表が 1 対 1 | `uiux-screen-single-purpose.test.ts` |
| ナビの派生 | 93 画面が同じ表から出る | `app-shell-nav.test.tsx` |
| 文字量の上限 | 説明文 40 字・注意書き 2 個 | `uiux-spacing-and-copy.test.ts` |
| フォームの形 | 断りの場所・押せる形 | `blog-ops-console-forms.test.tsx` |
| 読み取りの表示 | 足切り・空の扱い | `blog-metrics-pages.test.tsx` |
| 読み上げの床 | 6 画面に重大違反が無い | `blog-ops-a11y-floor.test.tsx` |

## `--project` の割り当て

| ファイル | project |
|---|---|
| `app-shell-nav.test.tsx` | normal |
| `uiux-screen-single-purpose.test.ts` | normal |
| `uiux-spacing-and-copy.test.ts` | normal |
| `blog-ops-console-forms.test.tsx` | normal |
| `blog-metrics-pages.test.tsx` | **a11y** |
| `blog-ops-a11y-floor.test.tsx` | **a11y** |

**同じ `tests/ui/` の下でも project が分かれる。**

`vitest.projects.mjs` の `include` で決まる。
`--project` を間違えると include に無く、
**0 件で緑になる**。

実行報告に必ず project と件数を書く
（`test-run-report.md`）。

## 台帳の整合を最優先にする理由

ふつうのテストは「画面 A が正しく描かれるか」を見る。

このテストは通っても、
**画面 A に誰も辿り着けない**ことは分からない。

だから 4 つの表を突き合わせる:

```
実在route・route metadata・task manifest・priority mapが86件で1対1になる
```

**実在するファイルを数える側から始める。**

表の側から数えると、
表に無い画面は最初から母集団に入らない。

`uiux-spacing-and-copy.test.ts` のコメントが
この失敗を記録している:

```
実測すると、分割で生まれた 17 画面が表に無かった。表は 32 件のまま、
実装は 49 画面。§1 は 32 件を全部緑にして「A10 は満たした」と言っていた。
```

## 床を置く

「0 件である」と主張するテストには、
**母集団が空でないこと**を別に確かめる。

```
下の 3 つはいずれも「0 件である」と主張する。だが 0 は 2 通りの作り方がある。
「差が無い」ときと、**走査に失敗して母集団が空**のときである。
```

例:

```ts
expect(targets.length, "落とす計画のある画面が 1 つも実在しません").toBeGreaterThan(0);
```

```
同じactionの複数route・複数form用途を畳まず、意味entry 81件を床固定する
```

**81 という数を書く。**

「1 件以上ある」では、80 件に減っても通る。

## 上限そのものを当てる

```
「全画面が上限内である」だけを見ていると、いま全画面が短いあいだは
`LEAD_MAX` を 4000 に書き換えても緑のままになる。上限そのものが
```

上限の判定を関数に切り出し、
**境界の 3 点**を直接当てる:

| 入力 | 期待 |
|---|---|
| ちょうど上限 | 通る |
| 上限より 1 字長い | 落ちる |
| 上限より 1 字短い | 通る |

「まで」の意味なので、ちょうどは通す側。

## 確かめないもの

### 1. 見た目の細部

色・余白の実測値は見ない。
トークンが揃っているかだけ見る。

### 2. 権限の判定そのもの

画面は `entry.ready` を出すだけ。
権限の正しさはユースケースのテスト。

### 3. ブラウザでの実描画

`jsdom` で描く。
実ブラウザの差は範囲外。

## 受入条件との対応

| 条件 | 確かめる場所 |
|---|---|
| 1 住所の階層 | `app-shell-nav`（パンくず） |
| 2 1 画面 1 目的 | `uiux-screen-single-purpose` |
| 3 親から辿れる | `uiux-screen-single-purpose`（1 対 1） |
| 4 1 つの表から派生 | `app-shell-nav`（93画面） |
| 5 3 つを別々に解決 | `app-shell-nav` |
| 6 根拠が足りない | `blog-metrics-pages`（足切り） |
| 7 空の表を出さない | `blog-metrics-pages` |
| 8 `onclick` を付けない | `blog-ops-console-forms` |
| 9 断りは欄に出る | `blog-ops-console-forms` |
| 10 注意書き 2 個まで | `uiux-spacing-and-copy` |

**条件 3 を直接見るテストは無い。**

1 対 1 の突き合わせが間接的に担保する
（台帳にある = 親のリンクにもある、とは限らない）。

これは `design-review-findings.md` F-01 の弱点。
