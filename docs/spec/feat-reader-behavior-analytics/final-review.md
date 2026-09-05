# 最終確認 — 読者行動の観測 (feat-reader-behavior-analytics)

P12 の成果物。

## 4 層の取り決めとの照合

正本は `architecture/arch-blog-operations-console.md`。

| 取り決め | 判定 | 根拠 |
|---|---|---|
| AD-1 一方向依存（住所 → 観測 → 改善 → 提示） | **守っている** | 観測層は住所層の `site_slug` だけを見る。改善層・提示層を知らない |
| AD-2 提示層で計算しない | **守っている** | 到達率も平均滞在も読み口が返す。画面は描くだけ |
| AD-3 改善層は公開面へ書けない | 該当なし | 本 feature は改善層を持たない |
| AD-4 生イベントは 90 日で捨てる | **守っている** | `retentionDeadline` + `purgeExpiredEvents` |
| AD-5 `site_slug` が唯一の結合キー | **守っている** | 表に site id を持たない |

## §12.3 の口の分離

| 口 | 印 | 返すもの |
|---|---|---|
| `BlogAudiencePort` | `Editorial` | `AudienceDaily = Omit<DailyMetrics, "revenueMinor">` |
| `BlogRevenuePort` | `Commercial` | 金額を含む |

表は 1 つ、読み口は 2 つ。
読者行動の画面は `Editorial` の口しか呼ばないので、
**金額へ触ろうとすると型で落ちる**。

d1 の 7「audience の行は revenueMinor という鍵を持たない」と
blog-metrics-pages の 7「数字が並んだ状態でも、円の表記が 1 つも出ない」で
両側から固定している。

## 残る弱点

### 1. 実ブラウザでの到達率が未検証

jsdom は `scrollHeight` / `innerHeight` を実測しない。
刻みの判定ロジックは確かめているが、
**実レイアウトで正しい値が取れるかは確かめていない**。

固定ヘッダや遅延読み込みの画像があると、
読んでいる最中に `scrollHeight` が伸びる。
そのとき刻みの位置がずれる。

### 2. `session_key` が無い読者が数えられない

同意が無ければ行を作らないので、
**非同意の読者が何人いるかは分からない**。

「同意率が下がったので数字が減った」のか
「読者が減った」のかを、この表からは区別できない。

意図した設計だが、数字の解釈に影響する。

### 3. 再送しない

`flush()` は失敗しても再送しない。
ネットワークが切れた瞬間の観測は落ちる。

再送を入れると、繋がった時点でまとめて届き、
**発生時刻が古すぎて受信時刻へ寄せられる**（`ingest-contract.md`）。
日をまたぐと別の日に計上される。

落とすほうが数字の意味が保たれると判断した。

### 4. 90 日以内の請求に応えられない

`subject-request-design.md` の通り、請求の受け口を持たない。

法域によってはこの整理が通らない可能性がある。
**判断が要る点であり、実装側では決められない。**

### 5. port-wiring が赤のまま

理由つき除外が上限を 1 件超えている。
上限は上げていない。`quality-report.md`。

## 変更した仕様

| 仕様 | 実装 | 理由 |
|---|---|---|
| `x_ratio` + `y_ratio` | `position_ratio`（縦のみ） | F-02 |
| `pointer_sample` | 作らない | F-03 |
| canvas 重ね描画 | `BarChart` + `DataTable` | F-02 の結果 |
| `reader_key` を null で保存 | 行を作らない | F-04 |
| 条件 9（本人の請求） | 受け口を持たない | F-01 |
| 表・列の名前 | 単数形・`session_key` / `viewport_band` / `element_key` | 既存の命名に合わせた |

**仕様書との差分は 6 点ある。** いずれも
`design-review-findings.md` に指摘として残し、
`acceptance-report.md` で判定している。
黙って変えた箇所は無い。
