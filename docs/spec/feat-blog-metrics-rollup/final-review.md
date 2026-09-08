# 最終レビュー — 日次集計 (feat-blog-metrics-rollup)

P09 の成果物。実装が終わった状態を、設計と照らして見直した結果。

## アーキテクチャ判断との照合

| 判断 | 内容 | 守れているか |
|---|---|---|
| AD-1 | 一方向依存（住所 → 観測 → 改善 → 提示） | ○ 集計は住所層を参照しない |
| AD-2 | 提示層で計算しない | ○ 率も平均も保存側で確定する |
| AD-3 | 改善層は公開面へ書けない | — 本 feature は改善層に触れない |
| AD-4 | 生イベントは 90 日で捨てる | ○ `RAW_EVENT_RETENTION_DAYS = 90` |
| AD-5 | `site_slug` が唯一の結合キー | ○ 数値 id を跨いで持たない |

## §12.3 の口の分離

表は 1 つ、読み口は 2 つ。

```
site_daily_metric / article_daily_metric
        ├── BlogAudiencePort   （Editorial 印・AudienceDaily）
        └── BlogRevenuePort    （Commercial 印）
```

`AudienceDaily = Omit<DailyMetrics, "revenueMinor">` で、
**型から売上の鍵そのものを落としている**。

型だけだと実行時に値が残りうるので、テストが実際の返り値の鍵を見ている:

> audience の行は revenueMinor という鍵を持たない

これが無いと、`Omit<>` を通しただけで中身がそのまま流れる実装が通る。

## 残っている弱点

### 1. `sample_count` の 0 が二義的

migration 0045 より前に作られた集計行の `sample_count` は 0 だが、
それは「観測が 0 件だった」ではなく「列が無かった」を意味する。
区別できない。

影響は「示唆が出ない」だけで、数字が壊れるわけではない。
再集計すれば直る。`migration-notes.md` に書いた。

### 2. `clicks_by_element` の合計が `clicks` に届かない

`element_key` を振っていない場所のクリックは要素別の内訳から落ちる。

```
Σ clicks_by_element の値  ≤  clicks
```

これは設計どおりだが、**画面がこの差を説明しない**と
運営者は「数が合わない」と読む。提示層の責務として引き渡した。

### 3. 集計の失敗が次の回で自動的に拾われるとは限らない

`pendingDays()` は生イベントの側から数え上げるので、
失敗した日は次の回にもう一度対象になる。**ただし窓は 2 日**
（`ROLLUP_DAYS = 2`）なので、3 日以上続けて失敗すると自動では戻らない。

手で「この日をやり直す」を押す必要がある。
`operations-runbook.md` に書いた。

窓を広げれば自動で戻るが、毎回の実行が重くなる。
2 日は「UTC 17 時実行で日本時間の日付境界を跨ぐ」ぶんの余裕であり、
障害復旧のための余裕ではない。ここは意図して分けてある。

### 4. `REBUILD_SCAN_LIMIT = 200` を超えた記事は 1 回で終わらない

やり直しは 1 日ぶんを 200 件まで処理する。それを超えるブログでは
1 回押しただけでは終わらない。件数は返るので、
運営者は「まだ残っている」ことは分かる。

## 品質ゲート

`quality-report.md` のとおり、`port-wiring.mjs` が赤のまま。
上限を上げていない。判断待ち。

## この feature が引き渡すもの

| 引き渡し先 | 内容 |
|---|---|
| feat-reader-behavior-analytics | 生イベントの受け口と語彙 |
| feat-blog-scoped-admin-console | 2 系統の読み口と `computed_at` |
| feat-affiliate-hub | `revenue_minor` / `conversions` の書き込み先（触らない約束） |
