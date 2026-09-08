# 実装要件定義書: feat-reader-behavior-analytics

> 本書は dev-graph `requirements` verb が、確定済み system spec、feature 文書、昇格済み exact-13 package から導出した実装要件である。実装コードは含まない。実装は `task-graph` build へ handoff する。

## スナップショット

- graph snapshot digest: `sha256:f2da12b065505697edafd0031dfd6d39001b2a702fb2e70f9c3704a1781bac6c`
- graph revision: `481`
- scope digest: `sha256:b1eabe6b2fe4e44315c32af05163649c44fdf9d0374ef9499acbbbf799d3d0af`
- feature package: `feature-package/feat-reader-behavior-analytics`
- promoted generation digest: `sha256:0991946d448ede0701275e1fb4f83325d708cc03cc042b4c54eb80964782f1d0`
- promoted generation path: `.dev-graph/published/generations/feature-package-feat-reader-behavior-analytics/0991946d448ede0701275e1fb4f83325d708cc03cc042b4c54eb80964782f1d0`
- handoff target: `task-graph`
- quality choice: `detailed`
- emitted_at: `2026-09-04T00:00:00Z`

## この feature の位置

観測層の入口。読者がどこで時間を使い、どこを押したかを、個人へ戻せない要素相対比率の分布として記録する。

- 目的: 読者が記事のどこで時間を使い、どこを押しているのかを、個人を追跡せずに分布として観測できるようにする
- 到達状態: 読者面が滞在・スクロール到達・要素クリック・ポインタ標本を要素相対比率で束ねて送り、reader_interaction_events へ追記され、管理画面が viewport_bucket ごとの集計分布としてヒートマップを描き、同意が無い読者は reader_key を持たず 90 日で生データが消える状態になっている

## 実装範囲

- reader_interaction_events テーブル (workspace_id / site_slug / article_slug / occurred_at / reader_key nullable / kind scroll_depth|dwell|element_click|pointer_sample / viewport_bucket / element_ref / x_ratio / y_ratio / value)
- 読者面の計測: IntersectionObserver によるスクロール到達、visibilitychange + 滞在タイマーによる dwell、委譲した単一 click リスナ、間隔標本のポインタ位置
- 座標は要素相対比率 (element_ref + x_ratio/y_ratio) で記録し、絶対座標を残さない
- sendBeacon による束ね送信と、ingest-reader-interactions の追記専用受入 (バッチ・重複耐性)
- 同意が無い場合 reader_key を null にし、読者個人へ戻せる列を持たない
- 管理画面の記事プレビュー上への canvas 重ね描画と viewport_bucket (narrow/medium/wide) 切替
- reader_interaction_events の 90 日削除と、reader_key 指定での抽出・削除 (Owner 限定)

## 範囲外

- 1 読者の行動を時系列で再生する機能 (作らない)
- 日次ロールアップと収益・PV との突合 (feat-blog-metrics-rollup)
- 行動指標を使った示唆生成と提示順序 (feat-blog-scoped-admin-console)
- 既存の汎用イベント/KPI 基盤そのもの (feat-analytics-insight)

範囲外の項目は「やらない」ではなく「ここではやらない」を意味する。括弧内の feature が正本を持つ。

## 上流依存とアーキテクチャ文脈

| 種別 | node | 役割 |
|---|---|---|
| feature depends_on | `feat-reader-surface` | 先に成立していることを前提にする |
| feature depends_on | `feat-data-model` | 先に成立していることを前提にする |
| feature depends_on | `feat-analytics-insight` | 先に成立していることを前提にする |
| architecture_refs | `arch-system-spec-overview` | 境界と依存の向きの正本。本書は内容を複製せず参照する |
| architecture_refs | `arch-two-layer-platform` | 境界と依存の向きの正本。本書は内容を複製せず参照する |
| architecture_refs | `arch-blog-operations-console` | 境界と依存の向きの正本。本書は内容を複製せず参照する |

`arch-blog-operations-console` が固定する 4 層 (住所・観測・改善・提示) の一方向依存と、`site_slug` を唯一の結合キーとする規約は、本 feature の全 phase の前提である。

## 受入条件トレーサビリティ

