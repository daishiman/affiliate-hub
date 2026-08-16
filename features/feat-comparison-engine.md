---
graph_node_id: "feat-comparison-engine"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "product"
tags: ["comparison","ranking","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "比較エンジン"
owners: ["daishiman"]
created_at: "2026-08-16T12:20:00Z"
updated_at: "2026-08-16T12:20:00Z"
status: "draft"
depends_on: ["feat-product-intelligence"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "読者が選べるように、同一商品・別販売店・代替品などの比較候補を根拠付きで並べる"
goal: "ある商品から比較候補が分類別に抽出され、報酬額に影響されない比較スコアで並び、UI・AI・WebMCP のどこから見ても同じ結果になる"
scope_in: ["比較候補の分類 (§12.2)","比較スコア (§12.3)","比較候補の表示契約 (§12.4)","Comparison Service を単一正本にする (完了条件 A4)","報酬非依存ランキング (原則 5.6)"]
scope_out: ["比較表の記事本文への埋め込み表現 (feat-reader-surface)","価格の実取得 (feat-product-intelligence)"]
acceptance: ["同じ入力を UI・AI・WebMCP へ渡すと比較結果の差分がゼロになる","報酬額を変えても並び順が変わらないことがテストで確認できる","比較候補が分類ラベル付きで表示される","ランキング根拠が各候補に表示される"]
architecture_refs: ["arch-system-spec-overview"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-comparison-engine.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":"0615d70d74973bac98929d7e3ce7b444933ac7e7280718ebbb74b8fef7676ca6","evaluator":"assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-report.json"}
source_lineage: {"imported_at":"2026-08-16T12:20:00Z","origin_kind":"generated","source_digest":"9185b196b216a5e9fc5b874144bcf74912551a9ddc28a9f3be115b6e09833c92","source_path":"docs/spec/01-要求仕様書-v1.0.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved product specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-comparison-engine.md","confidence":0.94}]
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

読者が選べるように、同一商品・別販売店・代替品などの比較候補を根拠付きで並べる

## 到達状態

ある商品から比較候補が分類別に抽出され、報酬額に影響されない比較スコアで並び、UI・AI・WebMCP のどこから見ても同じ結果になる

## スコープ

- スコープ内:
  - 比較候補の分類 (§12.2)
  - 比較スコア (§12.3)
  - 比較候補の表示契約 (§12.4)
  - Comparison Service を単一正本にする (完了条件 A4)
  - 報酬非依存ランキング (原則 5.6)
- スコープ外:
  - 比較表の記事本文への埋め込み表現 (feat-reader-surface)
  - 価格の実取得 (feat-product-intelligence)

## 受入

- [ ] 同じ入力を UI・AI・WebMCP へ渡すと比較結果の差分がゼロになる
- [ ] 報酬額を変えても並び順が変わらないことがテストで確認できる
- [ ] 比較候補が分類ラベル付きで表示される
- [ ] ランキング根拠が各候補に表示される

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview
- 参照理由: 確定済み system-spec (8章) の実装投影を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: feat-product-intelligence
- 依存理由: 商品が一意に識別されていないと、比較候補の抽出対象を確定できない

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
