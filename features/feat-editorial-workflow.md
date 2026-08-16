---
graph_node_id: "feat-editorial-workflow"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "editorial"
tags: ["workflow","publish-gate","correction","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "編集ワークフローと公開ゲート"
owners: ["daishiman"]
created_at: "2026-08-16T12:20:00Z"
updated_at: "2026-08-16T12:20:00Z"
status: "draft"
depends_on: ["feat-ai-content-studio"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "公開してよい状態かを機械的に判定し、公開後の更新と訂正まで責任を持てるようにする"
goal: "Content 状態と Publication 状態が定義通り遷移し、公開ゲートの必須項目 (更新責任者・次回確認日・免責・根拠) を満たさない記事は公開できず、訂正受付と更新履歴が残る"
scope_in: ["Content 状態 (§18.1) と Publication 状態 (§18.2)","公開ゲートの必須検査","更新責任者と次回確認日 (完了条件 C1/C3)","訂正受付 /corrections (完了条件 C2)","UpdateLog と変更履歴 (完了条件 C5)","期限切れ検出ジョブ"]
scope_out: ["外部プラットフォームへの投稿 (feat-distribution-hub)","記事表示 (feat-reader-surface)"]
acceptance: ["更新責任者が未設定の記事は公開操作が失敗し理由が画面に出る","次回確認日を過ぎた記事が一覧で期限切れとして検出される","/corrections から送信した訂正が管理側に届く","公開・更新のたびに UpdateLog へ履歴が残る"]
architecture_refs: ["arch-system-spec-overview"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-editorial-workflow.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":"0615d70d74973bac98929d7e3ce7b444933ac7e7280718ebbb74b8fef7676ca6","evaluator":"assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-report.json"}
source_lineage: {"imported_at":"2026-08-16T12:20:00Z","origin_kind":"generated","source_digest":"35241bfe4e82f6536d871c179eb938681ec771991fa50a59c72d5d97d3c98713","source_path":"docs/spec/ai-first-webmcp.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved product specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-editorial-workflow.md","confidence":0.94}]
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

公開してよい状態かを機械的に判定し、公開後の更新と訂正まで責任を持てるようにする

## 到達状態

Content 状態と Publication 状態が定義通り遷移し、公開ゲートの必須項目 (更新責任者・次回確認日・免責・根拠) を満たさない記事は公開できず、訂正受付と更新履歴が残る

## スコープ

- スコープ内:
  - Content 状態 (§18.1) と Publication 状態 (§18.2)
  - 公開ゲートの必須検査
  - 更新責任者と次回確認日 (完了条件 C1/C3)
  - 訂正受付 /corrections (完了条件 C2)
  - UpdateLog と変更履歴 (完了条件 C5)
  - 期限切れ検出ジョブ
- スコープ外:
  - 外部プラットフォームへの投稿 (feat-distribution-hub)
  - 記事表示 (feat-reader-surface)

## 受入

- [ ] 更新責任者が未設定の記事は公開操作が失敗し理由が画面に出る
- [ ] 次回確認日を過ぎた記事が一覧で期限切れとして検出される
- [ ] /corrections から送信した訂正が管理側に届く
- [ ] 公開・更新のたびに UpdateLog へ履歴が残る

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview
- 参照理由: 確定済み system-spec (8章) の実装投影を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: feat-ai-content-studio
- 依存理由: 原稿がないとサイト構築も公開ゲートも対象を持たない

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
