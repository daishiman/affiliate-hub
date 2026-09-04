# 表の設計 — SEO の診断と反映 (feat-seo-assessment-reflection)

P02 の成果物。正本は `drizzle/0044_funny_groot.sql` と `src/db/schema.ts`。

## `article_seo_assessment`

```sql
CREATE TABLE `article_seo_assessment` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`article_slug` text NOT NULL,
	`check_kind` text NOT NULL,
	`severity` text NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`detail` text NOT NULL,
	`evidence` text NOT NULL,
	`suggestion` text,
	`draft_revision_id` text,
	`dismissed_reason` text,
	`assessed_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
```

## 一意制約が設計の中心

```sql
CREATE UNIQUE INDEX article_seo_assessment_unique_idx
  ON article_seo_assessment (workspace_id, site_slug, article_slug, check_kind);
```

**記事 1 本 × 観点 1 つ = 行 1 つ。**

診断を回すたびに積み増すのではなく、同じ鍵の行を置き換える。

積み増すと、同じ指摘が何度も並び、
運用者が「対応しない」と決めた判断まで毎回流される
（`assessment-catalog.md` の `dismissed`）。

置き換えなので `assessed_at` は「最後に見た時刻」、
`updated_at` は「最後に状態が動いた時刻」を意味する。
2 つが要るのは、**診断を回しただけ**と
**運用者が何か決めた**を区別するためである。

## 一覧のための索引

```sql
CREATE INDEX article_seo_assessment_open_idx
  ON article_seo_assessment (workspace_id, site_slug, state, severity);
```

画面が引くのは「このブログの未対応を、重い順に」である。
`state` と `severity` を索引に入れて、その形のまま引ける。

ただし**出す順は `severity` だけでは決まらない**
（重み × 件数、`assessment-catalog.md`）。
索引は絞り込みを速くするためで、並べ替えはアプリ側で行う。

## `evidence` を NOT NULL にした

根拠のない指摘は表に入らない。

`validateFinding()` が実行時に弾くのに加えて、
**表の側でも入らない**ようにしてある。
外部から直接 INSERT しても、根拠なしの行は作れない。

二重にしているのは、この列がこの feature の存在理由だからである。

## `draft_revision_id` と `dismissed_reason`

| 列 | いつ入るか |
|---|---|
| `draft_revision_id` | `draft_fix` で下書きを作ったとき |
| `dismissed_reason` | `dismiss` で「直さない」と決めたとき |

どちらも null 可。**`state` と対応している**が、
`state` から導出できない情報を持つ。

`draft_revision_id` を持たないと、画面が
「下書きあり」と言えても**どの下書きか**を指せない。

## 公開面の表を持たない

この表は改善層に閉じている。
記事の本文も、公開状態も、この表からは触れない。

AD-3（改善層は公開面へ書けない）が、
**表の設計の時点で守られている**。
`draft_revision_id` は既存の改訂表への参照であって、
この層が改訂を作るわけではない（作るのは `draftFix` を実装する側）。

## 出典の表は別

指針の出典（受入条件 10）は
`src/domain/seo/guideline-reference.ts` と
`d1-guideline-reference-repository` が扱う別の表である。

同じ表に混ぜないのは、指摘が記事ごとに生まれて消えるのに対し、
出典はブログをまたいで長く残るためである。
寿命の違うものを同じ表に置くと、掃除の条件が書けなくなる。
