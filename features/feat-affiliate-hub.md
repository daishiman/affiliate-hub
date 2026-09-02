---
graph_node_id: "feat-affiliate-hub"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "affiliate"
tags: ["affiliate","asp","tracking","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "Affiliate Hub (アフィリエイト一元管理)"
owners: ["daishiman"]
created_at: "2026-08-16T12:20:00Z"
updated_at: "2026-08-30T15:16:06Z"
status: "active"
depends_on: ["feat-affiliate-inbox","feat-auth-workspace","feat-data-model"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "ASP・プログラム・リンク・成果・報酬を一箇所で管理し、リンク切れや終了を取りこぼさない"
goal: "ASP/広告主/プログラム/リンクと提携状態を管理でき、掲載計測URLを通じてクリックと成果が記録され、リンク切れとプログラム終了が検出される"
scope_in: ["管理対象 (§19.1)","Affiliate Link (ASP原本) と Tracking Link (§19.2-19.2.1)","リンク掲載ルール (§19.3)","編集評価との分離 (§19.4)","CSV/API インポート","リンク切れ・プログラム終了検出"]
scope_out: ["成果の集計とKPI (feat-analytics-insight)","広告表示文言 (feat-compliance-disclosure)"]
acceptance: ["ASP原本リンクと掲載計測URLが別レコードとして保存される","リンク切れが検出され対象記事が一覧できる","報酬額が編集側のランキング計算に渡っていないことがコードで確認できる","CSV取込で成果が登録される"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-affiliate-hub.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"b5fc60987cb79c08c30db4cd94b075a0bf89cd7acba7c8d1ffc8558af6439385","evaluator":"app-orchestrator/decompose-redo","evidence_ref":"docs/product/traceability.md"}
source_lineage: {"imported_at":"2026-08-16T12:20:00Z","origin_kind":"generated","source_digest":"b5fc60987cb79c08c30db4cd94b075a0bf89cd7acba7c8d1ffc8558af6439385","source_path":"docs/spec/01-要求仕様書-v1.0.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved product specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-affiliate-hub.md","confidence":0.94}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-dtq","github_mirror":null,"linked_at":"2026-08-16T14:20:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-16T13:30:00Z","missing_sections":[],"status":"complete"}
---

# 目的

ASP・プログラム・リンク・成果・報酬を一箇所で管理し、リンク切れや終了を取りこぼさない

## 到達状態

ASP/広告主/プログラム/リンクと提携状態を管理でき、掲載計測URLを通じてクリックと成果が記録され、リンク切れとプログラム終了が検出される

## スコープ

- スコープ内:
  - 管理対象 (§19.1)
  - Affiliate Link (ASP原本) と Tracking Link (§19.2-19.2.1)
  - リンク掲載ルール (§19.3)
  - 編集評価との分離 (§19.4)
  - CSV/API インポート
  - リンク切れ・プログラム終了検出
- スコープ外:
  - 成果の集計とKPI (feat-analytics-insight)
  - 広告表示文言 (feat-compliance-disclosure)

## 受入

- [ ] ASP原本リンクと掲載計測URLが別レコードとして保存される
- [ ] リンク切れが検出され対象記事が一覧できる
- [ ] 報酬額が編集側のランキング計算に渡っていないことがコードで確認できる
- [ ] CSV取込で成果が登録される

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview, arch-two-layer-platform
- 参照理由: 確定済み system-spec (8章) の実装投影を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: feat-auth-workspace, feat-affiliate-inbox, feat-data-model
- 依存理由: テナント境界とブランド既定値が決まらないと、後続のどのデータにも所有者を付けられない / URL が入口として登録されていないと、商品情報を取りにいく対象が存在しない

## 2026-08-24 実装投影

成果リンク登録時に商品スナップショットを残す経路を追加した（Beads `ah-au4`）。リンク切れ検出、CSV 取込、停止して登録し直す流れは未達（`ah-1y7` / `ah-sc9`）。

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
