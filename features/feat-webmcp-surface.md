---
graph_node_id: "feat-webmcp-surface"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "reader"
tags: ["webmcp","agent","readonly","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "WebMCP 読み取り面と限定状態変更"
owners: ["daishiman"]
created_at: "2026-08-16T12:20:00Z"
updated_at: "2026-08-16T14:35:00Z"
status: "active"
depends_on: ["feat-ai-assistant","feat-comparison-engine","feat-ui-foundation"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "エージェントが安全にサイトを操作できるようにしつつ、勝手な状態変更を構造的に起こさせない"
goal: "WebMCP ツールが読み取り専用から段階的に公開され、限定的な状態変更は人間の承認を経てのみ確定し、非対応環境でも機能低下が限定的である"
scope_in: ["WebMCP設計 (§14)","Adapter 分離 (完了条件 C6)","エージェント呼び出しだけで確定させない処理順序 (§14.5)","禁止依存の静的検査 (§27)","ローンチ基準の測定 (§24)"]
scope_out: ["外部エージェントの認証基盤","書き込み系ツールの全面公開"]
acceptance: ["document.modelContext を削除した環境で主要タスクが完走できる","ドメインサービスが document.modelContext を直接参照していないことが静的検査で確認できる","未承認の状態変更が発生しない","WebMCP と UI の比較結果が一致する"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-webmcp-surface.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"b5fc60987cb79c08c30db4cd94b075a0bf89cd7acba7c8d1ffc8558af6439385","evaluator":"app-orchestrator/decompose-redo","evidence_ref":"docs/product/traceability.md"}
source_lineage: {"imported_at":"2026-08-16T12:20:00Z","origin_kind":"generated","source_digest":"35241bfe4e82f6536d871c179eb938681ec771991fa50a59c72d5d97d3c98713","source_path":"docs/spec/ai-first-webmcp.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved product specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-webmcp-surface.md","confidence":0.94}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-mps","github_mirror":null,"linked_at":"2026-08-16T14:20:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-16T13:30:00Z","missing_sections":[],"status":"complete"}
---


# 目的

エージェントが安全にサイトを操作できるようにしつつ、勝手な状態変更を構造的に起こさせない

## 到達状態

WebMCP ツールが読み取り専用から段階的に公開され、限定的な状態変更は人間の承認を経てのみ確定し、非対応環境でも機能低下が限定的である

## スコープ

- スコープ内:
  - WebMCP設計 (§14)
  - Adapter 分離 (完了条件 C6)
  - エージェント呼び出しだけで確定させない処理順序 (§14.5)
  - 禁止依存の静的検査 (§27)
  - ローンチ基準の測定 (§24)
- スコープ外:
  - 外部エージェントの認証基盤
  - 書き込み系ツールの全面公開

## 受入

- [ ] document.modelContext を削除した環境で主要タスクが完走できる
- [ ] ドメインサービスが document.modelContext を直接参照していないことが静的検査で確認できる
- [ ] 未承認の状態変更が発生しない
- [ ] WebMCP と UI の比較結果が一致する

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview, arch-two-layer-platform
- 参照理由: 確定済み system-spec (8章) の実装投影を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: feat-ai-assistant, feat-comparison-engine, feat-ui-foundation
- 依存理由: 引用付き回答の土台が無いと WebMCP の読み取りツールが根拠を返せない / 比較結果が単一正本で確定していないと、生成文と読者面で違う順位が出る

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
