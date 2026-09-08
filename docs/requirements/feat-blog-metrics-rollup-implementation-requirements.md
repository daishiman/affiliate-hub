# 実装要件定義書: feat-blog-metrics-rollup

> 本書は dev-graph `requirements` verb が、確定済み system spec、feature 文書、昇格済み exact-13 package から導出した実装要件である。実装コードは含まない。実装は `task-graph` build へ handoff する。

## スナップショット

- graph snapshot digest: `sha256:f2da12b065505697edafd0031dfd6d39001b2a702fb2e70f9c3704a1781bac6c`
- graph revision: `481`
- scope digest: `sha256:af2550468a0b74b5be0ec4d9431bb92087b05f4254fb8a5d9e8e2d76a4e34bae`
- feature package: `feature-package/feat-blog-metrics-rollup`
- promoted generation digest: `sha256:f38e68c7d023f98268db47f1238dbd88ddbfe496d94d6eab5996b57f4775c2c0`
- promoted generation path: `.dev-graph/published/generations/feature-package-feat-blog-metrics-rollup/f38e68c7d023f98268db47f1238dbd88ddbfe496d94d6eab5996b57f4775c2c0`
- handoff target: `task-graph`
- quality choice: `detailed`
- emitted_at: `2026-09-04T00:00:00Z`

## この feature の位置

観測層の集約。収益・PV・読者行動を同じブログ/記事の軸で 1 日単位に束ね、同じ日を何度処理しても同じ結果になる冪等な指標を置く。

- 目的: 収益・PV・読者行動を同じブログ/記事の軸で 1 日単位に束ね、運営判断に使える形の指標を一箇所に置く
- 到達状態: site_daily_metrics と article_daily_metrics が日次で生成され、同じ日を何度処理しても当日ぶんを丸ごと置き換えて同じ結果になり、記事ごとの売上・PV・滞在・到達・クリック率がブログ単位で合算できる状態になっている

## 実装範囲

- site_daily_metrics / article_daily_metrics テーブル (日付 × site_slug (× article_slug) を一意軸とする)
- rollup-daily-metrics ユースケース: 対象日の生データを読み、当日ぶんを丸ごと置き換える冪等な集計
- 記事ごとのトータル売上と PV、およびブログ単位での合算
- 滞在・スクロール到達・要素クリック率を記事指標として同じ行へ載せる
- 定時実行の配線と、失敗時に対象日を指定して再実行できる入口
- 件数が少なすぎる日を「示唆に足りない」と機械的に判定できる件数列

## 範囲外

- 生イベントの計測そのもの (feat-reader-behavior-analytics)
- 報酬・成果の取り込み経路 (feat-affiliate-hub)
- 指標の画面表示と提示順序 (feat-blog-scoped-admin-console)
- 示唆エンジンのモデル (feat-analytics-insight)

範囲外の項目は「やらない」ではなく「ここではやらない」を意味する。括弧内の feature が正本を持つ。

## 上流依存とアーキテクチャ文脈

| 種別 | node | 役割 |
|---|---|---|
| feature depends_on | `feat-reader-behavior-analytics` | 先に成立していることを前提にする |
| feature depends_on | `feat-affiliate-hub` | 先に成立していることを前提にする |
| feature depends_on | `feat-analytics-insight` | 先に成立していることを前提にする |
| architecture_refs | `arch-system-spec-overview` | 境界と依存の向きの正本。本書は内容を複製せず参照する |
| architecture_refs | `arch-two-layer-platform` | 境界と依存の向きの正本。本書は内容を複製せず参照する |
| architecture_refs | `arch-blog-operations-console` | 境界と依存の向きの正本。本書は内容を複製せず参照する |

`arch-blog-operations-console` が固定する 4 層 (住所・観測・改善・提示) の一方向依存と、`site_slug` を唯一の結合キーとする規約は、本 feature の全 phase の前提である。

## 受入条件トレーサビリティ

| ID | 受入条件 | confirmed source | 主 phase |
|---|---|---|---|
| A1 | 同じ日を二度ロールアップしても行数と値が変わらない | features/feat-blog-metrics-rollup.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P09,P11 |
| A2 | 日付 × site_slug (× article_slug) に一意制約があり、同日重複行が作れない | features/feat-blog-metrics-rollup.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P02,P04,P05,P06,P07,P11 |
| A3 | 記事の売上合計がブログの売上合計と一致する | features/feat-blog-metrics-rollup.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A4 | 記事の PV 合計がブログの PV 合計と一致する | features/feat-blog-metrics-rollup.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A5 | 生イベントが 90 日で消えた後もロールアップ済みの日は残る | features/feat-blog-metrics-rollup.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A6 | 対象日を指定した再実行で、その日だけが置き換わり他の日が変わらない | features/feat-blog-metrics-rollup.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A7 | 集計元の件数が閾値未満の日に、示唆に足りないことを示す列が立つ | features/feat-blog-metrics-rollup.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P02,P04,P05,P06,P07,P11 |
| A8 | ロールアップが失敗しても部分的に書かれた日が残らない | features/feat-blog-metrics-rollup.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P09,P11 |
| A9 | 日次実行が定時に起動し、失敗が運用側から見える | features/feat-blog-metrics-rollup.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P09,P11 |

