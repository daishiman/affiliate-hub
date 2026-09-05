# 表の設計 — 回答エンジン最適化 (feat-aeo-answer-optimization)

P02 の成果物。正本は `drizzle/0044_funny_groot.sql`。

## 表は 2 つ

| 表 | 単位 |
|---|---|
| `article_answer_unit` | 記事の中の引用単位 |
| `site_aeo_profile` | ブログ全体の構え |

## `article_answer_unit`

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
```

### 鍵は「問い」である

```sql
CREATE UNIQUE INDEX article_answer_unit_question_idx
  ON article_answer_unit (workspace_id, site_slug, article_slug, question);
```

記事 × **問い** = 行 1 つ。

SEO 側が記事 × 観点だったのに対し、こちらは記事 × 問い。

**問いが単位の身元だからである。**
同じ問いに 2 つの答えがあると、
どちらが引用されるか制御できない。

抽出側も同じ前提で重複を落としている:

> 同じ問いが 2 つ以上できたら先に出たほうを残す。
> 記事の前のほうにある答えを優先するほうが、
> 引用されたときに意図に近い。

### 一覧用の索引

```sql
CREATE INDEX article_answer_unit_site_idx
  ON article_answer_unit (workspace_id, site_slug, kind);
```

ブログ全体を種類ごとに見るための索引。

### `gaps` を保存する

判定結果を列に持つ。

`detectGaps` は純関数なので、読むときに計算し直すこともできる。
それでも保存したのは、
**抽出した時点の判定を残す**ためである。

閾値（300 文字 / 0.5）を変えたときに、
「前はどう判定されていたか」が分かる。

ただし**表示に使うのは読み直したときの判定**で、
応用層が `detectGaps` を呼び直す（AD-2）。
列は履歴として持つ。

### `position_ratio` が `real`

0..1 の比率。整数に丸めない。

節が 3 つなら 0 / 0.5 / 1 になり、
0.5 ちょうどは**埋もれていない**
（判定が `> BURIED_ANSWER_THRESHOLD` なので）。

## `site_aeo_profile`

```sql
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

**主キーがそのままブログである。** ブログ 1 つに構え 1 つ。

### 行が無いことに意味がある

`AeoProfilePort.get` は行が無ければ `null` を返す。

**既定値をでっち上げない。**

`topic_scope: ''` を返すと、画面は
「領域を空文字と決めた」と「まだ決めていない」を区別できない。

d1 の「構えが未設定のブログは null を返す（既定値をでっち上げない）」と
`manage-blog-improvement` の
「構えを決めていないブログは profile が null で返る（画面が入力を促せる）」
で固定してある。

列に `DEFAULT ''` があるのは、
行を作るときの初期値であって、
行が無いときの読み値ではない。

## 公開面の表を持たない

どちらの表も改善層に閉じている。

記事の本文も公開状態もここからは触れない。
AD-3 が表の設計の時点で守られている。

## SEO の表と分けた理由

| | `article_seo_assessment` | `article_answer_unit` |
|---|---|---|
| 何の行か | 直すべきこと | 記事から取り出した現物 |
| 鍵 | 記事 × 観点 | 記事 × 問い |
| 状態 | 4 種（open/drafted/applied/dismissed） | **無い** |
| 運用者の判断 | 残る（`dismissed`） | 残らない |

**AEO の単位に状態が無いのが決定的な違い。**

引用単位は記事の写しなので、
記事が変われば作り直される。
運用者が「この単位は残す」と決める余地が無い。
