---
graph_node_id: "feat-writing-method"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "content"
tags: ["content","writing","quality","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "文章作成メソッドと品質検査"
owners: ["daishiman"]
created_at: "2026-08-16T13:20:00Z"
updated_at: "2026-08-16T14:20:00Z"
status: "active"
depends_on: ["feat-generation-foundation"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "記事の文章そのものの作り方を規則化し、事実と推論の境界を読者に見える形で保つ"
goal: "文体規則・セクション雛形・事実6分類の表示・ペルソナ差分の事実境界・マルチサイト差別化が実装され、QC-01 から QC-17 が自動検査として動く"
scope_in: ["文章基本順序とセクション雛形","文体規則と禁止表現","事実6分類の文中表示と data-fact-type","ペルソナ差分 (変えてよいもの/いけないもの)","マルチサイト差別化の文章ルール","QC-01 から QC-17 の検査実装 (BLOCK/WARN)"]
scope_out: ["プロンプト本体 (feat-generation-foundation)","公開の可否判定そのもの (feat-editorial-workflow)"]
acceptance: ["事実6分類が記事上で区別して表示される","ペルソナ違いの記事間で fact_fingerprint が一致する","QC の BLOCK が1件でもあると公開ゲートを通らない","連続40字以上の一致がサイト間で0件である"]
architecture_refs: ["arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-writing-method.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"b5fc60987cb79c08c30db4cd94b075a0bf89cd7acba7c8d1ffc8558af6439385","evaluator":"app-orchestrator/decompose-redo","evidence_ref":"docs/product/traceability.md"}
source_lineage: {"imported_at":"2026-08-16T13:20:00Z","origin_kind":"generated","source_digest":"b5fc60987cb79c08c30db4cd94b075a0bf89cd7acba7c8d1ffc8558af6439385","source_path":"docs/spec/01-要求仕様書-v1.0.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved two-layer specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-writing-method.md","confidence":0.94}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-727","github_mirror":null,"linked_at":"2026-08-16T14:20:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-16T13:20:00Z","missing_sections":[],"status":"complete"}
---

# 目的

記事の文章そのものの作り方を規則化し、事実と推論の境界を読者に見える形で保つ

## 到達状態

文体規則・セクション雛形・事実6分類の表示・ペルソナ差分の事実境界・マルチサイト差別化が実装され、QC-01 から QC-17 が自動検査として動く

## スコープ

- スコープ内:
  - 文章基本順序とセクション雛形
  - 文体規則と禁止表現
  - 事実6分類の文中表示と data-fact-type
  - ペルソナ差分 (変えてよいもの/いけないもの)
  - マルチサイト差別化の文章ルール
  - QC-01 から QC-17 の検査実装 (BLOCK/WARN)
- スコープ外:
  - プロンプト本体 (feat-generation-foundation)
  - 公開の可否判定そのもの (feat-editorial-workflow)

## 受入

- [ ] 事実6分類が記事上で区別して表示される
- [ ] ペルソナ違いの記事間で fact_fingerprint が一致する
- [ ] QC の BLOCK が1件でもあると公開ゲートを通らない
- [ ] 連続40字以上の一致がサイト間で0件である

## アーキテクチャ参照

- `architecture_refs`: arch-two-layer-platform
- 参照理由: 二層構造の責務境界と共有ドメインサービス層を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: feat-generation-foundation
- 依存理由: 生成の入出力契約が決まらないと文章規則を検査へ落とせない

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
