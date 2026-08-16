---
graph_node_id: "feat-site-blueprint"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "site"
tags: ["site","template","wizard","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "Site Blueprint と記事構成テンプレート"
owners: ["daishiman"]
created_at: "2026-08-16T13:20:00Z"
updated_at: "2026-08-16T14:20:00Z"
status: "active"
depends_on: ["feat-data-model"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "サイトの構造を再利用可能なパラメータとして持ち、ウィザードの入力から記事構成まで一貫して導出する"
goal: "site_blueprint と article_template が一級の成果物として保存・複製・差し替えでき、§16.2 ウィザードの13ステップが Blueprint の各項目へ対応している"
scope_in: ["site_blueprint のスキーマと検証規則","article_template (標準記事構成25) のスキーマと検証規則","ウィザード13ステップと Blueprint 項目の対応","テンプレートの初期シード"]
scope_out: ["ウィザードのUI実装 (feat-site-builder)","文章の型 (feat-writing-method)"]
acceptance: ["Blueprint を複製して別サイトを作れる","記事タイプ4種それぞれに対応する article_template がある","ウィザードの各ステップが Blueprint のどの項目を埋めるか対応表で追える","検証規則 BP-01 から BP-06 と AT-01 から AT-05 が実行できる"]
architecture_refs: ["arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-site-blueprint.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"b5fc60987cb79c08c30db4cd94b075a0bf89cd7acba7c8d1ffc8558af6439385","evaluator":"app-orchestrator/decompose-redo","evidence_ref":"docs/product/traceability.md"}
source_lineage: {"imported_at":"2026-08-16T13:20:00Z","origin_kind":"generated","source_digest":"b5fc60987cb79c08c30db4cd94b075a0bf89cd7acba7c8d1ffc8558af6439385","source_path":"docs/spec/01-要求仕様書-v1.0.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved two-layer specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-site-blueprint.md","confidence":0.94}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-q2s","github_mirror":null,"linked_at":"2026-08-16T14:20:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-16T13:20:00Z","missing_sections":[],"status":"complete"}
---

# 目的

サイトの構造を再利用可能なパラメータとして持ち、ウィザードの入力から記事構成まで一貫して導出する

## 到達状態

site_blueprint と article_template が一級の成果物として保存・複製・差し替えでき、§16.2 ウィザードの13ステップが Blueprint の各項目へ対応している

## スコープ

- スコープ内:
  - site_blueprint のスキーマと検証規則
  - article_template (標準記事構成25) のスキーマと検証規則
  - ウィザード13ステップと Blueprint 項目の対応
  - テンプレートの初期シード
- スコープ外:
  - ウィザードのUI実装 (feat-site-builder)
  - 文章の型 (feat-writing-method)

## 受入

- [ ] Blueprint を複製して別サイトを作れる
- [ ] 記事タイプ4種それぞれに対応する article_template がある
- [ ] ウィザードの各ステップが Blueprint のどの項目を埋めるか対応表で追える
- [ ] 検証規則 BP-01 から BP-06 と AT-01 から AT-05 が実行できる

## アーキテクチャ参照

- `architecture_refs`: arch-two-layer-platform
- 参照理由: 二層構造の責務境界と共有ドメインサービス層を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: feat-data-model
- 依存理由: エンティティ定義が決まらないと Blueprint の保存先が定まらない

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
