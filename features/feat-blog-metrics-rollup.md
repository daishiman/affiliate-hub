---
graph_node_id: "feat-blog-metrics-rollup"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "backend"
tags: ["metrics","rollup","revenue","pageview","idempotent","daily"]
priority: "high"
start_date: "2026-09-04"
target_date: null
iteration: null
title: "ブログ・記事の日次指標ロールアップ"
owners: ["daishiman"]
created_at: "2026-09-04T00:00:00Z"
updated_at: "2026-09-04T02:28:49.037614Z"
status: "active"
depends_on: ["feat-reader-behavior-analytics","feat-affiliate-hub","feat-analytics-insight"]
related_nodes: ["spec-system-spec-index","feat-blog-scoped-admin-console"]
resource_scope: ["src/db/schema.ts","src/domain/analytics/daily-metrics.ts","src/application/analytics/rollup-daily-metrics.ts","src/infrastructure/scheduled/rollup.ts","system-spec","features/feat-blog-metrics-rollup.context.json"]
purpose: "収益・PV・読者行動を同じブログ/記事の軸で 1 日単位に束ね、運営判断に使える形の指標を一箇所に置く"
goal: "site_daily_metrics と article_daily_metrics が日次で生成され、同じ日を何度処理しても当日ぶんを丸ごと置き換えて同じ結果になり、記事ごとの売上・PV・滞在・到達・クリック率がブログ単位で合算できる状態になっている"
scope_in: ["site_daily_metrics / article_daily_metrics テーブル (日付 × site_slug (× article_slug) を一意軸とする)","rollup-daily-metrics ユースケース: 対象日の生データを読み、当日ぶんを丸ごと置き換える冪等な集計","記事ごとのトータル売上と PV、およびブログ単位での合算","滞在・スクロール到達・要素クリック率を記事指標として同じ行へ載せる","定時実行の配線と、失敗時に対象日を指定して再実行できる入口","件数が少なすぎる日を「示唆に足りない」と機械的に判定できる件数列"]
scope_out: ["生イベントの計測そのもの (feat-reader-behavior-analytics)","報酬・成果の取り込み経路 (feat-affiliate-hub)","指標の画面表示と提示順序 (feat-blog-scoped-admin-console)","示唆エンジンのモデル (feat-analytics-insight)"]
acceptance: ["同じ日を二度ロールアップしても行数と値が変わらない","日付 × site_slug (× article_slug) に一意制約があり、同日重複行が作れない","記事の売上合計がブログの売上合計と一致する","記事の PV 合計がブログの PV 合計と一致する","生イベントが 90 日で消えた後もロールアップ済みの日は残る","対象日を指定した再実行で、その日だけが置き換わり他の日が変わらない","集計元の件数が閾値未満の日に、示唆に足りないことを示す列が立つ","ロールアップが失敗しても部分的に書かれた日が残らない","日次実行が定時に起動し、失敗が運用側から見える"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform","arch-blog-operations-console"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-blog-metrics-rollup.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"f38e68c7d023f98268db47f1238dbd88ddbfe496d94d6eab5996b57f4775c2c0","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-blog-metrics-rollup/f38e68c7d023f98268db47f1238dbd88ddbfe496d94d6eab5996b57f4775c2c0/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-04T00:00:00Z","origin_kind":"generated","source_digest":"bfd54655ae9a9f448eca91fcd6f57a9a30520bf4632c5f709f4ca504130cff7e","source_path":"system-spec/index.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "確定質疑 qa-database-web-domain-aeo-behavior / qa-backend-web-domain-aeo-behavior / qa-uiux-web-blog-scoped-admin を lineage 参照。利用者要望『トータルでどの記事がどれくらいの売上を出しているか、記事ごとのPV、その他ブログを管理する上で必要な情報』への対応"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-blog-metrics-rollup.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-q4dt","github_mirror":null,"linked_at":"2026-09-04T02:07:37Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T00:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

収益・PV・読者行動を同じブログ/記事の軸で 1 日単位に束ね、運営判断に使える形の指標を一箇所に置く

## 到達状態

site_daily_metrics と article_daily_metrics が日次で生成され、同じ日を何度処理しても当日ぶんを丸ごと置き換えて同じ結果になり、記事ごとの売上・PV・滞在・到達・クリック率がブログ単位で合算できる状態になっている

## スコープ

スコープ内:

- site_daily_metrics / article_daily_metrics テーブル (日付 × site_slug (× article_slug) を一意軸とする)
- rollup-daily-metrics ユースケース: 対象日の生データを読み、当日ぶんを丸ごと置き換える冪等な集計
- 記事ごとのトータル売上と PV、およびブログ単位での合算
- 滞在・スクロール到達・要素クリック率を記事指標として同じ行へ載せる
- 定時実行の配線と、失敗時に対象日を指定して再実行できる入口
- 件数が少なすぎる日を「示唆に足りない」と機械的に判定できる件数列

スコープ外:

- 生イベントの計測そのもの (feat-reader-behavior-analytics)
- 報酬・成果の取り込み経路 (feat-affiliate-hub)
- 指標の画面表示と提示順序 (feat-blog-scoped-admin-console)
- 示唆エンジンのモデル (feat-analytics-insight)

## 受入

- [ ] 同じ日を二度ロールアップしても行数と値が変わらない
- [ ] 日付 × site_slug (× article_slug) に一意制約があり、同日重複行が作れない
- [ ] 記事の売上合計がブログの売上合計と一致する
- [ ] 記事の PV 合計がブログの PV 合計と一致する
- [ ] 生イベントが 90 日で消えた後もロールアップ済みの日は残る
- [ ] 対象日を指定した再実行で、その日だけが置き換わり他の日が変わらない
- [ ] 集計元の件数が閾値未満の日に、示唆に足りないことを示す列が立つ
- [ ] ロールアップが失敗しても部分的に書かれた日が残らない
- [ ] 日次実行が定時に起動し、失敗が運用側から見える

## アーキテクチャ参照

- `architecture_refs`: `arch-system-spec-overview`
- `architecture_refs`: `arch-two-layer-platform`
- `architecture_refs`: `arch-blog-operations-console`
- 関連ノード: `spec-system-spec-index`、`feat-blog-scoped-admin-console`

## 機能間依存

- `depends_on`: `feat-reader-behavior-analytics`
- `depends_on`: `feat-affiliate-hub`
- `depends_on`: `feat-analytics-insight`
- 依存理由: 行動生データ (feat-reader-behavior-analytics)、成果・報酬の出所 (feat-affiliate-hub)、既存の指標定義と集計基盤 (feat-analytics-insight) が揃ってはじめて同じ site_slug/article_slug で突合できる。

## Handoff

- per-feature planning: ready 時に system-dev-planner (`run-system-dev-plan`) を `--feature-id feat-blog-metrics-rollup` と repo-relative `--feature-context features/feat-blog-metrics-rollup.context.json` で起動する。人間の手動 `/system-dev-plan` 実行結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature=feat-blog-metrics-rollup` / `feature_package_id` で C02 経由 atomic 登録する (expected/applied=13 必須)。
- 分解方針: 日次テーブル定義・冪等な全日置換・収益と PV と行動の突合・定時実行・再実行入口・件数閾値を P01..P13 へ分解する。evidence は同一日 2 回実行の結果一致を示すこと。
- 完了 rollup: exact 13 が全て done かつ受入 9 件を evidence が満たした場合だけ本 feature を done にする。
