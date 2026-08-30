---
name: run-blog-article
description: 既にある設計図に対して記事を 1 本書くとき、案件ブリーフから主張と導線を継いで順位・レビュー・比較・手引きのいずれかを書きたいときに使う。他媒体へ展開する前の最初の 1 本になる。
disable-model-invocation: false
user-invocable: true
argument-hint: "[--site <slug>] [--type ranking|review|comparison|guide] [--slug <slug>] [--category <slug>] [--campaign <path>]"
arguments: [site, type, slug, category, campaign]
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(node *)
  - AskUserQuestion
  - Skill
kind: run
version: 0.1.0
effect: local-artifact
---

# 記事を 1 本書く

出来上がるもの: `blog-content/<site>/articles/<slug>.json` 1 件。

**ブログはこの harness で最初に書く媒体。** X も Instagram も、あとからこの記事を見て書く。
だからここで案件から外れると、外れたまま 5 媒体へ複製される。上流ほど強く見る。

## 先に読むもの

必ず**この順**で読む。順番を変えると、書いてから直すことになる。

1. `blog-content/<site>/campaign-brief.json`（あれば）— **主張・根拠・買う導線の正本**
2. `blog-content/<site>/site.json` — 特に `differentiation` と `categories`
3. `references/granularity.md` — どこまで細かく書くか
4. `references/display-map.md` — 書いたことが画面のどこに出るか
5. `templates/article.<type>.json` — 手本

案件ブリーフがあるなら、`claims` と `productCards` は**そこから継ぐ**。記事で書き下ろすと、
X が記事を見て書き、Instagram が X を見て書き、案件を一度も通らない主張が 5 媒体へ広がる。
記事を書いていて新しく測ったことが出てきたら、**先に案件ブリーフへ足してから**記事へ書く。

継ぐときは、記事の claim へ `sourceClaimId` で案件の番号を書く。

```json
{ "id": "a1", "sourceClaimId": "c2", "statement": "…壁から 68cm の空間が必要でした。", "kind": "fact" }
```

**記事の `id` は `a1..aN`、案件は `c1..cN` で、別の名前空間である。**
記事の `a1` が案件の `c2` を指すことは普通に起きるので、対応は `sourceClaimId` だけが持つ。
記事側に `c1` と書くと `validate-blog-content.mjs` が止める。番号が偶然一致した日に、
`sourceClaimId` を見ずに名前で解決してしまう読み方を防ぐため。

`sourceClaimId` が無いと、媒体をまたいだ突き合わせはこの記事を見ない。数値がずれても何も出ない。

書かない場合もある。案件と関係のない読み物（使い方の手引きなど）には付けない。
その記事は突き合わせに渡さなくてよい。

## 型を選ぶ

| 型 | いつ使うか |
| --- | --- |
| `ranking` | 3 つ以上を、同じ基準で測って並べられるとき |
| `review` | 1 つを、自分で使った記録があるとき |
| `comparison` | 2〜4 つを、同じ数値の列で並べられるとき |
| `guide` | 商品ではなく決め方を書くとき。買う導線を置かないことが多い |

`tool` は選べない。選ぶと `/tools/<slug>` へ送られるが、その道は計算機を描くので**本文が表示されない**。

## 書き順

### 1. 結論から書く

1 つ目のセクションが結論。**条件付きで言い切る。**

> 悪い: 「ErgoOne Pro がおすすめです。」
> 良い: 「腰の負担を最優先にするなら ErgoOne Pro。体重 55kg 未満は座面が沈みきらないので FlexSeat 2。」

条件のない結論は誰にも当たらない。条件は `site.json` の
`differentiation.conclusionStance` に沿わせる。

### 2. 測り方を書く

`ranking` と `comparison` は「どうやって比べたか」のセクションを必ず持つ。
`criteria[].measurement` が書けない基準は、基準にしない。

数が出せないときは、**どういう状況で試したか**を書く。
「室温 24℃、同一の被験者、8 時間連続」まで書けば、読者は再現できるかを判断できる。

### 3. 主張に印を付ける

本文を書いたら、その中の主張を `claims` に切り出す。

- 測った・確かめた → `kind: "fact"`。**根拠が要る**（無いと検品で止まる）
- そこから考えた → `kind: "inference"`
- 書き手の考え → `kind: "opinion"`

`fact` が全体の 1/3 を下回るなら、その記事は感想文になっている。
根拠に `url` を付けるとリンクになる。自社検証なら `url` を省いて `sourceLabel` に日付ごと書く。
確認から時間が経ったものは `expired: true` にする（読者に古さが見える）。

### 4. できないことを書く

- `review` → 「向いていない人」のセクション
- `ranking` → `excluded`（外した商品と理由）
- `guide` → 「買う前に測るもの」

短所を書かない記事は、読者が最初に疑う。`excluded` を空にすると、
「都合の悪い商品を黙って外した」と区別が付かない。

### 5. 商品を出す

`productCards` の落とし穴が 2 つある。

- **未計測は省略ではなく `value: null`。** 省くと商品ごとに行の並びが変わり、横に見比べられなくなる
- **提携がないときは `affiliateUrl` と `trackingCode` を両方消す。** 片方でも残すと
  `blockedReason` は黙って消え、購入ボタンが出る

`disclosureRequired` は、買う導線を 1 つでも置くなら `true`。
`false` のまま導線を置くと検品で止まる。

**広告表記の文面は本文に書かない。** 画面が `disclosureRequired` を見て自動で出す
（文面の正本は `src/presentation/ui/copy.ts`）。本文にも書くと同じ断りが 2 回出て、
片方が古い文面に見える。SNS ではこれが逆になる（自分で本文へ書く）ので、
媒体を移るときに間違えやすい。

### 6. 会話を足す（任意）

`conversation` は `reader` / `writer` / `expert` / `assistant` の 4 種。
**2 人以上**、1 発言 40〜120 字。本文の焼き直しではなく、
読者が実際に引っかかるところを `reader` に言わせる。

### 7. 検品する

```bash
P=.claude/plugins/affiliate-content-harness

# 1 本だけ直したとき
node $P/scripts/validate-blog-content.mjs \
  --site blog-content/<site>/site.json \
  --article blog-content/<site>/articles/<slug>.json \
  --campaign blog-content/<site>/campaign-brief.json

# 公開前（記事を全部渡す。リンク先の実在まで見る）
node $P/scripts/validate-blog-content.mjs --all \
  --site blog-content/<site>/site.json \
  $(for f in blog-content/<site>/articles/*.json; do printf -- "--article %s " "$f"; done)

# 広告表記（記事は本文に書かない側）
node $P/scripts/validate-affiliate-disclosure.mjs \
  --campaign blog-content/<site>/campaign-brief.json \
  --article blog-content/<site>/articles/<slug>.json
```

`--all` を付けたときだけ、`reviewSlug` が実在するかまで確かめる。

### 8. 中身を見てもらう

検品は形と粒度しか見ない。「読む価値があるか」は `assign-blog-content-reviewer` に渡す。

## 終わったら

記事の型・タブ・字数・`fact` の件数・導線の有無を報告する。
検品で `△` を残したときは、残した理由を書く。
案件ブリーフへ主張を足したなら、**どの id を足したか**も書く。他媒体はそれを見て展開する。
