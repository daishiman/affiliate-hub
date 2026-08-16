---
graph_node_id: "spec-reader-surface"
artifact_kind: "specification"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "specification"
tags: ["spec-canonicalization","mvp"]
priority: null
start_date: "2026-08-16"
target_date: null
iteration: null
title: "読者面 Phase 0 契約の投影"
owners: ["daishiman"]
created_at: "2026-08-16T11:19:17Z"
updated_at: "2026-08-16T11:19:25.865971Z"
status: "draft"
depends_on: []
related_nodes: ["spec-gap-ledger","spec-product-requirements"]
resource_scope: ["docs/spec/ai-first-webmcp.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "specs/spec-reader-surface.md"
template_id: "specification"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-16T11:19:17Z","origin_kind":"manual","source_digest":"35241bfe4e82f6536d871c179eb938681ec771991fa50a59c72d5d97d3c98713","source_path":"docs/spec/ai-first-webmcp.md","source_plugin":null,"source_version":"1.0.0"}
classification_confidence: 0.92
classification_reason: "specification projection of docs/spec/ai-first-webmcp.md"
classification_candidates: [{"artifact_kind":"specification","candidate_path":"specs/spec-reader-surface.md","confidence":0.92}]
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

# 目的と成功状態

読者が記事と WebMCP から同じ根拠で商品を比較できる。成功時は読者面の詳細契約が ai-first-webmcp.md にあり、運営者の報酬管理と混ざらない。

## スコープ

- In: 記事、商品、主張、根拠、広告表記、公開ゲート、WebMCP
- Out: ASP 案件管理、成果の二軸状態、Redirect の SLO

## 用語と主体

| Term/Actor | Definition/Responsibility |
|---|---|
| Article | 公開される比較・レビュー記事 |
| Disclosure | 広告関係の唯一の表示元 |
| Publish gate | 著者・広告表記・更新責任者などが欠ける公開を止める |

## ユースケースとユーザーフロー

1. 編集者が記事メタを揃える
2. 公開ゲートが通った記事だけが公開される
3. 読者とエージェントが同じ比較結果を見る

## 機能要件

- FR-R-01: 公開に著者と広告表記と更新責任者が必要
- FR-R-02: 3 経路が同じ Disclosure を使う
- FR-R-03: 報酬額を順位計算に使わない

## 非機能要件

- Accessibility/Usability: 通常 UI だけで検索から比較まで完了できる
- Security/Privacy: 未承認の状態変更と無断アフィリエイト遷移を 0 にする
- Maintainability/Operability: 同じ計算を 3 回書かない

## UI・状態遷移

- Article.status: draft / review / published / archived
- 公開ゲート失敗時は公開しない

## ビジネスルールと検証

- BR-001: ranking / review / comparison はカテゴリー必須
- BR-002: 次回確認日は検証日とは別フィールド

## API契約

N/A: WebMCP ツールの詳細は ai-first-webmcp.md。本ノードは契約を複製しない。

## データモデル

- Phase 1 で読者テーブルを追加済み
- Claim / Evidence / RankingModel / Offer は未実装
- 差分の正本は data-model-gap.md

## 認証・認可

- 読者面は公開
- 編集操作の認証は未実装

## エラー・例外・回復

- 公開ゲートは編集者が直せるメッセージを返す

## イベント・非同期処理

N/A: 読者面の行動計測は 03。Phase 0 契約は記事公開が中心。

## 可観測性

- 完了条件の分解は completion-criteria.md
- 現状は未検証

## 互換性・移行・リリース

- Phase 0 文書は approved
- 実装は Phase 1 スキーマと公開ゲートまで

## テストと受入条件

- AC-001: 運営者 3 テーブルを読者エンティティに見立てて移行しない
- Phase 0 の A/B/C チェックは未達

## 未決事項

- Claim / Evidence の物理表現（中間テーブルか JSON か）は data-model-gap.md
