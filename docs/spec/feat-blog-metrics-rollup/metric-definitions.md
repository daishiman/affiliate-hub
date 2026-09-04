# 指標の定義 — 日次集計 (feat-blog-metrics-rollup)

P01 の成果物。**数字の意味はここが正本。**画面・示唆・レポートは、
この定義を再解釈せずそのまま読む（AD-2）。

正本の型は `src/domain/analytics/reader-interaction.ts` の `DailyMetrics`。

## 列ごとの定義

| 列 | 意味 | 元になる観測 | 単位 |
|---|---|---|---|
| `day` | 集計の対象日。UTC の暦日 | — | `YYYY-MM-DD` |
| `views` | 表示回数 | `kind = "view"` の件数 | 回 |
| `uniqueSessions` | 見に来た読者の延べ人数 | `session_key` の異なり数 | 人 |
| `clicks` | 押された回数 | `kind = "click"` の件数 | 回 |
| `conversions` | 成果につながった回数 | 報酬側から取り込む | 回 |
| `revenueMinor` | 売上 | 報酬側から取り込む | **最小通貨単位（円）の整数** |
| `averageDwellSeconds` | 平均滞在秒数 | `dwell_seconds` の平均 | 秒 |
| `averageScrollRatio` | 平均到達率 | `position_ratio` の平均 | 0..1 |
| `sampleCount` | この行を作った観測の件数 | 全 `kind` の件数 | 件 |

## 決めておく必要のあった 5 点

### 1. 売上は整数の最小通貨単位で持つ

`revenueMinor` は円の整数。小数（`REAL`）で持つと、365 日ぶんを足した
ときに末尾が合わなくなる。運営者が「記事ごとの合計」と「ブログの合計」を
別々の画面で見比べたとき、1 円ずれるだけで数字全体が信用されなくなる。

> 仕様書の初稿は `revenue_cents` という名前だった。実装は `revenue_minor`。
> 「cent」は通貨を 100 分割する前提を名前に埋め込んでしまい、円のように
> 分割しない通貨で意味が壊れる。名前を変えた理由はこれで、値の意味は同じ。

### 2. `sampleCount` は平均や率の分母ではない

`averageDwellSeconds` の分母は「滞在の観測件数」であって `sampleCount` ではない。
`sampleCount` が持つのは**この行を信じてよいかの判断材料**だけである。

`views` で代用できない理由は実装の doc にある通りで、滞在も読み進みも
表示以外の種類のイベントから出るため、表示が少なくても滞在の標本は
足りることがあり、その逆もある。

### 3. 0 除算は `null` ではなく 0 を返す

`clickThroughRate` / `revenuePerView` は `views === 0` のとき 0 を返す。
`null` を混ぜると、表の並べ替えで「まだ誰も見ていない記事」が
最上位にも最下位にも来うる（比較演算子の実装依存になる）。

### 4. 示唆の足切りは 30 件

`MIN_EVIDENCE_SAMPLES = 30`。厳密な検定の閾値ではなく足切りである。
判定は `evidenceVerdict()` が行い、**数字そのものは足りなくても出す。
伏せるのは解釈の側だけ。** 数字ごと隠すと、運営者は「観測が動いていない」
のか「まだ少ない」のかを区別できず、計測の故障に気づけなくなる。

### 5. 位置は比率で持つ

`position_ratio` は 0..1 の実数。画素で持つと、画面幅の違う観測どうしを
足せない。区間の分割数は保存側が決め、`EngagementProfile.buckets` として返す。

## 合算の恒等式（受入条件 3・4）

**成り立つ関係:**

```
Σ_articles article_daily_metric.views        ≤ site_daily_metric.views
Σ_articles article_daily_metric.revenue_minor ≤ site_daily_metric.revenue_minor
```

**等号にならない場合がある。** `article_slug` が `null` の観測が存在するためで、
これは記事に紐づかない閲覧（トップ、一覧、タグページ）を指す。
そうした閲覧は `site_daily_metric` にだけ乗る。

等号を作ろうとすれば、記事外の閲覧をどれかの記事へ割り当てることになる。
それは「読まれていない記事が読まれたことになる」ので、数字として嘘になる。
**不等号のままにする**というのが本 feature の判断である。

画面がこの差をどう出すかは提示層（feat-blog-scoped-admin-console）が決める。
観測層としては、差が出ること自体を隠さない。

## 記事の指標をブログの行に載せない理由

`article_daily_metric` は `site_daily_metric` の列に加えて `article_slug` と
`clicks_by_element`（要素別クリック数の JSON）を持つ。要素別を記事側にだけ
置くのは、要素の集合が記事ごとに違うためで、ブログ単位で足すと
「どの記事のどのボタンか」が失われた無意味な合計になる。

## 編集判断へ渡してよい範囲（§12.3）

`AudienceDaily = Omit<DailyMetrics, "revenueMinor">`。

売上列を落とした型を `BlogAudiencePort`（`Editorial` 印）が返す。
ランキング・記事評価・改善提案はこの口しか受け取らないので、
**売上で並べ替える実装が書けない**（型で落ちる）。
売上を含む `BlogRevenuePort` には `Commercial` 印が付く。
