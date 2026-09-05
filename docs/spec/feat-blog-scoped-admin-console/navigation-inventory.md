# 画面の棚卸し — ブログごとの管理画面 (feat-blog-scoped-admin-console)

P02 の成果物。管理画面に今いくつ画面があり、どこに属しているか。

## 総数

| 何 | 数 |
|---|---|
| `src/app/admin/**/page.tsx` | 93 |
| route metadata の定義 | 93 |
| うち `nav(...)`（サイドバーに出る親） | 21 |
| うち `child(...)`（親の下） | 70 |

`app-shell-nav.test.tsx`
「93画面・ナビ・分類は同じ metadata から派生する」。

**実在するファイルと定義の数が一致している。**

片方だけ増えた状態を許すと、
「定義はあるが画面が無い」か
「画面はあるが辿れない」のどちらかになる。

## 分類ごとの親

| 分類 | ラベル | 親の数 |
|---|---|---|
| `material` | 素材 | 3 |
| `write` | 書く | 4 |
| `publish` | 出す | 4 |
| `earn` | 稼ぐ | 2 |
| `observe` | 見る | 3 |
| `maintain` | 整える | 5 |
| **合計** | | **21** |

## 1 対 1 で突き合わせる 4 つの表

`uiux-screen-single-purpose.test.ts`
「実在 route・route metadata・task manifest・priority map が 86 件で 1 対 1 になる」。

| 表 | 何を持つか |
|---|---|
| 実在 route | `page.tsx` のファイル |
| route metadata | ラベル・親・ナビ |
| task manifest | この画面で何をするか |
| priority map | 何を最初に見せるか |

**4 つとも同じ 86 件。**

93 と 86 の差は、リダイレクト専用の route と
共通レイアウトで、1 画面 1 目的の対象外。
`redirectOnly` で印を付けてある。

### なぜ 4 つに分かれているか

1 つの表にまとめれば突き合わせは要らない。

だが「置き場所」（route metadata）と
「意味」（task manifest）を混ぜると、
**ファイルを移しただけで目的が変わる**形になる。

分けた上で件数を突き合わせるのが、
この製品の選択である。

## ブログ配下の 10 画面

`sites` は `publish`（出す）の親。その下:

| route | ラベル | 追加された phase |
|---|---|---|
| `sites/[site]` | （実行時） | 既存 |
| `sites/[site]/edit` | サイトを直す | 既存 |
| `sites/[site]/documents` | 固定ページ | 既存 |
| `sites/[site]/appearance` | 見せ方と配色 | P05 |
| `sites/[site]/placements` | 成果リンクの掲載 | P05 |
| `sites/[site]/domains` | 住所（独自ドメイン） | feat-blog-custom-domain |
| `sites/[site]/audience` | 読者の行動 | feat-reader-behavior-analytics |
| `sites/[site]/revenue` | 記事ごとの成果 | feat-blog-metrics-rollup |
| `sites/[site]/seo` | SEO 診断 | feat-seo-assessment-reflection |
| `sites/[site]/aeo` | AEO（回答エンジン） | feat-aeo-answer-optimization |

**下 5 つが 4 層の入口。**

住所（`domains`）・観測（`audience` / `revenue`）・
改善（`seo` / `aeo`）が、ブログ 1 本の下に並ぶ。

## 入口の二重帳簿

route metadata に足しただけでは、
サイドバーに出ない（`child` は `nav: null`）。

`/admin/sites/[site]` の `actions` に
`TextLink` を並べるのが 2 つ目の入口で、
これが**実際に運営者が辿る道**である。

```
ブログ運営コンソールの 4 層（住所・観測・改善）への口。
**足したら同時にここへ出す。**
```

### 現在の `actions` 11 本

edit / documents / appearance / placements /
domains / audience / revenue / seo / aeo /
（一覧へ戻る）

**`sites/[site]` 配下の 10 画面のうち 9 本 + 戻り。**

自分自身（`sites/[site]`）は含まない。

### 抜けたときに何が起きたか

```
この 2 画面は P05 で足されたが、入口はどこにも無かった。
住所を知っている人だけが開ける状態で、`/admin/sites/[site]` から
辿れないので、配色を変えたい運営者はこの画面の「色の組み合わせ」を
見て、それが読めない値だと気付かないまま引き返していた。
```

`appearance` と `placements` が P05 で足された後、
入口が無い期間があった。

**画面は動いていた。誰も辿り着けなかっただけ。**

テストは通る。route metadata にも載っている。
それでも運営者には無いのと同じだった。

## この二重帳簿を残す理由

サイドバーは `nav` から自動で出る。
`actions` は手で並べる。

自動化すれば抜けは起きない。
だが**並び順と文言を運営者の作業順に合わせられなくなる**。

`actions` の並びは
「直す → 書く → 見せる → 出す → 見る → 直しに行く」
の順で、これは `nav.group` の 6 分類とは別の順序である。

抜けを防ぐのは自動化ではなく、
**コメントに「足したら同時にここへ出す」と書いて残すこと**で
やっている。次に足す人がこの行を読む。

## 権限で消える

```ts
sites: nav("サイト", "publish", "content.read", "site"),
```

`content.read` を持たない人にはサイドバーに出ない。

「何も見えない人には、分類の見出しも 1 つも出ない」
（`app-shell-nav.test.tsx`）。

**中身が 0 件の分類見出しを残さない。**

`sites/[site]` 配下の 10 画面は `child` なので
`requires` を持たない。
権限の判定は各画面のユースケースが行い、
`entry.ready` が `false` として返る。

つまり**サイドバーから消えるのは親だけで、
子は開いた先で断られる**。

URL を直接叩かれても、
読み取りの手前で止まる形になっている。
