---
graph_node_id: "feat-reader-surface"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "reader"
tags: ["reader","article","a11y","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "読者向け記事・比較メディア公開面"
owners: ["daishiman"]
created_at: "2026-08-16T12:20:00Z"
updated_at: "2026-08-16T14:35:00Z"
status: "active"
depends_on: ["feat-site-builder","feat-compliance-disclosure","feat-editorial-workflow","feat-ui-foundation"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "読者が JavaScript なしでも検索から比較・販売店選択まで完了できる記事面を提供する"
goal: "記事タイプ別の公開ページが情報アーキテクチャ通りに表示され、会話ブロック・比較表・根拠・広告表示を含み、通常UIだけで主要タスクを完了できる"
scope_in: ["情報アーキテクチャ (§7)","記事共通構成と記事タイプ (§8-9)","文章仕様と会話・吹き出し (§10-11)","コンテンツ品質 (§19)","アクセシビリティ・表示品質 (§20)","SEO・AI検索・機械可読性 (§18)"]
scope_out: ["AIアシスタント (feat-ai-assistant)","WebMCP (feat-webmcp-surface)"]
acceptance: ["JavaScript 無効のブラウザで検索→比較→販売店選択が完走できる","AI が返す根拠が記事本文の HTML 内にも存在する","axe の自動検査で重大な問題がゼロになる","各記事に広告表示と更新責任者が表示される"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-reader-surface.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"b5fc60987cb79c08c30db4cd94b075a0bf89cd7acba7c8d1ffc8558af6439385","evaluator":"app-orchestrator/decompose-redo","evidence_ref":"docs/product/traceability.md"}
source_lineage: {"imported_at":"2026-08-16T12:20:00Z","origin_kind":"generated","source_digest":"35241bfe4e82f6536d871c179eb938681ec771991fa50a59c72d5d97d3c98713","source_path":"docs/spec/ai-first-webmcp.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved product specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-reader-surface.md","confidence":0.94}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-87b","github_mirror":null,"linked_at":"2026-08-16T14:20:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-16T13:30:00Z","missing_sections":[],"status":"complete"}
---


# 目的

読者が JavaScript なしでも検索から比較・販売店選択まで完了できる記事面を提供する

## 到達状態

記事タイプ別の公開ページが情報アーキテクチャ通りに表示され、会話ブロック・比較表・根拠・広告表示を含み、通常UIだけで主要タスクを完了できる

## スコープ

- スコープ内:
  - 情報アーキテクチャ (§7)
  - 記事共通構成と記事タイプ (§8-9)
  - 文章仕様と会話・吹き出し (§10-11)
  - コンテンツ品質 (§19)
  - アクセシビリティ・表示品質 (§20)
  - SEO・AI検索・機械可読性 (§18)
- スコープ外:
  - AIアシスタント (feat-ai-assistant)
  - WebMCP (feat-webmcp-surface)

## 受入

- [ ] JavaScript 無効のブラウザで検索→比較→販売店選択が完走できる
- [ ] AI が返す根拠が記事本文の HTML 内にも存在する
- [ ] axe の自動検査で重大な問題がゼロになる
- [ ] 各記事に広告表示と更新責任者が表示される

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview, arch-two-layer-platform
- 参照理由: 確定済み system-spec (8章) の実装投影を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: feat-site-builder, feat-compliance-disclosure, feat-editorial-workflow, feat-ui-foundation
- 依存理由: 掲載先のサイト構造が無いと投稿も読者面も置き場所を持たない / 広告表示の正本が無いまま公開すると、記事・AI・WebMCP で表示が食い違う / 公開してよい状態の判定が無いまま読者面を出すと、責任者不明の記事が公開される

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
