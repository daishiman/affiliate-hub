# 住所の設計 — ブログごとの管理画面 (feat-blog-scoped-admin-console)

P02 の成果物。正本は `src/presentation/ui/admin-route-metadata.ts`。

## 1 つの表から全部を派生させる

```
/**
 * 管理画面の route metadata の正本。
 *
 * 画面ファイル、実 URL、親子関係、パンくず、サイドバー、分類を別々の表へ
 * 書き写さない。route ID を 1 件追加すれば、各射影が同時に増える。
 */
```

派生するもの:

| 射影 | 何になるか |
|---|---|
| 画面ファイル | `src/app/admin/<pattern>/page.tsx` |
| 実 URL | `/admin/<pattern>` の動的部分を埋めたもの |
| パンくず | `parent` を辿った鎖 |
| サイドバー | `nav` を持つ route の並び |
| 分類 | `nav.group` |

**1 つ足せば 5 つ増える。**

### 書き写す形にしない理由

ナビの表と route の表を別々に持つと、
**画面を足してナビに足し忘れた状態**が作れる。

その画面は住所を知っている人だけが開ける。
無いのと変わらない。

`/admin/sites/[site]` のコメントに、実際に起きた記録がある:

```
この 2 画面は P05 で足されたが、入口はどこにも無かった。
住所を知っている人だけが開ける状態で、`/admin/sites/[site]` から
辿れないので、配色を変えたい運営者はこの画面の「色の組み合わせ」を
見て、それが読めない値だと気付かないまま引き返していた。
```

## 定義の形

```ts
type RouteDefinition = {
  readonly label: string | null;
  readonly parent: string | null;
  readonly nav: NavDefinition | null;
  readonly redirectOnly?: boolean;
};

const nav = (label, group, requires, icon): RouteDefinition =>
  ({ label, parent: "", nav: { group, requires, icon } });

const child = (parent, label): RouteDefinition =>
  ({ label, parent, nav: null });
```

2 つの作り方しかない。

| 作り方 | 意味 |
|---|---|
| `nav(...)` | サイドバーに出る親。`parent` は `""`（= `/admin`） |
| `child(...)` | 親の下。サイドバーには出ない |

**サイドバーに出るかどうかを、別のフラグで持たない。**
`nav` が `null` かどうかがそのまま答えになる。

## ブログの階層

```ts
sites: nav("サイト", "publish", "content.read", "site"),
"sites/[site]": child("sites", null),
"sites/[site]/edit": child("sites/[site]", "サイトを直す"),
"sites/[site]/documents": child("sites/[site]", "固定ページ"),
"sites/[site]/appearance": child("sites/[site]", "見せ方と配色"),
"sites/[site]/placements": child("sites/[site]", "成果リンクの掲載"),
"sites/[site]/domains": child("sites/[site]", "住所（独自ドメイン）"),
"sites/[site]/audience": child("sites/[site]", "読者の行動"),
"sites/[site]/revenue": child("sites/[site]", "記事ごとの成果"),
"sites/[site]/seo": child("sites/[site]", "SEO 診断"),
"sites/[site]/aeo": child("sites/[site]", "AEO（回答エンジン）"),
"sites/new": child("sites", "サイトを作る"),
```

### `sites/[site]` の `label` が `null`

ブログの名前は実行時にしか分からない。

固定の文字列を置くと、パンくずが
「サイト > サイト > 住所」のようになる。

`null` は「実データから取る」を意味する。

### `analytics` の下に置かなかった

```
ブログ運営コンソール (arch-blog-operations-console) の 4 層を、
ブログ 1 本の下にぶら下げる。**`analytics` の下に置かない。**
横断の分析画面と同じ場所に置くと、「どのブログの数字か」を
画面の中の選択欄で切り替えることになり、選び忘れたまま
別のブログの数字を読む形が作れる。住所の下なら取り違えようがない。
```

**この 1 つの判断が、この feature の要点である。**

## 分類は 6 つ

```ts
export const ADMIN_NAV_GROUP_LABELS = {
  material: "素材",
  write: "書く",
  publish: "出す",
  earn: "稼ぐ",
  observe: "見る",
  maintain: "整える",
} as const;
```

**作業の順**で並んでいる。機能の種類ではない。

`sites` は `publish`（出す）にある。
ブログは出す場所だからで、
その下に観測（`audience` / `revenue`）が付いても
分類は動かない。

### 境目は 5 つ

分類が 6 つなら境目は 5 つ。外側には付かない。

`app-shell-nav.test.tsx`「分類は 6 つ、境目は 5 つ（外側には付かない）」。

`<hr>` を 6 本置くと、最後の分類の後ろに
何も無い区切りができる。

### 境目に要素を足していない

「境目のために要素を足していない（読み上げに区切りが増えない）」。

CSS の `border` で描く。`<hr>` を並べない。

読み上げソフトは `<hr>` を「区切り」と読む。
6 回読まれると、見出しの数より区切りの数のほうが多くなる。

## 3 つを別々に解決する

`app-shell-nav.test.tsx`
「動的 route の実 URL、選択中ナビ、パンくずを別々に解決する」。

| 何 | 何から作るか |
|---|---|
| 実 URL | pattern + `routeParams` |
| 選択中ナビ | pattern を親へ辿って `nav` を持つものを探す |
| パンくず | pattern を親へ辿って全部 |

**同じ pattern から 3 通りに派生する。**

1 つにまとめると、`/admin/sites/x/seo` を開いたときに
サイドバーで「サイト」が選択中にならない、
といった食い違いが起きる。

## 権限で消えるもの

```ts
sites: nav("サイト", "publish", "content.read", "site"),
                              ^^^^^^^^^^^^^^
```

`requires` を満たさない人にはサイドバーに出ない。

「何も見えない人には、分類の見出しも 1 つも出ない」
（`app-shell-nav.test.tsx`）。

**空の分類見出しを残さない。**
「素材」という見出しだけがあって中身が 0 件の状態は、
権限が無いのか壊れているのか区別が付かない。
