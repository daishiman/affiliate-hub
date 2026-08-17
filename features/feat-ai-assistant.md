---
graph_node_id: "feat-ai-assistant"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "reader"
tags: ["ai","assistant","citation","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "読者向けAIアシスタント"
owners: ["daishiman"]
created_at: "2026-08-16T12:20:00Z"
updated_at: "2026-08-16T14:35:00Z"
status: "active"
depends_on: ["feat-reader-surface","feat-ui-foundation"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "読者の質問に、記事の根拠に紐づいた答えだけを返す"
goal: "AI が事実回答に必ず引用を付け、引用が主張を支持し、不明な場合は不明と答え、報酬に影響されない回答をする"
scope_in: ["AI機能 (§13)","claim_id による引用付与 (完了条件 A2)","評価セット50件と再実行コマンド (§24, 完了条件 C4)","ハルシネーション・一次体験捏造の構造的抑止"]
scope_out: ["WebMCP のツール公開 (feat-webmcp-surface)","記事生成 (feat-ai-content-studio)"]
acceptance: ["事実回答に必ず claim_id 付きの引用が付く","引用先の記述が記事HTML内に存在する","単一コマンドで評価セットを実行できる","報酬額を変えても回答の推奨順が変わらない"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-ai-assistant.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"b5fc60987cb79c08c30db4cd94b075a0bf89cd7acba7c8d1ffc8558af6439385","evaluator":"app-orchestrator/decompose-redo","evidence_ref":"docs/product/traceability.md"}
source_lineage: {"imported_at":"2026-08-16T12:20:00Z","origin_kind":"generated","source_digest":"35241bfe4e82f6536d871c179eb938681ec771991fa50a59c72d5d97d3c98713","source_path":"docs/spec/ai-first-webmcp.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved product specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-ai-assistant.md","confidence":0.94}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-asc","github_mirror":null,"linked_at":"2026-08-16T14:20:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-16T13:30:00Z","missing_sections":[],"status":"complete"}
---


# 目的

読者の質問に、記事の根拠に紐づいた答えだけを返す

## 到達状態

AI が事実回答に必ず引用を付け、引用が主張を支持し、不明な場合は不明と答え、報酬に影響されない回答をする

## スコープ

- スコープ内:
  - AI機能 (§13)
  - claim_id による引用付与 (完了条件 A2)
  - 評価セット50件と再実行コマンド (§24, 完了条件 C4)
  - ハルシネーション・一次体験捏造の構造的抑止
- スコープ外:
  - WebMCP のツール公開 (feat-webmcp-surface)
  - 記事生成 (feat-ai-content-studio)

## 受入

- [ ] 事実回答に必ず claim_id 付きの引用が付く
- [ ] 引用先の記述が記事HTML内に存在する
- [ ] 単一コマンドで評価セットを実行できる
- [ ] 報酬額を変えても回答の推奨順が変わらない

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview, arch-two-layer-platform
- 参照理由: 確定済み system-spec (8章) の実装投影を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: feat-reader-surface, feat-ui-foundation
- 依存理由: 読者が見る面が無いと、AI の引用先も計測対象も存在しない

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
