---
graph_node_id: "feat-compliance-disclosure"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "compliance"
tags: ["disclosure","compliance","legal","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "広告表示・コンプライアンス"
owners: ["daishiman"]
created_at: "2026-08-16T12:20:00Z"
updated_at: "2026-08-16T12:20:00Z"
status: "draft"
depends_on: ["feat-affiliate-hub"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "広告であることの表示を、記事・AI回答・WebMCP のどこから見ても同じにする"
goal: "Disclosure を単一の正本から取得し、必須表示・表示場所・比較/ランキングの表示規律が全経路で一致する"
scope_in: ["必須表示 (§20.1)","表示場所 (§20.2)","比較・ランキング表示規律 (§20.3)","Disclosure Service を単一正本にする (完了条件 A5)","ステマ規制・景表法対応の表示"]
scope_out: ["法務レビューそのもの","各国語の法令差分対応"]
acceptance: ["記事・AI回答・WebMCP の3経路が同じ Disclosure 文言を返す","アフィリエイトリンクを含む記事で表示が省略できない","ランキング記事に評価基準の記載が必須になる","Disclosure の定義が1ファイルにしか存在しないことが静的検査で確認できる"]
architecture_refs: ["arch-system-spec-overview"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-compliance-disclosure.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":"0615d70d74973bac98929d7e3ce7b444933ac7e7280718ebbb74b8fef7676ca6","evaluator":"assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-report.json"}
source_lineage: {"imported_at":"2026-08-16T12:20:00Z","origin_kind":"generated","source_digest":"9185b196b216a5e9fc5b874144bcf74912551a9ddc28a9f3be115b6e09833c92","source_path":"docs/spec/01-要求仕様書-v1.0.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved product specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-compliance-disclosure.md","confidence":0.94}]
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

広告であることの表示を、記事・AI回答・WebMCP のどこから見ても同じにする

## 到達状態

Disclosure を単一の正本から取得し、必須表示・表示場所・比較/ランキングの表示規律が全経路で一致する

## スコープ

- スコープ内:
  - 必須表示 (§20.1)
  - 表示場所 (§20.2)
  - 比較・ランキング表示規律 (§20.3)
  - Disclosure Service を単一正本にする (完了条件 A5)
  - ステマ規制・景表法対応の表示
- スコープ外:
  - 法務レビューそのもの
  - 各国語の法令差分対応

## 受入

- [ ] 記事・AI回答・WebMCP の3経路が同じ Disclosure 文言を返す
- [ ] アフィリエイトリンクを含む記事で表示が省略できない
- [ ] ランキング記事に評価基準の記載が必須になる
- [ ] Disclosure の定義が1ファイルにしか存在しないことが静的検査で確認できる

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview
- 参照理由: 確定済み system-spec (8章) の実装投影を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: feat-affiliate-hub
- 依存理由: 計測URLと成果の記録が無いとクリックと成果の突合ができない

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
