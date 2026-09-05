# 運用手順 — 日次集計 (feat-blog-metrics-rollup)

P12 の成果物。動かし続けるために、誰が何を見て何をするか。

## 毎日起きること

Cloudflare の cron が UTC 17 時に `scheduled` を呼ぶ。
順序は**固定**である。

1. `pendingDays()` — 生イベントの側から (ブログ, 日) の組を数え上げる（最大 200 件）
2. `rollupDay()` — 組ごとに集計して upsert
3. `purgeExpiredEvents()` — 90 日より古い生イベントを消す

**この順序を逆にしてはいけない。** 先に消すと、まだ集計していない日の
観測が集計前に消える。型は通るし cron も回るので、
**壊れたことに気づくのは数か月後**になる。
理由は `reader-metrics-scheduler.ts` の冒頭 doc に書いてある。

## 止まったことに気づく方法

集計行は `computed_at` を持ち、画面がそれを出す。

| 見えるもの | 意味 |
|---|---|
| `computed_at` が今日 | 動いている |
| `computed_at` が数日前で止まっている | cron が止まっている |
| 行そのものが無い | まだ集計していない、または観測が 0 件 |

**数字が出ないことと、人が来ていないことは違う。**
`missing-data-policy.md` がこの区別を設計として書いている。

## 集計をやり直す

画面: `/admin/sites/[site]/audience` の「この日をやり直す」

- **1 回につき 1 日**。範囲指定は無い（`design-review-findings.md` F-09）
- やり直せるのは今日から 90 日前まで。それより前は断られる
- `site.manage` の権限が要る。分析担当（analyst）は押せない
- 1 日ぶん 200 件まで。超えたら押し直す

### やり直しても消えないもの

`revenue_minor` と `conversions` は上書きされない。
これは報酬側が別経路で書いた値で、生イベントから作れない。

upsert の `set` からこの 2 列を外してある。
**この 2 行を消すと売上が毎日消える**ので、コード内にコメントで理由が置いてある。

### やり直したことは記録に残る

1 回押すと `audit_logs` に 1 行:

```
action:     metrics_rollup.rebuilt
targetType: site_daily_metric
targetId:   <site_slug>/<day>
after:      { day, rebuilt, failed }
```

読者の観測そのものは記録されない（1 人が 1 記事を読むだけで数十件届き、
承認や公開の行が埋もれるため）。残るのは人が押した回だけ。

## 3 日以上続けて失敗したとき

自動では戻らない。`pendingDays()` の窓は 2 日だけである。

窓の外へ出た日は、画面から日ごとに手でやり直す。
90 日を過ぎると生イベントが無いので、もう作り直せない。

**つまり障害は 90 日以内に気づく必要がある。**
`computed_at` を毎週見るのが実質的な下限。

## 集計表を作り直したくなったとき

**表を落とさない。** `revenue_minor` と `conversions` が失われる。

行を残したまま日ごとにやり直す（upsert なので上書きされ、
売上と成果はそのまま残る）。

## 手元で確かめる

```bash
pnpm db:migrate:local
pnpm seed:local
pnpm dev
```

中を見る:

```bash
npx wrangler d1 execute DB --env dev --local \
  --command "select site_slug, day, views, sample_count, computed_at from site_daily_metric order by day desc limit 10" --json
```

見本データには 2 ブログ × 14 日ぶんが入っている
（`home-office-desk` / `compact-kitchen-gear`）。
