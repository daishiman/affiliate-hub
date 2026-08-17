---
graph_node_id: "feat-data-model"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "data"
tags: ["data","schema","tenancy","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "データモデル基盤 (32エンティティ)"
owners: ["daishiman"]
created_at: "2026-08-16T13:20:00Z"
updated_at: "2026-08-16T14:20:00Z"
status: "active"
depends_on: ["feat-auth-workspace"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "プラットフォーム層 §21 の全32エンティティを単一のスキーマ定義として持ち、二層で同じ正規データを参照できるようにする"
goal: "32エンティティが src/db/schema.ts に定義され、マイグレーションが適用でき、全クエリが workspace_id で束縛され、報酬データが編集評価の入力型から構造的に排除されている"
scope_in: ["§21 全32エンティティのテーブル定義","マイグレーションとシード","テナント分離の型 (§26.4)","Editorial/Commercial 分離の型 (§19.4)","ブログ層 §12 の8エンティティを同一定義へ収れんさせる"]
scope_out: ["各エンティティの管理画面 (各機能feature側で持つ)","分析用の集計テーブル (feat-analytics-insight)"]
acceptance: ["32エンティティが定義され、traceability.md F節の全行が対応テーブルを持つ","Repository 関数が WorkspaceId を必須引数に取る","EditorialProduct 型に報酬フィールドが含まれない","マイグレーションが preview 環境で適用できる"]
architecture_refs: ["arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-data-model.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"b5fc60987cb79c08c30db4cd94b075a0bf89cd7acba7c8d1ffc8558af6439385","evaluator":"app-orchestrator/decompose-redo","evidence_ref":"docs/product/traceability.md"}
source_lineage: {"imported_at":"2026-08-16T13:20:00Z","origin_kind":"generated","source_digest":"b5fc60987cb79c08c30db4cd94b075a0bf89cd7acba7c8d1ffc8558af6439385","source_path":"docs/spec/01-要求仕様書-v1.0.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved two-layer specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-data-model.md","confidence":0.94}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-d9s","github_mirror":null,"linked_at":"2026-08-16T14:20:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-16T13:20:00Z","missing_sections":[],"status":"complete"}
---

# 目的

プラットフォーム層 §21 の全32エンティティを単一のスキーマ定義として持ち、二層で同じ正規データを参照できるようにする

## 到達状態

32エンティティが src/db/schema.ts に定義され、マイグレーションが適用でき、全クエリが workspace_id で束縛され、報酬データが編集評価の入力型から構造的に排除されている

## スコープ

- スコープ内:
  - §21 全32エンティティのテーブル定義
  - マイグレーションとシード
  - テナント分離の型 (§26.4)
  - Editorial/Commercial 分離の型 (§19.4)
  - ブログ層 §12 の8エンティティを同一定義へ収れんさせる
- スコープ外:
  - 各エンティティの管理画面 (各機能feature側で持つ)
  - 分析用の集計テーブル (feat-analytics-insight)

## 受入

- [ ] 32エンティティが定義され、traceability.md F節の全行が対応テーブルを持つ
- [ ] Repository 関数が WorkspaceId を必須引数に取る
- [ ] EditorialProduct 型に報酬フィールドが含まれない
- [ ] マイグレーションが preview 環境で適用できる

## アーキテクチャ参照

- `architecture_refs`: arch-two-layer-platform
- 参照理由: 二層構造の責務境界と共有ドメインサービス層を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: feat-auth-workspace
- 依存理由: テナントと Workspace が決まらないと全テーブルの所有境界が定まらない

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
