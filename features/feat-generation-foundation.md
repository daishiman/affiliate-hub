---
graph_node_id: "feat-generation-foundation"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "generation"
tags: ["ai","generation","evaluation","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "生成基盤 (プロンプト・スキル・サブエージェント・評価セット)"
owners: ["daishiman"]
created_at: "2026-08-16T13:20:00Z"
updated_at: "2026-08-17T16:23:16Z"
status: "closed"
depends_on: []
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "AIに自由に書かせず、承認済みの事実・根拠・ペルソナ・媒体ルールを入力として生成させる仕組みを持つ"
goal: "入力検証・バージョン付きプロンプト・出力契約・自動検査・人間承認の順で生成が流れ、50件以上の評価セットでローンチ基準を判定できる"
scope_in: ["GenerationInput の必須入力検証","prompts/generation のバージョン管理","generated_variant 出力契約 (JSON Schema)","スキル8種の定義","サブエージェント6種の定義 (執筆系と検証系の分離)","評価セット50件以上とローンチ基準","プロンプトインジェクション対策"]
scope_out: ["文章の型そのもの (feat-writing-method)","記事の編集UI (feat-ai-content-studio)"]
acceptance: ["必須入力が欠けたら生成が実行されない","生成物に generation_prompt_version と fact_fingerprint が記録される","検証系サブエージェントが生成ツールを持たない","評価セットが50件以上あり、実行結果を証拠つきで記録できる"]
architecture_refs: ["arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-generation-foundation.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"b5fc60987cb79c08c30db4cd94b075a0bf89cd7acba7c8d1ffc8558af6439385","evaluator":"app-orchestrator/decompose-redo","evidence_ref":"docs/product/traceability.md"}
source_lineage: {"imported_at":"2026-08-16T13:20:00Z","origin_kind":"generated","source_digest":"b5fc60987cb79c08c30db4cd94b075a0bf89cd7acba7c8d1ffc8558af6439385","source_path":"docs/spec/01-要求仕様書-v1.0.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved two-layer specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-generation-foundation.md","confidence":0.94}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-0dk","github_mirror":null,"linked_at":"2026-08-16T14:20:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-16T13:20:00Z","missing_sections":[],"status":"complete"}
---

# 目的

AIに自由に書かせず、承認済みの事実・根拠・ペルソナ・媒体ルールを入力として生成させる仕組みを持つ

## 到達状態

入力検証・バージョン付きプロンプト・出力契約・自動検査・人間承認の順で生成が流れ、50件以上の評価セットでローンチ基準を判定できる

## スコープ

- スコープ内:
  - GenerationInput の必須入力検証
  - prompts/generation のバージョン管理
  - generated_variant 出力契約 (JSON Schema)
  - スキル8種の定義
  - サブエージェント6種の定義 (執筆系と検証系の分離)
  - 評価セット50件以上とローンチ基準
  - プロンプトインジェクション対策
- スコープ外:
  - 文章の型そのもの (feat-writing-method)
  - 記事の編集UI (feat-ai-content-studio)

## 受入

- [ ] 必須入力が欠けたら生成が実行されない
- [ ] 生成物に generation_prompt_version と fact_fingerprint が記録される
- [ ] 検証系サブエージェントが生成ツールを持たない
- [ ] 評価セットが50件以上あり、実行結果を証拠つきで記録できる

## アーキテクチャ参照

- `architecture_refs`: arch-two-layer-platform
- 参照理由: 二層構造の責務境界と共有ドメインサービス層を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: feat-persona-studio, feat-product-intelligence
- 依存理由: ペルソナと商品事実が揃わないと生成の入力を検証できない

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
