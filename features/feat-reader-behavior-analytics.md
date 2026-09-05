---
graph_node_id: "feat-reader-behavior-analytics"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["analytics","reader-behavior","heatmap","dwell","scroll-depth","privacy"]
priority: "high"
start_date: "2026-09-04"
target_date: null
iteration: null
title: "読者行動の計測とヒートマップ可視化"
owners: ["daishiman"]
created_at: "2026-09-04T00:00:00Z"
updated_at: "2026-09-04T02:29:38.781419Z"
status: "active"
depends_on: ["feat-reader-surface","feat-data-model","feat-analytics-insight"]
related_nodes: ["spec-system-spec-index","feat-blog-scoped-admin-console"]
resource_scope: ["src/db/schema.ts","src/domain/analytics/reader-interaction.ts","src/application/analytics/ingest-reader-interactions.ts","src/app/api/reader-events/","src/components/reader/behavior-probe.tsx","src/app/admin/sites/[site]/articles/[article]/behavior/","system-spec","features/feat-reader-behavior-analytics.context.json"]
purpose: "読者が記事のどこで時間を使い、どこを押しているのかを、個人を追跡せずに分布として観測できるようにする"
goal: "読者面が滞在・スクロール到達・要素クリック・ポインタ標本を要素相対比率で束ねて送り、reader_interaction_events へ追記され、管理画面が viewport_bucket ごとの集計分布としてヒートマップを描き、同意が無い読者は reader_key を持たず 90 日で生データが消える状態になっている"
scope_in: ["reader_interaction_events テーブル (workspace_id / site_slug / article_slug / occurred_at / reader_key nullable / kind scroll_depth|dwell|element_click|pointer_sample / viewport_bucket / element_ref / x_ratio / y_ratio / value)","読者面の計測: IntersectionObserver によるスクロール到達、visibilitychange + 滞在タイマーによる dwell、委譲した単一 click リスナ、間隔標本のポインタ位置","座標は要素相対比率 (element_ref + x_ratio/y_ratio) で記録し、絶対座標を残さない","sendBeacon による束ね送信と、ingest-reader-interactions の追記専用受入 (バッチ・重複耐性)","同意が無い場合 reader_key を null にし、読者個人へ戻せる列を持たない","管理画面の記事プレビュー上への canvas 重ね描画と viewport_bucket (narrow/medium/wide) 切替","reader_interaction_events の 90 日削除と、reader_key 指定での抽出・削除 (Owner 限定)"]
scope_out: ["1 読者の行動を時系列で再生する機能 (作らない)","日次ロールアップと収益・PV との突合 (feat-blog-metrics-rollup)","行動指標を使った示唆生成と提示順序 (feat-blog-scoped-admin-console)","既存の汎用イベント/KPI 基盤そのもの (feat-analytics-insight)"]
acceptance: ["同意が無い読者の行から reader_key が常に null で、個人へ戻せる列が他に無い","保存される位置が element_ref + x_ratio/y_ratio の比率で、絶対座標の列が存在しない","ポインタは全軌跡ではなくクリックと間隔標本だけが記録される","ヒートマップが常に集計分布として描かれ、単一 reader_key の再生経路が UI にもクエリにも存在しない","viewport_bucket を切り替えると同じ記事で別の分布が描かれる","ページ離脱時にも計測が欠落せず sendBeacon で送出される","同じバッチを二度受け取っても件数が二重にならない","reader_interaction_events が 90 日を超えると削除され、集計側は残る","reader_key を指定した抽出・削除が Owner だけで実行でき、audit_logs に残る","計測 script の失敗が読者面の描画を壊さない"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform","arch-blog-operations-console"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-reader-behavior-analytics.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"0991946d448ede0701275e1fb4f83325d708cc03cc042b4c54eb80964782f1d0","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-reader-behavior-analytics/0991946d448ede0701275e1fb4f83325d708cc03cc042b4c54eb80964782f1d0/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-04T00:00:00Z","origin_kind":"generated","source_digest":"bfd54655ae9a9f448eca91fcd6f57a9a30520bf4632c5f709f4ca504130cff7e","source_path":"system-spec/index.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "確定質疑 qa-database-web-domain-aeo-behavior / qa-backend-web-domain-aeo-behavior / qa-security-web-domain-behavior-privacy / qa-frontend-web-blog-scoped-admin を lineage 参照。利用者要望『どのような方々が閲覧しているか、どこに時間をかけて見ているか、どこがクリック率が高いか』への対応"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-reader-behavior-analytics.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-f4do","github_mirror":null,"linked_at":"2026-09-04T02:06:39Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T00:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

読者が記事のどこで時間を使い、どこを押しているのかを、個人を追跡せずに分布として観測できるようにする

## 到達状態

読者面が滞在・スクロール到達・要素クリック・ポインタ標本を要素相対比率で束ねて送り、reader_interaction_events へ追記され、管理画面が viewport_bucket ごとの集計分布としてヒートマップを描き、同意が無い読者は reader_key を持たず 90 日で生データが消える状態になっている

## スコープ

スコープ内:

- reader_interaction_events テーブル (workspace_id / site_slug / article_slug / occurred_at / reader_key nullable / kind scroll_depth|dwell|element_click|pointer_sample / viewport_bucket / element_ref / x_ratio / y_ratio / value)
- 読者面の計測: IntersectionObserver によるスクロール到達、visibilitychange + 滞在タイマーによる dwell、委譲した単一 click リスナ、間隔標本のポインタ位置
- 座標は要素相対比率 (element_ref + x_ratio/y_ratio) で記録し、絶対座標を残さない
- sendBeacon による束ね送信と、ingest-reader-interactions の追記専用受入 (バッチ・重複耐性)
- 同意が無い場合 reader_key を null にし、読者個人へ戻せる列を持たない
- 管理画面の記事プレビュー上への canvas 重ね描画と viewport_bucket (narrow/medium/wide) 切替
- reader_interaction_events の 90 日削除と、reader_key 指定での抽出・削除 (Owner 限定)

スコープ外:

- 1 読者の行動を時系列で再生する機能 (作らない)
- 日次ロールアップと収益・PV との突合 (feat-blog-metrics-rollup)
- 行動指標を使った示唆生成と提示順序 (feat-blog-scoped-admin-console)
- 既存の汎用イベント/KPI 基盤そのもの (feat-analytics-insight)

## 受入

- [ ] 同意が無い読者の行から reader_key が常に null で、個人へ戻せる列が他に無い
- [ ] 保存される位置が element_ref + x_ratio/y_ratio の比率で、絶対座標の列が存在しない
- [ ] ポインタは全軌跡ではなくクリックと間隔標本だけが記録される
- [ ] ヒートマップが常に集計分布として描かれ、単一 reader_key の再生経路が UI にもクエリにも存在しない
- [ ] viewport_bucket を切り替えると同じ記事で別の分布が描かれる
- [ ] ページ離脱時にも計測が欠落せず sendBeacon で送出される
- [ ] 同じバッチを二度受け取っても件数が二重にならない
- [ ] reader_interaction_events が 90 日を超えると削除され、集計側は残る
- [ ] reader_key を指定した抽出・削除が Owner だけで実行でき、audit_logs に残る
- [ ] 計測 script の失敗が読者面の描画を壊さない

## アーキテクチャ参照

- `architecture_refs`: `arch-system-spec-overview`
- `architecture_refs`: `arch-two-layer-platform`
- `architecture_refs`: `arch-blog-operations-console`
- 関連ノード: `spec-system-spec-index`、`feat-blog-scoped-admin-console`

## 機能間依存

- `depends_on`: `feat-reader-surface`
- `depends_on`: `feat-data-model`
- `depends_on`: `feat-analytics-insight`
- 依存理由: 計測を差し込む読者面 (feat-reader-surface)、events を載せるデータモデル (feat-data-model)、既存の計測・指標基盤 (feat-analytics-insight) の上に積む。

## Handoff

- per-feature planning: ready 時に system-dev-planner (`run-system-dev-plan`) を `--feature-id feat-reader-behavior-analytics` と repo-relative `--feature-context features/feat-reader-behavior-analytics.context.json` で起動する。人間の手動 `/system-dev-plan` 実行結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature=feat-reader-behavior-analytics` / `feature_package_id` で C02 経由 atomic 登録する (expected/applied=13 必須)。
- 分解方針: events スキーマ・読者面の 4 種計測・比率座標・束ね送信・追記受入・canvas 重ね描画・保持期間と削除経路を P01..P13 へ分解する。evidence は同意なし時に reader_key が null であることと単一読者再生が存在しないことを示すこと。
- 完了 rollup: exact 13 が全て done かつ受入 10 件を evidence が満たした場合だけ本 feature を done にする。
