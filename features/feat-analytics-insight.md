---
graph_node_id: "feat-analytics-insight"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "analytics"
tags: ["analytics","kpi","insight","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "Analytics & Insight Engine"
owners: ["daishiman"]
created_at: "2026-08-16T12:20:00Z"
updated_at: "2026-08-16T12:20:00Z"
status: "draft"
depends_on: ["feat-affiliate-hub","feat-distribution-hub","feat-reader-surface"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "どの情報・切り口・媒体・配置が成果につながるかを、推測ではなく計測で判断できるようにする"
goal: "イベント取込からアトリビューション・集計・KPI・インサイトまでが動き、ペルソナ別/媒体別/切り口別/商品別/テンプレート別/AI生成パターン別の成果が画面で見られる"
scope_in: ["イベントモデル (§2)","ディメンションモデル (§3)","KPIディクショナリ (§4)","MetricRollup (§5)","アトリビューション (§6)","Insight Engine (§7)","Analytics 画面 (§8)","プライバシー・保持期間 (§9)","Analytics API (§10)"]
scope_out: ["外部BIツール連携","有料広告の効果測定"]
acceptance: ["クリックと成果が突合され媒体別の成果が表示される","アトリビューション既定が last-click で動く","件数不足のインサイトが表示対象から除外される","保持期間を過ぎたイベントが削除される"]
architecture_refs: ["arch-system-spec-overview"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-analytics-insight.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":"0615d70d74973bac98929d7e3ce7b444933ac7e7280718ebbb74b8fef7676ca6","evaluator":"assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-report.json"}
source_lineage: {"imported_at":"2026-08-16T12:20:00Z","origin_kind":"generated","source_digest":"ed96924f70ef11408017b70c38c51dad3af3c82b4f02740965aa7cccaa7263ec","source_path":"docs/spec/03-分析・解析基盤仕様.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved product specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-analytics-insight.md","confidence":0.94}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

どの情報・切り口・媒体・配置が成果につながるかを、推測ではなく計測で判断できるようにする

## 到達状態

イベント取込からアトリビューション・集計・KPI・インサイトまでが動き、ペルソナ別/媒体別/切り口別/商品別/テンプレート別/AI生成パターン別の成果が画面で見られる

## スコープ

- スコープ内:
  - イベントモデル (§2)
  - ディメンションモデル (§3)
  - KPIディクショナリ (§4)
  - MetricRollup (§5)
  - アトリビューション (§6)
  - Insight Engine (§7)
  - Analytics 画面 (§8)
  - プライバシー・保持期間 (§9)
  - Analytics API (§10)
- スコープ外:
  - 外部BIツール連携
  - 有料広告の効果測定

## 受入

- [ ] クリックと成果が突合され媒体別の成果が表示される
- [ ] アトリビューション既定が last-click で動く
- [ ] 件数不足のインサイトが表示対象から除外される
- [ ] 保持期間を過ぎたイベントが削除される

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview
- 参照理由: 確定済み system-spec (8章) の実装投影を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: feat-affiliate-hub、feat-distribution-hub、feat-reader-surface
- 依存理由: 計測URLと成果の記録が無いとクリックと成果の突合ができない / 配信結果が無いと媒体別の成果を計測できない / 読者が見る面が無いと、AI の引用先も計測対象も存在しない

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
