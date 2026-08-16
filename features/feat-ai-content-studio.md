---
graph_node_id: "feat-ai-content-studio"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "editorial"
tags: ["ai","generation","llm","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "AI Content Studio"
owners: ["daishiman"]
created_at: "2026-08-16T12:20:00Z"
updated_at: "2026-08-16T14:35:00Z"
status: "active"
depends_on: ["feat-comparison-engine","feat-persona-studio","feat-generation-foundation","feat-writing-method"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "一つの商品情報から、媒体と目的の異なる原稿を根拠付きでまとめて作る"
goal: "必須入力が揃った状態から構成・本文・短文・比較文・タイトル・FAQ・会話・SNS変換などを生成し、根拠確認・重複確認・ブランド適合確認を通した草稿ができる"
scope_in: ["生成前必須入力の検査 (§15.1)","生成パターンと生成マトリクス (§15.3-15.4)","AI出力契約 (§15.5)","自動品質確認 (§15.6)","Claim と ContentVariant (§21.1-21.2)","人間承認前提 (原則 5.5)"]
scope_out: ["公開処理 (feat-editorial-workflow)","外部投稿 (feat-distribution-hub)"]
acceptance: ["必須入力が欠けている状態では生成ボタンが押せない","生成された事実主張に Claim への参照が付く","一次体験の捏造がペルソナの経験範囲チェックで弾かれる","人間の承認なしに公開状態へ進めない"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-ai-content-studio.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"b5fc60987cb79c08c30db4cd94b075a0bf89cd7acba7c8d1ffc8558af6439385","evaluator":"app-orchestrator/decompose-redo","evidence_ref":"docs/product/traceability.md"}
source_lineage: {"imported_at":"2026-08-16T12:20:00Z","origin_kind":"generated","source_digest":"b5fc60987cb79c08c30db4cd94b075a0bf89cd7acba7c8d1ffc8558af6439385","source_path":"docs/spec/01-要求仕様書-v1.0.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved product specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-ai-content-studio.md","confidence":0.94}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-0vt","github_mirror":null,"linked_at":"2026-08-16T14:20:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-16T13:30:00Z","missing_sections":[],"status":"complete"}
---


# 目的

一つの商品情報から、媒体と目的の異なる原稿を根拠付きでまとめて作る

## 到達状態

必須入力が揃った状態から構成・本文・短文・比較文・タイトル・FAQ・会話・SNS変換などを生成し、根拠確認・重複確認・ブランド適合確認を通した草稿ができる

## スコープ

- スコープ内:
  - 生成前必須入力の検査 (§15.1)
  - 生成パターンと生成マトリクス (§15.3-15.4)
  - AI出力契約 (§15.5)
  - 自動品質確認 (§15.6)
  - Claim と ContentVariant (§21.1-21.2)
  - 人間承認前提 (原則 5.5)
- スコープ外:
  - 公開処理 (feat-editorial-workflow)
  - 外部投稿 (feat-distribution-hub)

## 受入

- [ ] 必須入力が欠けている状態では生成ボタンが押せない
- [ ] 生成された事実主張に Claim への参照が付く
- [ ] 一次体験の捏造がペルソナの経験範囲チェックで弾かれる
- [ ] 人間の承認なしに公開状態へ進めない

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview, arch-two-layer-platform
- 参照理由: 確定済み system-spec (8章) の実装投影を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: feat-comparison-engine, feat-persona-studio, feat-generation-foundation, feat-writing-method
- 依存理由: 比較結果が単一正本で確定していないと、生成文と読者面で違う順位が出る / 誰が誰に書くかが決まらないと生成の必須入力が揃わない

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