phase 対応は `.dev-graph/handoff/requirements-trace-feat-blog-metrics-rollup.json` の `derivation_rule` に記した決定論規則で導出しており、`trace_plan_digest` で固定されている。

## 実行タスク (exact 13)

| phase | graph node | 内容 | depends_on |
|---|---|---|---|
| P01 | `SYS-BLOG-METRICS-ROLLUP-P01` | 日次ロールアップの要求ベースライン確定 | — |
| P02 | `SYS-BLOG-METRICS-ROLLUP-P02` | 日次指標テーブルと冪等集計の契約確定 | P01 |
| P03 | `SYS-BLOG-METRICS-ROLLUP-P03` | 集計設計の独立レビューと着手可否判定 | P02 |
| P04 | `SYS-BLOG-METRICS-ROLLUP-P04` | 日次ロールアップの受入テスト設計 | P03 |
| P05 | `SYS-BLOG-METRICS-ROLLUP-P05` | 日次ロールアップ処理の実装 | P04 |
| P06 | `SYS-BLOG-METRICS-ROLLUP-P06` | 日次ロールアップのテスト実行と緑化 | P05 |
| P07 | `SYS-BLOG-METRICS-ROLLUP-P07` | 日次ロールアップの受入9件の判定 | P06 |
| P08 | `SYS-BLOG-METRICS-ROLLUP-P08` | 既存集計経路との重複解消と移行 | P05 |
| P09 | `SYS-BLOG-METRICS-ROLLUP-P09` | 日次ロールアップの非機能検査 | P08 |
| P10 | `SYS-BLOG-METRICS-ROLLUP-P10` | 日次ロールアップの最終レビュー | P09 |
| P11 | `SYS-BLOG-METRICS-ROLLUP-P11` | 日次ロールアップの証跡集約 | P07, P09 |
| P12 | `SYS-BLOG-METRICS-ROLLUP-P12` | 日次ロールアップの運用手順と数値定義の説明 | P10, P11 |
| P13 | `SYS-BLOG-METRICS-ROLLUP-P13` | 日次ロールアップのリリースと仕様書への書き戻し | P12 |

DAG は feature 内で閉じている。cross-feature edge は 0 件であり、feature 間の順序は graph の `depends_on` が持つ。

## readiness matrix

| node scope | confirmation | evaluation | implementation readiness | missing sections |
|---|---|---|---|---|
| `feat-blog-metrics-rollup` | confirmed | pass | complete | なし |
| `arch-system-spec-overview` | confirmed | pass | complete | なし |
| `arch-two-layer-platform` | confirmed | pass | complete | なし |
| `arch-blog-operations-console` | confirmed | pass | complete | なし |
| `SYS-BLOG-METRICS-ROLLUP-P01..P13` | confirmed | pass | complete | なし |

closure 17 node すべてが同一 graph snapshot 上で三 gate を通過している。`implementation_readiness=complete` は実行可能な仕様が揃ったことを示し、実装完了を示さない。完了は graph の `completion_evidence` と P07/P10/P11 の証跡で判定する。

## task-graph build への制約

- 実装前に、このリポジトリの `node_modules/next/dist/docs/` で対象 API の Next.js 16 現行ガイドを読む。訓練データの Next.js とは異なる。
- 既存の blog-ops、affiliate、auth、D1/Drizzle、Cloudflare Workers/OpenNext の境界を維持し、同じ責務の use case / store を増やさない。
- P04 のテストを先に定義し、pixel 位置や DOM 構造ではなく、可視ラベル、accessible name、状態、API 契約、永続化結果で検証する。
- 4 層の禁止依存 (観測層→改善層の直接呼び出し、改善層→公開面の直接書き込み、提示層での再集計、`site_slug` 以外のブログ識別子の定義) を実装で破らない。
- 本番公開、外部サービス契約変更、破壊的移行は別の明示承認がない限り行わない。
- 本書と handoff package は実装コードではない。各 task の write_scope と Verification and evidence を実装 authority とする。

## handoff

- target: `task-graph`
- handoff package: `.dev-graph/handoff/task-graph/feat-blog-metrics-rollup.json`
- readiness: `.dev-graph/handoff/requirements-readiness-feat-blog-metrics-rollup.json`
- scope: `.dev-graph/handoff/requirements-scope-feat-blog-metrics-rollup.json`
- trace: `.dev-graph/handoff/requirements-trace-feat-blog-metrics-rollup.json`
- implementation code generated by this verb: `0`
