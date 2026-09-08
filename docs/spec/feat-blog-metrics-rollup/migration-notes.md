# 移行のメモ — 日次集計 (feat-blog-metrics-rollup)

P07 の成果物。DB をどう変えたか、戻せるか。

## 変更した migration

| ファイル | 内容 |
|---|---|
| `drizzle/0044_funny_groot.sql` | `reader_interaction_event` / `site_daily_metric` / `article_daily_metric` の新規作成 |
| `drizzle/0045_keen_mysterio.sql` | 両集計表へ `sample_count` を追加 |

## 0045 を後から分けた理由

`sample_count` は受入条件 7（示唆に足りないことを示す列）のために足した。
0044 に混ぜず別ファイルにしたのは、**既に 0044 を当てた環境があるため**である。

適用済みの migration を書き換えると、環境ごとに DB の形が違う状態が
黙って生まれる。drizzle は当てた migration の一覧を持っているので、
書き換えても再適用されない。

```sql
ALTER TABLE `article_daily_metric` ADD `sample_count` integer DEFAULT 0 NOT NULL;
ALTER TABLE `site_daily_metric` ADD `sample_count` integer DEFAULT 0 NOT NULL;
```

`DEFAULT 0 NOT NULL` なので既存行にも入る。SQLite の `ALTER TABLE ADD COLUMN` は
既定値があれば表の作り直しをしない。

**既存行の 0 は「観測が 0 件だった」ではなく「この列ができる前の行」を意味する。**
これは区別できない。0045 より前の集計行は、示唆が出せない扱いになる。
過去日を再集計すれば正しい値が入る（`rollup` は upsert なので上書きされる）。

## 索引

| 索引 | 目的 |
|---|---|
| `reader_interaction_event_rollup_idx` (`workspace_id`,`site_slug`,`rollup_day`) | 集計時の絞り込み |
| `reader_interaction_event_article_idx` (`workspace_id`,`article_slug`,`rollup_day`) | 記事ごとの集計 |
| `reader_interaction_event_retention_idx` (`occurred_at`) | 保持期限の掃除 |
| `article_daily_metric_revenue_idx` (`workspace_id`,`site_slug`,`day`,`revenue_minor`) | 売上順の並べ替え |
| `site_daily_metric_day_idx` (`workspace_id`,`day`) | 期間指定の読み出し |

掃除用の索引が `occurred_at` 単独なのは、掃除が workspace を跨いで
「古いものを全部」消すためである。`rollup_day` ではなく `occurred_at` で
消すのは、`rollup_day` が受け取り側の都合で決まる派生値だから。

## 戻し方

集計表は生イベントから作り直せるので、`site_daily_metric` /
`article_daily_metric` を落としても、90 日以内なら復元できる。

**ただし `revenue_minor` と `conversions` は復元できない。**
これは生イベントに無く、報酬側が別経路で書いた値である。
集計表を落とすと、この 2 列は失われる。

したがって、集計表の作り直しは
**行を消さずに再集計する（upsert）** 手順だけを使う。
`operations-runbook.md` に手順を書いた。

## 本番へ当てるとき

1. `0044` `0045` の順で当てる（drizzle が順序を守る）
2. cron が回るまで集計行は 0 件。画面は「まだ集計していない」を出す
3. 過去日が要るなら、`/admin/sites/[site]/audience` の
   「この日をやり直す」を日ごとに押す（1 回 1 日。範囲指定は無い）

過去日を遡れるのは 90 日ぶんまで。それより前の生イベントは既に無い。
`validateRollupTargetDay` が保持期限より前の日を断るのは、
**0 件の集計結果で既存の行を 0 に上書きしないため**である。
