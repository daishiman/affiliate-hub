---
graph_node_id: "spec-product-requirements"
artifact_kind: "specification"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "specification"
tags: ["spec-canonicalization","mvp"]
priority: null
start_date: "2026-08-16"
target_date: null
iteration: null
title: "プロダクト要求の投影"
owners: ["daishiman"]
created_at: "2026-08-16T11:19:17Z"
updated_at: "2026-08-16T11:19:23.123530Z"
status: "draft"
depends_on: []
related_nodes: ["spec-gap-ledger","spec-analytics-foundation","feat-spec-canonicalization"]
resource_scope: ["docs/spec/01-要求仕様書-v1.0.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "specs/spec-product-requirements.md"
template_id: "specification"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-16T11:19:17Z","origin_kind":"manual","source_digest":"9185b196b216a5e9fc5b874144bcf74912551a9ddc28a9f3be115b6e09833c92","source_path":"docs/spec/01-要求仕様書-v1.0.md","source_plugin":null,"source_version":"1.0.0"}
classification_confidence: 0.92
classification_reason: "specification projection of docs/spec/01-要求仕様書-v1.0.md"
classification_candidates: [{"artifact_kind":"specification","candidate_path":"specs/spec-product-requirements.md","confidence":0.92}]
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

発信者が一つの商品情報を起点に、複数媒体へ一貫したコンテンツを作り、公開し、改善できる。成功時は目的・用語・スコープの正本が 01 にあり、実装者が迷わない。

## スコープ

- In: プロダクト目的、横断原則、共通用語、全体受入条件
- Out: Analytics のフィールドと計算式、読者面 WebMCP の詳細、実装スキーマ

## 用語と主体

| Term/Actor | Definition/Responsibility |
|---|---|
| 発信者 | 記事とアフィリエイトリンクを運用する利用者 |
| 読者 | 公開面で商品を比較する人 |
| コンテンツパッケージ | 商品・根拠・ペルソナ・媒体別投稿・成果を束ねた単位 |
| Workspace | テナント境界。To-Be では全業務データに必須 |

## ユースケースとユーザーフロー

1. 発信者がアフィリエイト URL を登録する
2. 商品情報と根拠を集め、媒体別に文章を作る
3. 公開し、クリックと成果を見て次の企画に使う

## 機能要件

- FR-001: 一つの信頼できる商品情報を複数媒体で再利用できる
- FR-002: 書き手と読者のペルソナを指定して生成できる
- FR-003: 公開後の成果を同一 Workspace で参照できる

## 非機能要件

- Performance: 公開面のリダイレクトは計測障害でも遅らせない（詳細は 03）
- Availability/Reliability: 環境分離済み。本番と dev は別 D1
- Accessibility/Usability: 通常 UI だけで主要タスクを完了できる
- Security/Privacy: テナント分離と同意管理。現状は未実装
- Maintainability/Operability: 正本を増やさず、投影だけを更新する

## UI・状態遷移

- 現状 UI: 案件一覧のみ
- To-Be: コンテンツ作成、公開、Analytics、Insight
- Loading/Empty/Error: 各画面で空と失敗を隠さない

## ビジネスルールと検証

- BR-001: 報酬額を読者向けランキングの入力に使わない
- BR-002: 広告関係の表示は 1 か所の Disclosure を共有する

## API契約

N/A: 本書は製品要求の正本であり、API 変更の契約は持たない。MCP の現行 3 ツールは実装投影。

## データモデル

- 正本の概念は 01 のコンテンツパッケージ
- 物理テーブルは src/db/schema.ts。本書はスキーマを上書きしない
- 所有と保持は system-spec/database.md

## 認証・認可

- Authentication: To-Be は Better Auth + Google。現状は MCP_TOKEN
- Authorization: Workspace role。現状なし
- Tenant/data boundary: workspace_id。現状なし

## エラー・例外・回復

- 製品要求としては「公開失敗とリンク切れを通知する」
- 詳細な再試行は Connector ごとの RateBudget（未実装）

## イベント・非同期処理

N/A: イベント契約の正本は 03。

## 可観測性

- 監査対象は公開、削除、リンク差し替え、権限変更、成果修正、エクスポート
- 現状の実装証跡はなし

## 互換性・移行・リリース

- 要求 version は 1.0
- 実装は partial。文書更新は 00-README の更新順に従う

## テストと受入条件

- AC-001: 01 を正本として参照したとき、Analytics 詳細を 01 から引かない
- 受入の全数検証は未実施

## 未決事項

- 読者面と発信者面を同一 Workspace でどう接続するかは 02 §9 項 5
