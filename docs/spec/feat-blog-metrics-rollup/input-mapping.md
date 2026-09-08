# 入力の対応づけ — 日次集計 (feat-blog-metrics-rollup)

P02 の成果物。生イベントの 1 行が、集計のどの列にどう化けるか。
正本は `src/infrastructure/persistence/d1/reader-metrics-repository.ts` の `rollupDay`。

## 集計は SQL 側で畳む

```
生イベントを JS へ引き出すと、1 日ぶんが数十万行になったときに
Worker の実行時間に収まらない。
```

すべての集計を `select` の式として書き、D1 に畳ませてから 1 行だけ受け取る。

## 対応表

| 集計列 | SQL | 元の `kind` |
|---|---|---|
| `views` | `sum(case when kind = 'view' then 1 else 0 end)` | `view` |
| `clicks` | `sum(case when kind = 'click' then 1 else 0 end)` | `click` |
| `unique_sessions` | `count(distinct session_key)` | 全部 |
| `average_dwell_seconds` | `coalesce(avg(case when kind = 'dwell' then dwell_seconds end), 0)` | `dwell` のみ |
| `average_scroll_ratio` | `coalesce(avg(case when kind = 'scroll' then position_ratio end), 0)` | `scroll` のみ |
| `sample_count` | `count(*)` | 全部 |

## 平均を「その種類の行だけ」で取る理由

`avg(case when kind = 'dwell' then dwell_seconds end)` の `case` は
**`else` を持たない**。SQLite では `else` の無い `case` は該当しない行に
`NULL` を返し、`avg()` は `NULL` を数えない。

`else 0` を書くと、表示イベントの 0 が分母に入り、
**平均滞在秒数が常に実際より小さい値になる**。
記事を 5 分読んだ読者がいても、その周りに 50 件の表示イベントがあれば
平均は 6 秒になる。

`coalesce(..., 0)` は「その種類の行が 1 件も無い日」に `NULL` ではなく 0 を返すため。

## 対象日の絞り込みは `rollup_day` 列

```ts
eq(readerInteractionEvents.rollupDay, day)
```

`occurred_at` から日付を計算していない。理由は 2 つ:

1. 計算式を WHERE に書くと索引が効かない
2. 日付の切り方（どのタイムゾーンの何時で切るか）を、書き込み時と
   集計時の両方で再現する必要が出る。書き込み時に 1 度だけ決めて
   列に保存すれば、ずれる余地が無くなる

## 記事側の集計

`article_slug is not null` を加えた同じ集計を `group by article_slug` で行う。

記事外の閲覧（`article_slug` が `null`）はここで落ちる。
これが受入条件 3・4 の等号が崩れる箇所である（`metric-definitions.md` 参照）。

## 要素別クリックの集計

別のクエリで取る:

```sql
select article_slug, element_key, count(*)
where kind = 'click' and article_slug is not null and element_key is not null
group by article_slug, element_key
```

JS 側で記事ごとの `Record<string, number>` に畳み、`JSON.stringify` して
`clicks_by_element` へ入れる。

`element_key` が `null` のクリック（記事本文中のリンクなど、識別子を
振っていない要素）はここで落ちる。したがって

```
Σ clicks_by_element の値  ≤  clicks
```

となる。この差は「識別子を振っていない場所が押された回数」を意味する。

## 売上と成果はここから来ない

`revenue_minor` と `conversions` は生イベントには存在しない。
報酬側（feat-affiliate-hub）が別経路で同じ行へ書く。
本 feature の集計はこの 2 列に触らない（`idempotency-contract.md` 参照）。
