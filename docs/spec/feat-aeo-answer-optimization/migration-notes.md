# 表の追加 — 回答エンジン最適化 (feat-aeo-answer-optimization)

P09 の成果物。`drizzle/0044_funny_groot.sql`。

## 追加した 2 表

```sql
CREATE TABLE `article_answer_unit` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`article_slug` text NOT NULL,
	`kind` text NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`position_ratio` real DEFAULT 0 NOT NULL,
	`source_ref` text,
	`gaps` text DEFAULT '[]' NOT NULL,
	`extracted_at` integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX `article_answer_unit_question_idx`
  ON `article_answer_unit` (`workspace_id`,`site_slug`,`article_slug`,`question`);
CREATE INDEX `article_answer_unit_site_idx`
  ON `article_answer_unit` (`workspace_id`,`site_slug`,`kind`);

CREATE TABLE `site_aeo_profile` (
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`topic_scope` text DEFAULT '' NOT NULL,
	`audience` text DEFAULT '' NOT NULL,
	`publisher_name` text DEFAULT '' NOT NULL,
	`structured_data_enabled` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`workspace_id`, `site_slug`)
);
```

## 索引 2 本の役割

| 索引 | 何を守るか |
|---|---|
| `..._question_idx`（UNIQUE） | 同じ問いが 2 行にならない |
| `..._site_idx` | ブログ全体を種類つきで一覧する |

一意索引が置き換えの正しさを守り、
もう 1 本が画面の読み取りを支える。

### 一意索引を `question` に置いた

`id` ではなく `question` が実質の鍵である
（`data-model.md`）。

`id` は主キーだが、**同一性の判定には使っていない**。
抽出は毎回新しい `id` を作るので、
`id` で重複を防ごうとしても防げない。

## 主キーの形が 2 表で違う

| 表 | 主キー |
|---|---|
| `article_answer_unit` | 単一 `id`（+ 一意索引） |
| `site_aeo_profile` | 複合 `(workspace_id, site_slug)` |

構えは**ブログ 1 つにつき 1 行**なので、
複合主キーがそのまま同一性になる。

引用単位は 1 記事に複数あるので `id` が要る。

## 外部キーを張っていない

`site_slug` / `article_slug` に外部キー制約が無い。

これは `article_seo_assessment` と同じ判断である。

- 記事は D1 の外（R2 の JSON）にも実体を持つ
- 記事が消えたときに単位を巻き込んで消したいわけではない
- 抽出は毎回「今の記事」から作り直すので、
  古い単位が残っても次の抽出で消える

**参照整合性ではなく、置き換えで正しさを保つ設計。**

## 既定値の入れ方

| 列 | 既定 | 意味 |
|---|---|---|
| `position_ratio` | `0` | 先頭扱い（隙間にしない側） |
| `gaps` | `'[]'` | 空配列。NULL を作らない |
| `source_ref` | （既定なし・NULL 可） | 出典が無いことを表す |
| `structured_data_enabled` | `false` | 明示的に有効化するまで出さない |

`gaps` に NULL を許さず `'[]'` を既定にしたのは、
**「隙間を調べていない」と「隙間が無い」を
JSON の側で区別しない**という判断である。

区別が要るなら行の有無で表す。

`structured_data_enabled` の既定が `false` なのは、
構えを決めていないブログが
勝手に構造化データを出さないようにするため。

## 行数の見積り

`article_answer_unit`:

- 記事 1 本あたりの単位は多くて 10 件程度
  （一文の結論 1 + FAQ 数件 + 見出し由来数件）
- 記事 100 本 × 10 = 1,000 行

`site_aeo_profile`:

- ブログの数と同じ。数十行。

**どちらも小さい。** 生イベント（`reader_interaction_event`）と違って
掃除の仕組みは要らない。

## 適用

```bash
pnpm db:migrate:local     # ローカル
```

`0044` は追加のみ。既存の列を変えていないので、
戻すときは 2 表を落とすだけでよい。
