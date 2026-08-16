---
graph_node_id: "feat-spec-canonicalization"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "specification"
tags: ["spec-canonicalization","mvp"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "仕様正本の整理と投影"
owners: ["daishiman"]
created_at: "2026-08-16T11:19:17Z"
updated_at: "2026-08-16T11:20:02.290088Z"
status: "draft"
depends_on: []
related_nodes: ["task-spec-writeback","doc-spec-index"]
resource_scope: ["docs/spec","system-spec","features","tasks","specs","architecture"]
purpose: "関心ごとの正本を一つにし、実装投影と現行実装の差分を混同しない"
goal: "docs/spec の優先表、system-spec の As-Is、dev-graph と Beads で仕様整理を追跡できる"
mvp_alignment: {"background":"要求文書と Phase 0 文書が並立し、Analytics 詳細が分散していた","mvp_fit":"enabling","purpose":"実装の前に、どれが正本かを固定する","rationale":"文書の正本がないと次の実装 feature がどの契約を満たせばよいか決まらない"}
scope_in: ["正本文書と優先表","Phase 0 文書の位置づけ","system-spec の As-Is 更新","dev-graph と Beads の初期化"]
scope_out: ["Auth / Workspace 実装","2 D1 分離","Redirect / Insight 実装","exact-13 feature package"]
acceptance: ["00-README が Phase 0 を含む優先表を持つ","database.md が Phase 1 読者テーブルを As-Is に書く","graph ノードが C02 経由で登録されている"]
architecture_refs: ["arch-spec-governance"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-spec-canonicalization.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-16T11:19:17Z","origin_kind":"system-spec-harness","source_digest":"2f4b3d62f5d7a0bdc829bcf9dad18ef9caaa1c808792d83264dea6a5755f0b66","source_path":"system-spec/index.md","source_plugin":"system-spec-harness","source_version":"0.1.0"}
classification_confidence: 0.92
classification_reason: "macro feature for spec governance derived from system-spec index"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-spec-canonicalization.md","confidence":0.92}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-bgp","github_mirror":null,"linked_at":"2026-08-16T11:19:58Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

仕様の正本が分散し、同じ Analytics 契約が複数文書に残っていた状態をやめ、関心ごとの正本と実装投影を分けて読めるようにする。

## 到達状態

docs/spec の優先順位が明示され、system-spec が現行実装（運営者 3 テーブル + Phase 1 読者ドメイン）を As-Is として投影し、dev-graph と Beads でこの整理作業を追跡できる。

## スコープ

- スコープ内: 正本文書の追加と優先表、Phase 0 文書の位置づけ、system-spec の As-Is 更新、dev-graph / Beads 初期化、受領書
- スコープ外: Auth 実装、2 D1 分離、Redirect、Insight、exact-13 の新規機能 package

## 受入

- [ ] 00-README が Phase 0 文書を含む優先表を持つ
- [ ] system-spec/database.md が Phase 1 読者テーブルを As-Is に書く
- [ ] features / tasks / specs / architecture が C02 経由で登録されている
- [ ] 無関係な pycache を commit していない

## アーキテクチャ参照

- architecture_refs: arch-spec-governance

## 機能間依存

- depends_on: なし。本 feature は仕様整理の入口
- 依存理由: 実装 feature は本正本を読んでから切る

## Handoff

- per-feature planning: 実装 feature が必要になったときだけ system-dev-planner を起動する。今回は exact-13 を作らない
- 生成物: 正本と投影、graph ノード、Beads、受領書
- 登録先: C02 upsert。feature 以外の task は単発（parent_feature なし）
- 完了rollup: task-spec-writeback の draft PR 作成をもって実行完了とする
