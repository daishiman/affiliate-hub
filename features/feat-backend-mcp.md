---
graph_node_id: "feat-backend-mcp"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "platform"
tags: ["mcp","backend","operator","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "バックエンドMCP (運営者向け)"
owners: ["daishiman"]
created_at: "2026-08-16T12:20:00Z"
updated_at: "2026-08-16T12:20:00Z"
status: "draft"
depends_on: ["feat-analytics-insight"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "運営者が対話から案件・成果・分析を扱えるようにする"
goal: "運営者向け MCP ツールが認証付きで公開され、WebMCP と目的が重複せず、分析と案件管理を対話から実行できる"
scope_in: ["バックエンドMCP (§15, §24.3)","既存3ツール (list_programs/record_conversion/get_revenue_summary) の正式契約化","認可とテナント境界","目的重複ツールゼロ (完了条件 B5)"]
scope_out: ["読者向け WebMCP (feat-webmcp-surface)","外部公開マーケットプレイス配布"]
acceptance: ["MCP ツールが認証なしでは呼べない","WebMCP と MCP のツール説明文に重複がないことが検査で確認できる","テナント境界を越えるデータが返らない","分析ツールが Analytics の同じ集計結果を返す"]
architecture_refs: ["arch-system-spec-overview"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-backend-mcp.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":"0615d70d74973bac98929d7e3ce7b444933ac7e7280718ebbb74b8fef7676ca6","evaluator":"assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-report.json"}
source_lineage: {"imported_at":"2026-08-16T12:20:00Z","origin_kind":"generated","source_digest":"35241bfe4e82f6536d871c179eb938681ec771991fa50a59c72d5d97d3c98713","source_path":"docs/spec/ai-first-webmcp.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved product specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-backend-mcp.md","confidence":0.94}]
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

運営者が対話から案件・成果・分析を扱えるようにする

## 到達状態

運営者向け MCP ツールが認証付きで公開され、WebMCP と目的が重複せず、分析と案件管理を対話から実行できる

## スコープ

- スコープ内:
  - バックエンドMCP (§15, §24.3)
  - 既存3ツール (list_programs/record_conversion/get_revenue_summary) の正式契約化
  - 認可とテナント境界
  - 目的重複ツールゼロ (完了条件 B5)
- スコープ外:
  - 読者向け WebMCP (feat-webmcp-surface)
  - 外部公開マーケットプレイス配布

## 受入

- [ ] MCP ツールが認証なしでは呼べない
- [ ] WebMCP と MCP のツール説明文に重複がないことが検査で確認できる
- [ ] テナント境界を越えるデータが返らない
- [ ] 分析ツールが Analytics の同じ集計結果を返す

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview
- 参照理由: 確定済み system-spec (8章) の実装投影を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: feat-analytics-insight
- 依存理由: 計測結果が無いと運営者向け MCP が返す分析の中身が存在しない

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
