# 使ってよい値

正本は `src/domain/authoring/site-blueprint.ts` と `src/domain/reading/published-article.ts`。
検品スクリプトは**この文書ではなくコードを実行時に読む**ので、コードが増えれば自動で通るようになる。
この文書はコードが変わったら追いつかない可能性がある。食い違ったらコードが正しい。

## ブログの型（`pattern`）

| 値 | どういうブログか |
| --- | --- |
| `specialist_review` | 専門レビュー型。自分で測って書く |
| `comparison_lab` | 比較研究所型。表が主役 |
| `beginner_guide` | 初心者案内型。用語から説明する |
| `personal_brand` | 個人ブランド型。書き手が前に出る |
| `product_discovery` | 商品発見型。まだ知らないものに出会わせる |
| `service_signup` | サービス申込み型。申込みが終点 |
| `tool` | ツール型。読むより使わせる |
| `editorial_media` | メディア編集部型。複数人で回す |
| `story` | ストーリー型。経過を追う |
| `database` | データベース型。一覧と絞り込みが主役 |

`pattern` を決めると `PATTERN_DEFAULT_PAGES` により固定ページの既定が決まる。

## 稼ぎ方（`revenueModel`）

`affiliate` / `ad` / `lead` / `own_product` / `mixed`

これで**広告表記の文面と、買う導線の有無**が変わる。
`ad`（広告掲載のみ）のブログに購入導線を置くと、読者への説明と実際の作りが食い違う。

## 固定ページ（`extraPages` に書ける値）

`home` `category` `ranking` `review` `comparison` `how_to_choose` `beginner_guide`
`faq` `glossary` `tools` `authors` `experts` `methodology` `editorial_policy`
`advertising_policy` `ai_policy` `corrections` `contact` `privacy` `terms`
`search` `shortlist`

このうち次の 8 つは**どのブログにも必ず入る**（`TRUST_REQUIRED_PAGES`）。
`extraPages` に書かなくても入るので、書く必要はない。

`authors` `methodology` `editorial_policy` `advertising_policy` `ai_policy`
`corrections` `contact` `privacy`

## 見た目（`theme`）

- `brandTheme`: `graphite-amber` `indigo-teal` `teal-clay` `indigo-clay` `blue` `pink` `white` `gray` `green` `purple`
- `colorScheme`: `auto` / `light` / `dark`
- `density`: `compact` / `comfortable`
- `radius`: `none` / `small` / `medium` / `large`
- `fontHeading` / `fontBody`: 名札のみ

**色の値（`#rrggbb` など）は書けない。** 名札しか持てないのは、
「そのブログだけ読めない配色」を作れないようにするため。
新しい配色が要るときは、記事側ではなくコード側に名札を足す。

## 記事の型（`type`）

| 値 | 出る場所 | 中身 |
| --- | --- | --- |
| `ranking` | `/best/<slug>` | `ranking` が要る |
| `review` | `/reviews/<slug>` | 1 商品を掘る |
| `comparison` | `/compare/<slug>` | `comparison` の表が要る |
| `guide` | `/guides/<slug>` | 決め方。商品を出さなくてよい |
| `tool` | `/tools/<slug>` | **使わない**（下記） |

`tool` を選ぶと URL は `/tools/<slug>` になるが、その道は道具（計算機）を描くために使われており、
**記事の本文は表示されない**。道具を足したいときは記事ではなく
`src/infrastructure/persistence/sample/reader-interaction-sample.ts` に定義を足す。
検品は `tool` を止める。

## 主張の種類（`claims[].kind`）

| 値 | 意味 | 根拠 |
| --- | --- | --- |
| `fact` | 測った・確かめた | **必須**。無いと検品で止まる |
| `inference` | そこから考えたこと | 任意 |
| `opinion` | 書き手の考え | 任意 |

読者から見て、この 3 つが混ざっている記事は信じられない。
「〜と考えられます」で終わる文を `fact` にしない。

## 会話の話者（`conversation[].speaker`）

`reader` / `writer` / `expert` / `assistant`

1 発言 40〜120 字。短いと会話に見えず、長いと本文の焼き直しになる。
