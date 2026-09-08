# データモデル — 日次集計 (feat-blog-metrics-rollup)

P02 の成果物。正本は `src/db/schema.ts`（`siteDailyMetrics` / `articleDailyMetrics`）。

## 表の名前について（仕様書との差の申告）

| 仕様書の記述 | 実装 |
|---|---|
| `site_daily_metrics` | `site_daily_metric` |
| `article_daily_metrics` | `article_daily_metric` |
| `revenue_cents` | `revenue_minor` |

**表名を単数にした**のは、このリポジトリの既存表がすべて単数だからである
（`blog_site`, `blog_article`, `site_custom_domain`, `audit_logs` は例外的に複数）。
仕様書側だけが複数形だったので、周りに合わせた。

`revenue_cents` → `revenue_minor` は `metric-definitions.md` に理由を書いた。
「cent」は通貨を 100 分割する前提を名前に埋め込み、円で意味が壊れる。

## `site_daily_metric`

主キー: `(workspace_id, site_slug, day)` — **受入条件 2 の実体**。
この 3 列の組が重複した行は物理的に作れない。

| 列 | 型 | 既定 |
|---|---|---|
| `workspace_id` | TEXT NOT NULL | — |
| `site_slug` | TEXT NOT NULL | — |
| `day` | TEXT NOT NULL (`YYYY-MM-DD`) | — |
| `views` | INTEGER NOT NULL | 0 |
| `unique_sessions` | INTEGER NOT NULL | 0 |
| `clicks` | INTEGER NOT NULL | 0 |
| `conversions` | INTEGER NOT NULL | 0 |
| `revenue_minor` | INTEGER NOT NULL | 0 |
| `average_dwell_seconds` | REAL NOT NULL | 0 |
| `average_scroll_ratio` | REAL NOT NULL | 0 |
| `sample_count` | INTEGER NOT NULL | 0 |
| `computed_at` | INTEGER (timestamp) NOT NULL | `unixepoch()` |

索引: `site_daily_metric_day_idx (workspace_id, day)` — 「今月の全ブログ」を引く経路。

### `sample_count` を集計と同時に残す理由

生イベントは 90 日で消える（AD-4）ので、**後から数え直せない**。
集計と同時に残しておかないと、古い日の数字が「何件から出たのか」が
永久に分からなくなる。

### `computed_at` を持つ理由

「集計がいつの時点のものか」を画面に出すため。出さないと、数字が古いのか
本当に動きが無いのかを運用者が区別できない。

## `article_daily_metric`

主キー: `(workspace_id, site_slug, article_slug, day)`。

`site_daily_metric` の全列に加えて:

| 列 | 型 | 既定 |
|---|---|---|
| `article_slug` | TEXT NOT NULL | — |
| `clicks_by_element` | TEXT NOT NULL (JSON) | `'{}'` |

索引: `article_daily_metric_revenue_idx (workspace_id, site_slug, day, revenue_minor)`
— 「今月いちばん稼いだ記事」を引く経路。

### `clicks_by_element` を列に展開しない理由

`{"cta-main": 12, "sidebar": 3}` の形で JSON として持つ。
列にすると、記事に新しい置き場所を足すたびに migration が要る。
要素の識別子は記事の作りで増減するので、スキーマに固定できない。

## 一意軸の設計判断

`article_slug` を **NOT NULL** にしてある。記事に紐づかない観測
（トップ・一覧・タグページ）は `article_daily_metric` に行を持たない。

`article_slug` を nullable にして `null` の行を 1 本置く案も検討したが、
SQLite の PK は `NULL` を重複扱いしないので、**同じ日に `null` の行が
何本でも作れてしまう**。受入条件 2（同日重複行が作れない）が
構造で守れなくなるため採らなかった。

結果として、記事外の閲覧は `site_daily_metric` にだけ乗る。
この非対称が受入条件 3・4 の等号を崩す。理由は `metric-definitions.md`。

## `reader_interaction_event`（入力側・所有は別 feature）

本 feature が読む元の表。所有者は feat-reader-behavior-analytics。
ここでは読み取りの契約だけを書く。

| 使う列 | 用途 |
|---|---|
| `workspace_id`, `site_slug`, `article_slug` | 集計の軸 |
| `kind` | `view` / `click` の件数を分ける |
| `session_key` | `unique_sessions` の異なり数 |
| `dwell_seconds`, `position_ratio` | 平均滞在・平均到達 |
| `element_key` | `clicks_by_element` の分類 |
| `rollup_day` | **集計の対象日の判定にはこの列を使う** |

`rollup_day` を使い `occurred_at` から毎回計算しないのは、
索引が効かなくなるためと、日付の切り方を計算のたびに再現しないためである。
