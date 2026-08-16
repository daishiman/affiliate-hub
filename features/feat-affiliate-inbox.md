---
graph_node_id: "feat-affiliate-inbox"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "ingestion"
tags: ["inbox","url","import","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "アフィリエイトURL受信箱"
owners: ["daishiman"]
created_at: "2026-08-16T12:20:00Z"
updated_at: "2026-08-16T12:20:00Z"
status: "draft"
depends_on: ["feat-auth-workspace"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "ばらばらに配られるアフィリエイトURLを一箇所へ集め、処理状態を見失わないようにする"
goal: "URL貼り付け・CSV・API・WebMCP の各経路から URL を登録でき、重複検出と分類を経て未処理/処理中/確認待ち/完了の状態が追える"
scope_in: ["URL 貼り付け・CSV インポート・API 登録・WebMCP 送信","原本URLと正規化URLの二重保存 (§10.1)","重複検出とURL分類","リンク状態確認","商品候補表示","処理状態管理"]
scope_out: ["商品情報の本格的な取得と正規化 (feat-product-intelligence)","ブラウザー拡張の配布"]
acceptance: ["同じURLを二度登録すると重複として検出され新規レコードが増えない","登録直後の状態が未処理として一覧に出る","CSV を取り込むと件数と失敗行が結果として表示される","取得禁止事項 (§10.4) に該当する取得を行わない"]
architecture_refs: ["arch-system-spec-overview"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-affiliate-inbox.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":"0615d70d74973bac98929d7e3ce7b444933ac7e7280718ebbb74b8fef7676ca6","evaluator":"assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-report.json"}
source_lineage: {"imported_at":"2026-08-16T12:20:00Z","origin_kind":"generated","source_digest":"9185b196b216a5e9fc5b874144bcf74912551a9ddc28a9f3be115b6e09833c92","source_path":"docs/spec/01-要求仕様書-v1.0.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved product specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-affiliate-inbox.md","confidence":0.94}]
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

ばらばらに配られるアフィリエイトURLを一箇所へ集め、処理状態を見失わないようにする

## 到達状態

URL貼り付け・CSV・API・WebMCP の各経路から URL を登録でき、重複検出と分類を経て未処理/処理中/確認待ち/完了の状態が追える

## スコープ

- スコープ内:
  - URL 貼り付け・CSV インポート・API 登録・WebMCP 送信
  - 原本URLと正規化URLの二重保存 (§10.1)
  - 重複検出とURL分類
  - リンク状態確認
  - 商品候補表示
  - 処理状態管理
- スコープ外:
  - 商品情報の本格的な取得と正規化 (feat-product-intelligence)
  - ブラウザー拡張の配布

## 受入

- [ ] 同じURLを二度登録すると重複として検出され新規レコードが増えない
- [ ] 登録直後の状態が未処理として一覧に出る
- [ ] CSV を取り込むと件数と失敗行が結果として表示される
- [ ] 取得禁止事項 (§10.4) に該当する取得を行わない

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview
- 参照理由: 確定済み system-spec (8章) の実装投影を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: feat-auth-workspace
- 依存理由: テナント境界とブランド既定値が決まらないと、後続のどのデータにも所有者を付けられない

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
