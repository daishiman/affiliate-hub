---
graph_node_id: "doc-spec-index"
artifact_kind: "document"
artifact_subtypes: []
layer: "spec-index"
project_id: "affiliate-hub"
domain: "specification"
tags: ["spec-canonicalization","mvp"]
priority: null
start_date: "2026-08-16"
target_date: null
iteration: null
title: "仕様正本の読み方"
owners: ["daishiman"]
created_at: "2026-08-16T11:19:17Z"
updated_at: "2026-08-16T11:19:26.686034Z"
status: "draft"
depends_on: []
related_nodes: ["feat-spec-canonicalization"]
resource_scope: ["docs/spec/00-README.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "docs/doc-spec-index.md"
template_id: "document"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.92
classification_reason: "operator document for spec precedence"
classification_candidates: [{"artifact_kind":"document","candidate_path":"docs/doc-spec-index.md","confidence":0.92}]
issue_linkage: null
tracker_binding: "none"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"not_applicable"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

仕様を読む人が、どのファイルを正本にすればよいか迷わないようにする。

## 対象読者

実装者、レビュアー、将来の自分。仕様プロセスの用語は 00-README を先に読む。

## 要約

docs/spec が製品正本、system-spec が実装投影、specs / architecture / features / tasks が dev-graph の登録ビューである。本文の詳細は複製しない。

## 本文

読み順は 01 → 02 → 03 → 読者面 Phase 0 → system-spec。更新は正本を先に直し、投影と graph ノードを後から合わせる。

## 決定事項

- 関心ごとに正本は一つ
- 4 軸（要求・文書・実装・検証）を混ぜない
- Phase 0 文書は削除しない

## 運用・更新方法

- 更新契機: 要求または実装スナップショットが変わったとき
- 更新責任者: このリポジトリのメンテナ
- 鮮度確認: spec-state.json の review_runs と completeness-report の hash

## 関連資料

- docs/spec/00-README.md
- feat-spec-canonicalization
- task-spec-writeback

## 変更履歴

| Date | Change | Author |
|---|---|---|
| 2026-08-16 | 正本表に Phase 0 文書と graph 投影を追加 | daishiman |
