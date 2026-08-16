---
graph_node_id: "spec-analytics-foundation"
artifact_kind: "specification"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "specification"
tags: ["spec-canonicalization","mvp"]
priority: null
start_date: "2026-08-16"
target_date: null
iteration: null
title: "Analytics基盤仕様の投影"
owners: ["daishiman"]
created_at: "2026-08-16T11:19:17Z"
updated_at: "2026-08-16T11:19:24.125655Z"
status: "draft"
depends_on: []
related_nodes: ["spec-product-requirements","spec-gap-ledger"]
resource_scope: ["docs/spec/03-分析・解析基盤仕様.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "specs/spec-analytics-foundation.md"
template_id: "specification"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-16T11:19:17Z","origin_kind":"manual","source_digest":"ed96924f70ef11408017b70c38c51dad3af3c82b4f02740965aa7cccaa7263ec","source_path":"docs/spec/03-分析・解析基盤仕様.md","source_plugin":null,"source_version":"1.0.0"}
classification_confidence: 0.92
classification_reason: "specification projection of docs/spec/03-分析・解析基盤仕様.md"
classification_candidates: [{"artifact_kind":"specification","candidate_path":"specs/spec-analytics-foundation.md","confidence":0.92}]
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

どの情報・切り口・媒体・配置がクリックと成果に効くかを、計測から提案まで一つの契約で管理する。成功時はフィールド、状態、計算式、SLO の正本が 03 だけになる。

## スコープ

- In: TrackingLink、Redirect、イベント、Conversion、KPI、Attribution、Experiment、Insight
- Out: 読者向け記事本文の書き方、Auth 実装、Phase 0 公開ゲートの項目追加

## 用語と主体

| Term/Actor | Definition/Responsibility |
|---|---|
| AffiliateLink | ASP リンク原本。改変しない |
| TrackingLink | 掲載位置ごとの計測 URL |
| Conversion | 成果。承認軸と支払軸を分離する |
| MetricRollup | 日次集計。生イベントから再計算できる |

## ユースケースとユーザーフロー

1. 公開面のリンクが /go/{id} を経由する
2. resolver が原本へ 302 し、ClickEvent を Queue へ送る
3. 成果を取り込み、last-click で突合し、KPI を表示する

## 機能要件

- FR-ANA-01: 掲載位置単位でクリックを計測できる
- FR-ANA-02: 成果は承認と支払を混ぜない
- FR-ANA-03: 計測障害だけで許可済み転送を止めない

## 非機能要件

- Performance: 有効 resolver の edge p95 150ms 以下
- Availability/Reliability: 302 成功率 99.95% 以上（初期 SLO）
- Accessibility/Usability: 有意差前の勝ち宣言を UI がさせない
- Security/Privacy: 同意前は識別子を残さない
- Maintainability/Operability: KPI 式を画面ごとに複製しない

## UI・状態遷移

- TrackingLink: draft / activating / active / direct_only / disabled / expired
- Conversion 承認軸: pending / approved / rejected / cancelled
- Conversion 支払軸: not_eligible / unpaid / scheduled / paid / reversed

## ビジネスルールと検証

- BR-001: publication 公開時に TrackingLink.publication_id は非 null
- BR-002: paid は approved のときだけ許可
- BR-003: 既定アトリビューションは last-click

## API契約

N/A: 公開 HTTP 契約は Redirect の GET /go/{id} のみを 03 が定義する。実装は未着手。

## データモデル

- 正本は 03 の YAML 契約
- 現行 D1 に ClickEvent / TrackingLink / MetricRollup はない
- Editorial へ収益明細を送らない

## 認証・認可

- 計測エンドポイントは読者向けでログイン不要
- 管理 API は Workspace 権限。現状なし
- tenant 条件のない集計は禁止

## エラー・例外・回復

- resolver miss は 404、停止は 410。転送先を推測しない
- Queue 失敗時も 302 を維持し、欠損を別メトリクで見る

## イベント・非同期処理

- Producer: Redirect。Consumer: Queue worker が Analytics D1 へ append
- 配送は transport 冪等と行動上の重複を分離する

## 可観測性

- 302 数と D1 永続化 unique event を UTC 日で突合
- 日次欠損推定率 0.1% 未満

## 互換性・移行・リリース

- SLO は version を上げて変更し、過去判定を書き換えない
- 実装は not_started に近い partial

## テストと受入条件

- AC-001: 03 と 01 / 02 が競合したら 03 を採用する
- ANA-AC-01〜17 は未検証

## 未決事項

- リダイレクトドメインをサイトごとにするか共通にするか
- 保持期間のプラン差
