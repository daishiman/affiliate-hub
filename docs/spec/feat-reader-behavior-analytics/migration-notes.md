# 表の変更 — 読者行動の観測 (feat-reader-behavior-analytics)

P09 の成果物。

## 追加した表

`drizzle/0044_funny_groot.sql` で 3 表が同時に入る。
このうち本 feature が所有するのは `reader_interaction_event` である。
`site_daily_metric` / `article_daily_metric` は
feat-blog-metrics-rollup が所有し、本 feature はその**書き手**にあたる。

```sql
CREATE TABLE `reader_interaction_event` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`site_slug` text NOT NULL,
	`article_slug` text,
	`kind` text NOT NULL,
	`segment` text NOT NULL,
	`viewport_band` text NOT NULL,
	`position_ratio` real DEFAULT 0 NOT NULL,
	`dwell_seconds` integer DEFAULT 0 NOT NULL,
	`element_key` text,
	`session_key` text NOT NULL,
	`rollup_day` text NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch()) NOT NULL
);
```

`0045_keen_mysterio.sql` は集計側へ `sample_count` を足す。
何件の観測から作った数字かを、集計の行が自分で持つためである。

## 索引

```sql
CREATE INDEX reader_interaction_event_rollup_idx
  ON reader_interaction_event (workspace_id, site_slug, rollup_day);
CREATE INDEX reader_interaction_event_article_idx
  ON reader_interaction_event (workspace_id, article_slug, rollup_day);
CREATE INDEX reader_interaction_event_retention_idx
  ON reader_interaction_event (occurred_at);
```

3 本とも、実際に走るクエリに対応している。

| 索引 | 使う場所 |
|---|---|
| `rollup_idx` | 1 日ぶんの集計 |
| `article_idx` | 記事ごとの到達分布 |
| `retention_idx` | 90 日の掃除 |

### `session_key` に索引が無いのは意図である

**足さないこと。**

張れば「この鍵の行を全部」が速く引ける。それは受入条件 4 が
禁じているクエリそのものである。

索引が無ければ全表走査になるので、実装しようとした人が性能で気づく。
気づいて索引を足そうとしたとき、この節に行き当たってほしい。

`invariant-checklist.md` の I-4 に同じことを書いてある。

## 主キー

`id` は**送信側（ブラウザ）が生成**し、受け口はそれを主キーとして書く。

- 同じ束が二度届いても `id` が衝突し、2 回目は行を増やさない（受入条件 7）
- 受け口で採番すると、二度目の束が全部新しい行になる

合成鍵（`workspace_id, site_slug, session_key, kind, occurred_at`）に
しなかった理由は F-05 に書いた。鍵に `session_key` が入ると索引が張られ、
条件 4 が禁じたクエリが最も速い経路になる。

## 戻し方

```sql
DROP TABLE reader_interaction_event;
```

**この表を落とすと、まだ集計していない日の観測が失われる。**
`site_daily_metric` / `article_daily_metric` に畳んだ日は残るが、
畳む前の日は再現できない。

落とす前に、少なくとも直近 `ROLLUP_DAYS`（既定 2）日ぶんの集計を
先に走らせること。手順は `operations-runbook.md`。

`sample_count`（0045）を戻すと、集計の行が
「何件から作ったか」を言えなくなる。画面は根拠不足を伏せられなくなり、
1 件の観測から作った数字がそのまま出る。

## 行数の見積り

1 人が 1 記事を読むと最大 7 件（開いた 1 + 刻み 4 + 滞在 1 + 離脱 1）、
クリックがあればその数だけ増える。

日に 1 万 PV なら 7 万行/日、90 日で 630 万行。
D1 の 1 データベースの上限に対しては十分収まるが、
掃除が止まると積み上がる。`computed_at` で止まりに気づく仕組みは
`operations-runbook.md`。
