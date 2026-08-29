---
name: run-campaign-brief
description: 1 つのアフィリエイト案件について、全媒体が共有する正本（読者・約束・主張・根拠・買う導線・展開先）を決めたいときに使う。ブログや SNS を書き始める前に必ずここを通す。
disable-model-invocation: false
user-invocable: true
argument-hint: "[--site <slug>] [--product <name>] [--campaign <id>] [--media blog,x-long,...]"
arguments: [site, product, campaign, media]
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(node *)
  - AskUserQuestion
kind: run
version: 0.1.0
effect: local-artifact
---

# 案件ブリーフを作る

出来上がるもの: `blog-content/<site>/campaign-brief.json` 1 件。

## なぜ先にこれを作るのか

この harness は 1 つの案件から 6 媒体ぶんの原稿を出す。媒体ごとに書き下ろすと、
**X では「38kPa」、Instagram では「40kPa」**という状態が起きる。どちらも単体では
正しく見えるし、どちらの検品も通る。気づけるのは、2 つ並べて読んだ人だけ。つまり読者だけ。

だから測ったこと・約束・買う導線は、ここで一度だけ決める。各媒体はここから継ぐ。

## 先に読むもの

1. `blog-content/<site>/site.json` — `differentiation` と `categories`。案件はブログの差別化の中に置く
2. `templates/campaign-brief.json` — 手本
3. `references/media-profiles.json` — 展開できる媒体と、その規則

## 決める順

### 1. 読者を 1 人に決める（persona）

4 つとも埋める。1 つでも空だと、媒体ごとに書き手が自分の想像で埋め、
違う読者へ向けた 6 本ができる。

| キー | 書くこと |
| --- | --- |
| `who` | 年齢・仕事・置かれている環境。数字で書く（「6 畳」「1 日 8 時間」） |
| `situation` | いま何に困っているか |
| `jobToBeDone` | 何を片付けたくて商品を探しているか |
| `objection` | 買う直前に何を疑うか |

`objection` が一番効く。ここに書いたことへ全媒体が答える。
「レビューはどれも褒めていて信用できない」と書いたなら、6 本すべてが短所を書くことになる。

### 2. 約束と口調を決める（concept）

`promise` / `differentiation` / `tone` の 3 つ。
`tone` は文体そのものなので、抽象語（「親しみやすく」）で書かない。
**やること・やらないこと**で書く（「測ったことは言い切り、測っていないことは測っていないと書く」）。

### 3. 主張に番号を振る（claims）

各媒体はこの `id` を指して主張を運ぶ。番号が無いと、媒体をまたいだ突合が効かない。

- 測った・確かめた → `kind: "fact"`。**根拠（evidence）が要る**
- そこから考えた → `kind: "inference"`
- 書き手の考え → `kind: "opinion"`

`fact` が 1 つも無い案件は、どの媒体へ出しても感想文になる。
自分で確かめたことを 1 つ以上、根拠付きで入れる。

**数値は単位まで書く。** 「38kPa」「68cm」「12mm」。単位が無いと、
媒体をまたいだ食い違いを機械が見つけられない。

幅のある推測は `55〜60kg` のように範囲で書いてよい。
「1 名ずつの計測なので幅を持たせています」まで書けば、読者は精度を判断できる。

### 4. 買う導線を一度だけ決める（productCards）

- `affiliateUrl` は **ASP が発行した URL をそのまま**入れる。パラメータを足すと多くの ASP で
  規約違反になり、成果が計上されない。リンクは動くので、気づくのは報酬が入らなかったとき
- 計測は `trackingCode` 側でする
- 提携が無いなら `affiliateUrl` と `trackingCode` を**両方消す**。片方でも残すと
  `blockedReason` は黙って消える

導線を 1 つでも置くなら `disclosureRequired: true`。ここが `false` だと、
下流の検品も表記を求めない。**全媒体の広告表記が一斉に消える。**

### 5. 展開先を決める（media）

`references/media-profiles.json` にある媒体だけ書ける。媒体を足すなら、まずあちらへ 1 エントリ足す。

`blog` を外すときは注意する。Instagram は本文にリンクを置けないので、
導線をブログへ送ることを前提にしている。ブログを作らないなら、その行き先を別に決める。

### 6. 検品する

```bash
P=.claude/plugins/affiliate-content-harness
node $P/scripts/validate-campaign-brief.mjs \
  --campaign blog-content/<site>/campaign-brief.json \
  --site blog-content/<site>/site.json
```

## あとから主張が増えたとき

媒体を書いていて新しく測ったことが出てきたら、**先にここへ足してから**その媒体へ書く。
順序を逆にすると、その主張だけ根拠の検査を通らないまま公開される。

## 終わったら

読者・約束・`fact` の件数・導線の有無・展開先の媒体を報告する。
`objection` に何を書いたかは必ず伝える。全媒体がそこへ答えることになるため。
