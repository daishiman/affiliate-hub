# 表の移行 — SEO の診断と反映 (feat-seo-assessment-reflection)

P08 の成果物。`drizzle/0044_funny_groot.sql` のうち、この feature の分。

## 追加する表

`article_seo_assessment` 1 つだけ。既存の表は変えない。

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

## 索引 2 本

```sql
CREATE UNIQUE INDEX article_seo_assessment_unique_idx
  ON article_seo_assessment (workspace_id, site_slug, article_slug, check_kind);

CREATE INDEX article_seo_assessment_open_idx
  ON article_seo_assessment (workspace_id, site_slug, state, severity);
```

1 本目が設計そのもの（記事 × 観点 = 行 1 つ）。
2 本目は一覧の絞り込み用。

`data-model.md` に理由を書いた。

## 既存データへの影響

**無い。** 新規の表で、既存の記事・改訂・公開状態のどれにも
外部キーを張っていない。

`draft_revision_id` は改訂表の id を入れるが、
**外部キー制約は張っていない**。

### 張っていない理由

改訂が消えたときに、指摘の行まで道連れにしたくない。

改訂が無くなったのなら、その指摘は
「下書きを作ったが、その下書きはもう無い」という状態で残るのが正しい。
行ごと消えると、下書きを作ったこと自体が履歴から消える。

## 行数の見積り

記事 100 本 × 観点 8 種 = 最大 800 行。

置き換えなので**積み増さない**。
記事が増えない限り行数も増えない。

reader-behavior-analytics の `reader_interaction_event`
（1 万 PV/日で 7 万行/日）とは桁が違う。
掃除の仕組みが要らないのはこのためである。

## 巻き戻し

この表を drop すれば元に戻る。
他の表から参照されていないので、順序の制約もない。

ただし**指摘の履歴と「直さない」判断は失われる**。
`dismissed` の判断は運用者が下したもので、
診断を回し直しても復元されない。

## 実体テストの前提

`d1-seo-assessment.test.ts` は Miniflare 上でこの migration を当てて回す。

ローカルで当てるには:

```bash
pnpm db:migrate:local
```
