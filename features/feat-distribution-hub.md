---
graph_node_id: "feat-distribution-hub"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "distribution"
tags: ["distribution","connector","schedule","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "Distribution Hub"
owners: ["daishiman"]
created_at: "2026-08-16T12:20:00Z"
updated_at: "2026-08-16T12:20:00Z"
status: "draft"
depends_on: ["feat-site-builder"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "作った原稿を、媒体ごとの条件に合わせて安全に届ける"
goal: "投稿先を接続し、プレビュー・予約・承認・投稿・再試行・更新・削除・結果取得ができ、投稿URLとエラーが記録される"
scope_in: ["Connector の基本契約 (§17.1)","現時点の連携方針と note 連携 (§17.2-17.3)","投稿前プレビュー (§17.4)","投稿の安全性 (§18.3)","予約とカレンダー"]
scope_out: ["各SNSの本番アカウント審査取得","広告出稿"]
acceptance: ["承認していない原稿は投稿できない","投稿に失敗すると理由と再試行導線が表示される","投稿成功時に投稿URLが保存される","プレビューが媒体ごとの体裁で表示される"]
architecture_refs: ["arch-system-spec-overview"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-distribution-hub.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":"0615d70d74973bac98929d7e3ce7b444933ac7e7280718ebbb74b8fef7676ca6","evaluator":"assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-report.json"}
source_lineage: {"imported_at":"2026-08-16T12:20:00Z","origin_kind":"generated","source_digest":"9185b196b216a5e9fc5b874144bcf74912551a9ddc28a9f3be115b6e09833c92","source_path":"docs/spec/01-要求仕様書-v1.0.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved product specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-distribution-hub.md","confidence":0.94}]
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

作った原稿を、媒体ごとの条件に合わせて安全に届ける

## 到達状態

投稿先を接続し、プレビュー・予約・承認・投稿・再試行・更新・削除・結果取得ができ、投稿URLとエラーが記録される

## スコープ

- スコープ内:
  - Connector の基本契約 (§17.1)
  - 現時点の連携方針と note 連携 (§17.2-17.3)
  - 投稿前プレビュー (§17.4)
  - 投稿の安全性 (§18.3)
  - 予約とカレンダー
- スコープ外:
  - 各SNSの本番アカウント審査取得
  - 広告出稿

## 受入

- [ ] 承認していない原稿は投稿できない
- [ ] 投稿に失敗すると理由と再試行導線が表示される
- [ ] 投稿成功時に投稿URLが保存される
- [ ] プレビューが媒体ごとの体裁で表示される

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview
- 参照理由: 確定済み system-spec (8章) の実装投影を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: feat-site-builder
- 依存理由: 掲載先のサイト構造が無いと投稿も読者面も置き場所を持たない

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
