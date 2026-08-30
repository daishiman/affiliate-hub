---
name: run-blog-create
description: ブログを 1 本まるごと立ち上げるとき、タイトル・タブ（カテゴリー）・固定ページ・配色・差別化の軸を決めて設計図 JSON を作りたいときに使う。画面のコードは触らない。
disable-model-invocation: false
user-invocable: true
argument-hint: "[--slug <slug>] [--topic <text>] [--pattern <pattern>] [--revenue <model>]"
arguments: [slug, topic, pattern, revenue]
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

# ブログを 1 本立ち上げる

出来上がるもの: `blog-content/<slug>/site.json` 1 件。
これはブログの**設計図**で、タイトル・タブ・固定ページ・見た目・差別化の軸を全部持つ。
画面のコード（`src/presentation/**`）は 1 行も触らない。

## 先に読むもの

- `references/allowed-values.md` — 書ける値。これ以外を書くと検品で止まる
- `templates/site.json` — そのまま検品を通る手本。`_` で始まるキーは注記なので写さない

## 手順

### 1. 何のブログかを 1 文にする

`purpose` に入る。**誰が、何で失敗しないようにするか**を書く。
「オフィス家具の情報を発信する」は目的ではない。誰も失敗しない。

### 2. 型と稼ぎ方を決める

`pattern` を決めると固定ページの既定が決まり、`revenueModel` を決めると
広告表記の文面と買う導線の有無が決まる。この 2 つは後から変えると
全記事の `disclosureRequired` を見直すことになるので、先に決める。

利用者が `--pattern` / `--revenue` を渡していないときは AskUserQuestion で聞く。
勝手に `specialist_review` + `affiliate` にしない（それが一番多いが、一番差別化しにくい）。

### 3. タブ（カテゴリー）を決める

`categories[]` がそのままヘッダーのタブになる。

- **2〜5 個**。1 個ならタブは出ない。6 個以上は読者が選べない
- 並べた順に出る。**最初のタブが一番読ませたいもの**
- `slug` は URL、`name` はタブの文字（4〜6 字以内が読みやすい）
- `oneLine` はカテゴリーページの冒頭にそのまま出るので、
  「〜に関する記事です」ではなく**そのカテゴリーの選び方の基準**を書く
- `initialArticleTypes` に、そのタブで最初に書く記事の型を並べる

タブを分ける基準は「商品の種類」でなくてもよい。
「予算帯」「使う場面」「読者の段階」で分けたほうが、記事が被らない。

### 4. 固定ページを足す

信頼のための 8 ページ（`authors` `methodology` `editorial_policy` `advertising_policy`
`ai_policy` `corrections` `contact` `privacy`）は**書かなくても必ず入る**ので、
`extraPages` には書かない。

足すのは `search` `shortlist` `faq` `glossary` `how_to_choose` `tools` `terms` あたり。
中身を作る当てのないページは足さない。空のページは無いページより悪い。

### 5. 見た目を決める

`theme` は名札しか持てない（色の値は書けない）。
`brandTheme` は「そのブログの読者が読む場所」で選ぶ。
夜に読むブログなら `colorScheme: "dark"`、一覧を横に見比べるブログなら `density: "compact"`。

### 6. 差別化の 10 軸を埋める

**全部必須。** ここが空だと検品で止まる。止まるのは意地悪ではなく、
埋めずに書いた記事が必ず他のブログの言い換えになるから。

特に `evaluationAxis`（何を測って比べるか）と `comparisonScope`（何を範囲外にするか）は、
後で記事を書くときに毎回参照する。「全部おすすめ」と書けなくなるための縛り。

### 7. 検品する

```bash
node .claude/plugins/affiliate-content-harness/scripts/validate-blog-content.mjs --site blog-content/<slug>/site.json
```

`✕`（止めるもの）が 0 になるまで直す。`△`（気になるもの）は理由を説明して残してよい。

## 終わったら

作った設計図の要点を報告する。
タブの並びと、差別化の軸のうち `evaluationAxis` / `comparisonScope` / `conclusionStance` は
記事を書くときに縛りになるので、そのまま書き出す。

記事を書くのは `run-blog-article`。
