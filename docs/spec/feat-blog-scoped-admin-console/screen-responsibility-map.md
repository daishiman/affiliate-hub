# 画面の受け持ち — ブログごとの管理画面 (feat-blog-scoped-admin-console)

P02 の成果物。正本は `src/presentation/admin/admin-screen-task-manifest.ts`。

## 1 画面 1 目的

```
/**
 * 管理画面の「1画面1目的」と、実際に状態を変える入口のproduction正本。
 * information-priority-map.json の primary_task は、この値との一致を検査する仕様投影。
 *
 * screen task（意味）とruntime edge（置き場所）を分ける。componentを移しても
 * uiEntryだけが変わり、screen/mutationのIDとprimary taskは変わらない。
 */
```

route ID ごとに**1 文だけ**書く。

## ブログ 1 本の下の 10 画面

| route | この画面で何をするか |
|---|---|
| `sites` | 運用中のブログを選ぶ / 新しく作る |
| `sites/[site]` | 1 ブログの設計図を確かめ、運用を続けるか判断する |
| `sites/[site]/edit` | ブログの設計図を直す |
| `sites/[site]/documents` | 運営者情報・各方針・規約・特定商取引法に基づく表記を書き、未記入を無くす |
| `sites/[site]/appearance` | このブログの見せ方と配色を決め、ページ単位の例外を管理する |
| `sites/[site]/placements` | 記事のどこに成果リンクを出しているかを確かめ、掲載の抜けを埋める |
| `sites/[site]/domains` | このブログの住所（独自ドメイン）を登録し、読者へ見せる 1 つを決める |
| `sites/[site]/audience` | どんな読者がどこを読んでいるかを確かめ、次に直す記事を決める |
| `sites/[site]/revenue` | どの記事が稼いでいるかを確かめ、伸ばす記事と畳む記事を決める |
| `sites/[site]/seo` | 検索から届かない原因を 1 つ選び、直しに行く |
| `sites/[site]/aeo` | 回答エンジンに引用される形になっているかを確かめ、足りない答えを補う |

## 目的の文が「見る」で終わっていない

どれも**次の行動**まで書いてある。

| 悪い書き方 | この製品の書き方 |
|---|---|
| 読者の行動を見る | どこを読んでいるかを確かめ、**次に直す記事を決める** |
| 収益を見る | どの記事が稼いでいるかを確かめ、**伸ばす記事と畳む記事を決める** |
| SEO の指摘を見る | 検索から届かない原因を **1 つ選び、直しに行く** |

**「見る」で終わる画面は、何を出せばよいかが決まらない。**

「次に直す記事を決める」なら、
記事を並べて 1 本選べる形にすればよい、と決まる。

### 「1 つ選び」の意味

`sites/[site]/seo` は「原因を 1 つ選び」と書いてある。

全部の指摘を並べて全部直せ、ではない。
`重さ × 件数` で並べて上から 1 つ、という設計になる。

## 意味と置き場所を分ける

```ts
type ScreenRuntimeEntry = {
  readonly id: string;
  readonly classification: RuntimeClassification;  // business-mutation / read-only / ui-demo
  readonly scope: "screen";
  readonly routeId: AdminRouteId;
  readonly ownerTaskId: AdminScreenTaskId | null;
  readonly primaryTaskAffecting: boolean;
  readonly reason: string;
  readonly uiEntry: SourceEdge;   // ← 置き場所
  readonly action: SourceEdge;    // ← 置き場所
};
```

`uiEntry` / `action` はファイルの場所。
`id` / `ownerTaskId` / `primaryTaskAffecting` は意味。

**component を別ファイルへ移しても意味は変わらない。**

`uiux-screen-single-purpose.test.ts`
「runtime edge の module だけを移しても screen/mutation ID 集合は同じ」が
この分離を固定している。

## 3 つの分類

| `classification` | 意味 |
|---|---|
| `business-mutation` | 状態を変える |
| `read-only` | 読むだけ |
| `ui-demo` | 見本帳 |

**`read-only` と `ui-demo` も台帳に載せる。**

「共通 Shell・read-only・UI demo も発見後に理由付きで分類する」
（`uiux-screen-single-purpose.test.ts`）。

載せないと、「台帳に無い = 未分類」と
「台帳に無い = 状態を変えない」が区別できない。

`reason` を必須にして、なぜその分類かを残す。

## `primaryTaskAffecting`

その操作がその画面の主目的に効くかどうか。

`uiux-screen-single-purpose.test.ts`
「screen mutation が所属する primary task は route ごとに 1 種類以下」。

**1 画面に主目的は 1 つまで。**

2 つ以上になったら画面を分ける合図である。
`sites/[site]` から `appearance` を分けたのがこの例で、
コメントに理由が残っている:

```
変えるには 見せ方と配色 を開きます。
この画面からは変えられません（同じものを 2 か所で直せると、
後から書いたほうが静かに勝ちます）。
```

## 参照専用の画面

| route | 目的 |
|---|---|
| `tools` | AI から使える道具を調べる (参照専用) |
| `ui-catalog` | 使える部品を探す (参照専用・見本帳) |
| `writing` | 書き方の決めごとを調べる (参照専用) |

**「(参照専用)」と目的の文に書いてある。**

分類のフィールドだけでなく人間が読む文にも書く。
文と分類が食い違ったら、どちらかが古い。

## `blog` の目的が「(索引)」

```
blog: "ブログの見た目と中身のどこを直すか決める (索引)"
```

索引の画面は「決める」で終わる。
その画面自体では何も直さない。

`sites` も同じ形で「運用中のブログを選ぶ / 新しく作る」。

## 末尾が delete の route が無い

`uiux-screen-single-purpose.test.ts`「末尾が delete の route が無い」。

削除は**削除する対象の画面の中**で行う。

`/admin/sites/[site]/delete` を作ると、
何を消すのか確かめないまま消せる画面ができる。

`sites/[site]` の末尾に `DeleteConfirm` が置いてあり、
消す対象の設計図を全部読んだ後にしか届かない。
