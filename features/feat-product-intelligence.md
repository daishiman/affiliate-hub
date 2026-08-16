---
graph_node_id: "feat-product-intelligence"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "product"
tags: ["product","catalog","evidence","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "商品インテリジェンス"
owners: ["daishiman"]
created_at: "2026-08-16T12:20:00Z"
updated_at: "2026-08-16T12:20:00Z"
status: "draft"
depends_on: ["feat-affiliate-inbox"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "同じ商品の情報を何度も入力し直さずに済むよう、商品を一意に識別して一箇所に持つ"
goal: "URLから商品を識別し、識別キー・仕様・価格・在庫・画像・情報源・信頼度・有効期限を持つ商品レコードが作られ、由来が常に辿れる"
scope_in: ["商品識別キー (JAN/EAN/GTIN・ASIN・SKU・型番) (§12.1)","商品属性 (§9.3)","情報源の優先順位 (§10.3) と由来記録 (§10.5)","Amazon/楽天/Yahoo/バリューコマース/ASP の情報源対応 (§11)","有効期限と再取得"]
scope_out: ["比較候補の抽出とスコア (feat-comparison-engine)","商品説明文の生成"]
acceptance: ["商品詳細の各項目に情報源と取得日時が表示される","有効期限を過ぎた価格は期限切れとして表示される","同一商品と判定された複数URLが一つの商品レコードに束ねられる","禁止された取得方法を使っていないことがコードで確認できる"]
architecture_refs: ["arch-system-spec-overview"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-product-intelligence.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":"0615d70d74973bac98929d7e3ce7b444933ac7e7280718ebbb74b8fef7676ca6","evaluator":"assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-report.json"}
source_lineage: {"imported_at":"2026-08-16T12:20:00Z","origin_kind":"generated","source_digest":"9185b196b216a5e9fc5b874144bcf74912551a9ddc28a9f3be115b6e09833c92","source_path":"docs/spec/01-要求仕様書-v1.0.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved product specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-product-intelligence.md","confidence":0.94}]
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

同じ商品の情報を何度も入力し直さずに済むよう、商品を一意に識別して一箇所に持つ

## 到達状態

URLから商品を識別し、識別キー・仕様・価格・在庫・画像・情報源・信頼度・有効期限を持つ商品レコードが作られ、由来が常に辿れる

## スコープ

- スコープ内:
  - 商品識別キー (JAN/EAN/GTIN・ASIN・SKU・型番) (§12.1)
  - 商品属性 (§9.3)
  - 情報源の優先順位 (§10.3) と由来記録 (§10.5)
  - Amazon/楽天/Yahoo/バリューコマース/ASP の情報源対応 (§11)
  - 有効期限と再取得
- スコープ外:
  - 比較候補の抽出とスコア (feat-comparison-engine)
  - 商品説明文の生成

## 受入

- [ ] 商品詳細の各項目に情報源と取得日時が表示される
- [ ] 有効期限を過ぎた価格は期限切れとして表示される
- [ ] 同一商品と判定された複数URLが一つの商品レコードに束ねられる
- [ ] 禁止された取得方法を使っていないことがコードで確認できる

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview
- 参照理由: 確定済み system-spec (8章) の実装投影を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: feat-affiliate-inbox
- 依存理由: URL が入口として登録されていないと、商品情報を取りにいく対象が存在しない

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