| ID | 受入条件 | confirmed source | 主 phase |
|---|---|---|---|
| A1 | 同意が無い読者の行から reader_key が常に null で、個人へ戻せる列が他に無い | features/feat-reader-behavior-analytics.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P02,P04,P05,P06,P07,P11 |
| A2 | 保存される位置が element_ref + x_ratio/y_ratio の比率で、絶対座標の列が存在しない | features/feat-reader-behavior-analytics.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P02,P04,P05,P06,P07,P11 |
| A3 | ポインタは全軌跡ではなくクリックと間隔標本だけが記録される | features/feat-reader-behavior-analytics.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A4 | ヒートマップが常に集計分布として描かれ、単一 reader_key の再生経路が UI にもクエリにも存在しない | features/feat-reader-behavior-analytics.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A5 | viewport_bucket を切り替えると同じ記事で別の分布が描かれる | features/feat-reader-behavior-analytics.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A6 | ページ離脱時にも計測が欠落せず sendBeacon で送出される | features/feat-reader-behavior-analytics.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P11 |
| A7 | 同じバッチを二度受け取っても件数が二重にならない | features/feat-reader-behavior-analytics.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P09,P11 |
| A8 | reader_interaction_events が 90 日を超えると削除され、集計側は残る | features/feat-reader-behavior-analytics.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P09,P11 |
| A9 | reader_key を指定した抽出・削除が Owner だけで実行でき、audit_logs に残る | features/feat-reader-behavior-analytics.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P09,P11 |
| A10 | 計測 script の失敗が読者面の描画を壊さない | features/feat-reader-behavior-analytics.md#acceptance / arch-system-spec-overview・arch-two-layer-platform・arch-blog-operations-console | P01,P04,P05,P06,P07,P09,P11 |

phase 対応は `.dev-graph/handoff/requirements-trace-feat-reader-behavior-analytics.json` の `derivation_rule` に記した決定論規則で導出しており、`trace_plan_digest` で固定されている。

## 実行タスク (exact 13)

| phase | graph node | 内容 | depends_on |
|---|---|---|---|
| P01 | `SYS-READER-BEHAVIOR-ANALYTICS-P01` | 読者行動計測の要求ベースライン確定 | — |
| P02 | `SYS-READER-BEHAVIOR-ANALYTICS-P02` | reader_interaction_events のデータモデルと計測契約の確定 | P01 |
| P03 | `SYS-READER-BEHAVIOR-ANALYTICS-P03` | 読者行動計測設計の独立レビューと着手可否判定 | P02 |
| P04 | `SYS-READER-BEHAVIOR-ANALYTICS-P04` | 読者行動計測の受入テスト設計 | P03 |
| P05 | `SYS-READER-BEHAVIOR-ANALYTICS-P05` | 読者行動計測とヒートマップの実装 | P04 |
| P06 | `SYS-READER-BEHAVIOR-ANALYTICS-P06` | 読者行動計測のテスト実行と緑化 | P05 |
| P07 | `SYS-READER-BEHAVIOR-ANALYTICS-P07` | 読者行動計測の受入10件の判定 | P06 |
| P08 | `SYS-READER-BEHAVIOR-ANALYTICS-P08` | 既存イベント基盤との重複解消と移行 | P05 |
| P09 | `SYS-READER-BEHAVIOR-ANALYTICS-P09` | 読者行動計測の非機能検査 | P08 |
| P10 | `SYS-READER-BEHAVIOR-ANALYTICS-P10` | 読者行動計測の最終レビュー | P09 |
| P11 | `SYS-READER-BEHAVIOR-ANALYTICS-P11` | 読者行動計測の証跡集約 | P07, P09 |
| P12 | `SYS-READER-BEHAVIOR-ANALYTICS-P12` | 読者行動計測の運用手順と説明 | P10, P11 |
| P13 | `SYS-READER-BEHAVIOR-ANALYTICS-P13` | 読者行動計測のリリースと仕様書への書き戻し | P12 |

DAG は feature 内で閉じている。cross-feature edge は 0 件であり、feature 間の順序は graph の `depends_on` が持つ。

## readiness matrix

| node scope | confirmation | evaluation | implementation readiness | missing sections |
|---|---|---|---|---|
| `feat-reader-behavior-analytics` | confirmed | pass | complete | なし |
| `arch-system-spec-overview` | confirmed | pass | complete | なし |
| `arch-two-layer-platform` | confirmed | pass | complete | なし |
| `arch-blog-operations-console` | confirmed | pass | complete | なし |
| `SYS-READER-BEHAVIOR-ANALYTICS-P01..P13` | confirmed | pass | complete | なし |

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
- handoff package: `.dev-graph/handoff/task-graph/feat-reader-behavior-analytics.json`
- readiness: `.dev-graph/handoff/requirements-readiness-feat-reader-behavior-analytics.json`
- scope: `.dev-graph/handoff/requirements-scope-feat-reader-behavior-analytics.json`
- trace: `.dev-graph/handoff/requirements-trace-feat-reader-behavior-analytics.json`
- implementation code generated by this verb: `0`
