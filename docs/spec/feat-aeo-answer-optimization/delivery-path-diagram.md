# 配りの経路 — 回答エンジン最適化 (feat-aeo-answer-optimization)

P02 の成果物。記事が回答エンジンへ届くまで。

## 全体

```
   記事（公開済み）
        │
        ├──────────────────────┐
        │                      │
        ▼                      ▼
 ┌─────────────┐        ┌──────────────┐
 │  改善層     │        │   公開面     │
 │（内向き）   │        │（外向き）    │
 └─────────────┘        └──────────────┘
        │                      │
        │ extract              │
        ▼                      ├─ robots.txt   ← 読んでよいと伝える
 article_answer_unit           ├─ sitemap.xml  ← 全部の在り処
        │                      ├─ llms.txt     ← 題名・要約つきの一覧
        │ detectGaps           ├─ rss.xml      ← 新着 20 件
        ▼                      └─ JSON-LD      ← 問答の構造
   管理画面 /admin/sites/[site]/aeo        │
        │                                  ▼
        │ 運用者が読む                 回答エンジン
        ▼                                  │
   記事を直す ─────────────────────────────┘
   （既存の編集・承認経路）
```

## 2 本の線が交わらない

**左（改善層）から右（公開面）へ矢印が無い。**

改善層は記事を読むだけで、公開面へは書けない（AD-3）。

引用単位を抽出しても、それが自動で
`FAQPage` の構造化データになるわけではない。
構造化データは公開面が記事から独自に組み立てる。

### 同じものを 2 回作っていないか

作っている。

`article_answer_unit` の問答と、
`FAQPage` の `mainEntity` は、
どちらも同じ記事の FAQ から作られる。

**それでも分けている。**

改善層のほうは「引用されやすさを診断する」ための写しで、
`positionRatio` や `gaps` という診断用の情報を持つ。

公開面のほうは読者と機械に見せる現物で、
診断の都合を持ち込まない。

片方を他方から作ると、
診断のために足した値が公開面に漏れる。

## `llms.txt` を出すかどうか

```
ブログ設定 emitLlmsTxt
   │
   ├─ true  →  /s/[site]/llms.txt が本文を返す
   │           robots.txt に「# llms.txt: <URL>」の注記が付く
   │
   └─ false →  注記が付かない
```

出す・出さないの判断は**ブログごと**。

`AI_CRAWLERS` の許可は全ブログ共通で、
こちらは切り替えられない（`crawler-policy.md`）。

## 抽出の経路

```
extract(siteSlug, articleSlug)
   │  content.write
   ▼
AnswerUnitExtractor
   │  published_articles から articleJson を読む
   │  取り下げ済み・未公開は 0 件
   ▼
Raw[]  （id と extractedAt が無い形）
   │
   │  同じ問いは先に出たほうを残す
   ▼
AnswerUnitPort.replaceForArticle
   │  記事 1 本ぶんを置き換え
   ▼
article_answer_unit
   │
   ▼
audit_logs  aeo_answer_units.extracted （件数つき）
```

### 件数を監査に残す理由

抽出は置き換えなので、**前にあった問いは黙って消える**。

消えたことが行の差分に残らないので、
「何件になったか」を監査に残す。

回答エンジンへ出していた Q&A が消えた日を、
あとから辿れるようにするため。

## 構えの保存

```
save_profile
   │  site.manage  ← 抽出（content.write）より重い
   ▼
site_aeo_profile （上書き）
   │
   ▼
audit_logs  aeo_profile.changed
```

構えはブログ全体に効く宣言なので、
記事を直す権限では変えられない。

`manage-blog-improvement`
「記事を書く人は抽出できるが、構えは保存できない」。
