---
graph_node_id: "feat-site-builder"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "site"
tags: ["site","seo","structure","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "Site Builder"
owners: ["daishiman"]
created_at: "2026-08-16T12:20:00Z"
updated_at: "2026-08-16T14:35:00Z"
status: "active"
depends_on: ["feat-ai-content-studio","feat-site-blueprint","feat-ui-foundation"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "複数のブログを、同じ素材から重複なく構築できるようにする"
goal: "ブログを作成ウィザードから構築でき、ページ・記事テンプレート・ブロック・ナビゲーション・カテゴリー・タグ・内部リンク・構造化データ・サイトマップ・著者ページ・ポリシーページが生成される"
scope_in: ["ブログパターンとウィザード (§16.1-16.2)","サイトページと標準記事構成 (§16.3-16.4)","会話ブロック (§16.5)","マルチサイトの重複対策 (§16.6)","SEO・構造化データ・サイトマップ (§18 of ai-first-webmcp)"]
scope_out: ["独自ドメインのDNS運用","テーマの外部販売"]
acceptance: ["ウィザードを通すとナビゲーション・カテゴリー・ポリシーページを含むサイトが生成される","同一素材から作った複数サイトで重複対策が適用される","サイトマップと構造化データが出力される","著者ページから書き手ペルソナの情報が辿れる"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-site-builder.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"b5fc60987cb79c08c30db4cd94b075a0bf89cd7acba7c8d1ffc8558af6439385","evaluator":"app-orchestrator/decompose-redo","evidence_ref":"docs/product/traceability.md"}
source_lineage: {"imported_at":"2026-08-16T12:20:00Z","origin_kind":"generated","source_digest":"b5fc60987cb79c08c30db4cd94b075a0bf89cd7acba7c8d1ffc8558af6439385","source_path":"docs/spec/01-要求仕様書-v1.0.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved product specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-site-builder.md","confidence":0.94}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-492","github_mirror":null,"linked_at":"2026-08-16T14:20:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-16T13:30:00Z","missing_sections":[],"status":"complete"}
---


# 目的

複数のブログを、同じ素材から重複なく構築できるようにする

## 到達状態

ブログを作成ウィザードから構築でき、ページ・記事テンプレート・ブロック・ナビゲーション・カテゴリー・タグ・内部リンク・構造化データ・サイトマップ・著者ページ・ポリシーページが生成される

## スコープ

- スコープ内:
  - ブログパターンとウィザード (§16.1-16.2)
  - サイトページと標準記事構成 (§16.3-16.4)
  - 会話ブロック (§16.5)
  - マルチサイトの重複対策 (§16.6)
  - SEO・構造化データ・サイトマップ (§18 of ai-first-webmcp)
- スコープ外:
  - 独自ドメインのDNS運用
  - テーマの外部販売

## 受入

- [ ] ウィザードを通すとナビゲーション・カテゴリー・ポリシーページを含むサイトが生成される
- [ ] 同一素材から作った複数サイトで重複対策が適用される
- [ ] サイトマップと構造化データが出力される
- [ ] 著者ページから書き手ペルソナの情報が辿れる

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview, arch-two-layer-platform
- 参照理由: 確定済み system-spec (8章) の実装投影を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: feat-ai-content-studio, feat-site-blueprint, feat-ui-foundation
- 依存理由: 原稿がないとサイト構築も公開ゲートも対象を持たない

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
