# 運用手順 — 読者行動の観測 (feat-reader-behavior-analytics)

P13 の成果物。動かし続けるために要ること。

## 毎日の 2 つの仕事

`src/infrastructure/platform/reader-metrics-scheduler.ts` が、
定時起動でこの順に走る。

1. **集計** — 前日ぶんの生イベントを `site_daily_metric` /
   `article_daily_metric` へ畳む
2. **掃除** — 90 日を過ぎた `reader_interaction_event` を消す

### 順序を入れ替えないこと

先に消すと、**まだ集計していない日の観測が集計前に消える**。

型は通る。cron も回る。エラーも出ない。
気づくのは数か月後、「この期間だけ数字が薄い」と誰かが言ったときである。

`reader-metrics-scheduler.ts` の冒頭 doc に理由を書いてある。
順序を触るときに目に入る。

## 止まったことに気づく方法

集計の行は `computed_at` を持つ。

```bash
npx wrangler d1 execute DB --env dev --local --json \
  --command "SELECT site_slug, MAX(computed_at) FROM site_daily_metric GROUP BY site_slug"
```

`computed_at` が 2 日以上動いていなければ、定時起動が止まっている。

**画面には出ない。** 画面は「その日の数字が無い」としか言えず、
「誰も来なかった」と区別がつかない。ここは人が見る。

## やり直し

管理画面（`/admin/sites/<slug>/audience`）の
「集計をやり直す」を押すと、対象の日を作り直す。

- 足し込みではなく**置き換え**なので、二重にならない
- 売上と成約は消えない（読者側と成果側で書き手が違う）
- やり直しは `audit_logs` に `metrics_rollup.rebuilt` として残る

### やり直せる範囲

`ROLLUP_DAYS`（既定 2）日ぶんまで。

**3 日以上止まったぶんは自動では戻らない。**
生イベントが 90 日残っているので手で範囲を広げれば作り直せるが、
既定の窓では拾わない。

`REBUILD_SCAN_LIMIT`（既定 200）を超える組は次の回へ回る。

## 数字が急に減ったとき

見る順序:

1. `computed_at` が動いているか → 止まっていれば定時起動の問題
2. 送信側が落とされていないか → 受け口の `rejected` が増えていないか
3. 同意率が変わっていないか → **これは表から分からない**

3 が分からないのは意図した設計である（`final-review.md` の弱点 2）。
非同意の読者は行を作らないので、
「同意率が下がった」と「読者が減った」を区別できない。

同意の取り方（画面・文言）を変えた日を記録しておくこと。
その日を境に数字が段差になるなら、原因は同意率である。

## 生イベントが積み上がったとき

```bash
npx wrangler d1 execute DB --env dev --local --json \
  --command "SELECT COUNT(*), MIN(occurred_at) FROM reader_interaction_event"
```

`MIN(occurred_at)` が 90 日より古ければ、掃除が回っていない。

1 万 PV/日で 7 万行/日、90 日で 630 万行が目安である
（`migration-notes.md`）。これを大きく超えているなら、
掃除が止まっているか、送信側が想定より多く送っている。

## 表を落とすとき

`reader_interaction_event` を落とす前に、
必ず直近ぶんの集計を先に走らせること。

畳んだ日は `site_daily_metric` に残るが、
**畳む前の日は再現できない**。

## 触ってはいけないもの

| 対象 | 理由 |
|---|---|
| `session_key` への索引 | 条件 4 が禁じたクエリが速くなる（I-4） |
| 集計と掃除の順序 | 上記 |
| `PORT_WIRING_MAX_WRITE_EXCLUSIONS` | 上限を上げて緑にしない（`quality-report.md`） |
