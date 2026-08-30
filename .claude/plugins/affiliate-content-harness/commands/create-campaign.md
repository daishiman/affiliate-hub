---
name: create-campaign
description: 1 つのアフィリエイト案件を立ち上げる。読者・約束・主張・根拠・買う導線・展開先を決めて案件ブリーフを作り、そのまま最初のブログ記事まで書く。
argument-hint: "[サイトの slug] [商品名]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(node *)
  - AskUserQuestion
  - Skill
  - Agent
---

# 案件を立ち上げる

引数: `$ARGUMENTS`（サイトの slug と商品名。足りない分は聞く）

## やること

### 1. 置き場所を確かめる

`blog-content/<site>/site.json` があるか。無ければ**ここで止める**。
案件はブログの差別化の中に置くもので、置き場所が無い案件は展開先が決まらない。
先に `run-blog-create` でブログを立ち上げてもらう。

### 2. 案件ブリーフを作る

`run-campaign-brief` skill を使う。決めるのは 6 つ。

- 読者 1 人（`persona` の 4 項目）
- 約束と口調（`concept` の 3 項目）
- 主張と根拠（`claims`。`fact` を 1 つ以上、数値は単位まで）
- 買う導線（`productCards`。ASP 発行 URL は改変しない）
- 表示義務（`disclosureRequired`）
- 展開先（`media`）

### 3. 検品する

```bash
P=.claude/plugins/affiliate-content-harness
S=blog-content/<site>
node $P/scripts/validate-campaign-brief.mjs --campaign $S/campaign-brief.json --site $S/site.json
```

止めるものが 0 件になるまで直す。**ここを通さずに媒体へ進まない。**
案件で止められなかったものは、6 媒体へそのまま複製される。

### 4. 最初の 1 本を書く

`run-blog-article` skill でブログ記事を 1 本書く。SNS より先にブログを書くのは、
リンクを置けない媒体（Instagram）の導線がブログへ向くから。

書けたら `assign-blog-content-reviewer` agent に読み直してもらう。

### 5. 報告する

- 案件 id と展開先の媒体
- `persona.objection` に書いた疑い（**全媒体がここへ答えることになる**）
- `fact` の件数と、根拠の付いていない主張の有無
- 買う導線の有無と `disclosureRequired`
- 次にやること（どの媒体から展開するか）

## 展開はまだしない

このコマンドは案件と最初の 1 本まで。SNS への展開は `run-social-post`、
全媒体そろえてからの公開前確認は `/publish-content-set` が受け持つ。

一度に全部やろうとすると、案件が固まる前に 6 媒体ぶんの原稿ができ、
案件を直したときに 6 本とも書き直しになる。
