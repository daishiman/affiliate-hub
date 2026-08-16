---
graph_node_id: "arch-spec-governance"
artifact_kind: "architecture"
artifact_subtypes: ["data","backend"]
project_id: "affiliate-hub"
domain: "specification"
tags: ["spec-canonicalization","mvp"]
priority: null
start_date: "2026-08-16"
target_date: null
iteration: null
title: "仕様正本とドメイン分離のアーキテクチャ"
owners: ["daishiman"]
created_at: "2026-08-16T11:19:17Z"
updated_at: "2026-08-16T11:19:22.317390Z"
status: "draft"
depends_on: []
related_nodes: ["feat-spec-canonicalization","spec-product-requirements","spec-analytics-foundation"]
resource_scope: ["docs/spec","system-spec","src/db/schema.ts"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "architecture/arch-spec-governance.md"
template_id: "architecture"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.92
classification_reason: "data and backend boundaries for operator vs reader domains"
classification_candidates: [{"artifact_kind":"architecture","candidate_path":"architecture/arch-spec-governance.md","confidence":0.92}]
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

# Architecture overview

本リポジトリは 1 つの Cloudflare Workers アプリの中に、発信者向け案件管理と読者向け比較メディアを同居させる。データは単一 D1 に置くが、所有境界は混ぜない。計測と収益は Commercial、記事と根拠は Editorial として扱う。

## Context and drivers

- 既存実装は運営者向け ASP / 案件 / 成果の 3 テーブルと MCP である
- Phase 1 で読者向け記事・商品・公開ゲートが追加された
- 要求文書が複数あり、同じ Analytics 契約が複製されると drift する
- 品質優先度は境界の明確さ、テナント分離、報酬データの読者面非混入

## Goals and non-goals

- Goals: 関心ごとの正本を一つにする。実装投影は system-spec に閉じる。運営者ドメインと読者ドメインをスキーマ上でも文書上でも分離する
- Non-goals: この変更で Auth、2 D1 分離、Redirect、Insight を実装しない

## System context and boundaries

- 利用者: 発信者（非公開の案件・成果）、読者（公開の比較記事）、エージェント（MCP / WebMCP）
- 信頼境界: Worker の環境分離（dev / production）、MCP_TOKEN、公開ゲート
- データ境界: 運営者テーブルと読者テーブル。ランキング計算は報酬テーブルを参照しない

## Container and component view

| Container | Responsibility | Interface | Data owner | Deployment unit |
|---|---|---|---|---|
| Next.js on Workers | UI と公開ゲート | HTTP | なし | affiliate-hub Worker |
| D1 | 永続化 | Drizzle | 単一 DB に両ドメインが同居 | env ごとの D1 |
| R2 | アセット | binding | 公開資産 | env ごとの R2 |
| Remote MCP | 案件・成果操作 | /api/mcp | 運営者ドメイン | 同一 Worker |
| WebMCP | ブラウザエージェント | navigator.modelContext | 読み取り PoC | 同一 Worker |

## Cross-cutting contracts

- Identity/access: 現状は MCP_TOKEN と same-origin。To-Be は Better Auth + Workspace role
- Errors/resilience: リダイレクトは計測障害でも 302 を維持する（未実装、03 が正本）
- Observability/audit: 公開・権限変更・成果修正を AuditLog 対象とする（未実装）
- Configuration/secrets: 環境ごとに Worker / D1 / R2 / MCP_TOKEN を分離
- Compatibility/versioning: マイグレーションは後方互換。削除は 2 段階

## Subtype architecture

- Frontend: N/A: 本変更は文書と正本整理が対象で UI 契約は変えない
- Backend: 下記 Backend architecture
- Infrastructure: N/A: 単一 Worker / 単一 D1 の現状を維持する
- Data: 下記 Data architecture
- Security: N/A: 認証方式の実装は別 feature。方針は system-spec/auth.md

## Architecture decisions

- ADR-01: 正本は docs/spec、実装投影は system-spec。graph の specs/ は要約であり本文を複製しない
- ADR-02: 運営者ドメインと読者ドメインを同一 D1 に置いても、ランキングと報酬を結合しない
- ADR-03: Analytics 詳細は 03 のみ。01 と 02 は目的と移行記録に留める
- ADR-04: Phase 0 の ai-first-webmcp.md は読者面の詳細契約として残す

## Delivery, migration and rollback

- 本変更は文書と graph / beads のみ。スキーマとアプリ動作は origin/main の Phase 1 をそのまま引き継ぐ
- ロールバックは当該 PR の revert。データ移行はない

## Risks and verification

- リスク: 正本が複数あるように見え、実装者が古い文書を更新する
- 緩和: 00-README の優先表と README の仕様節
- 検証: system-spec の coverage / knowledge / source-citation ゲートと graph schema 検証

# Data architecture

## Data domains and ownership

- 運営者ドメイン: asps / programs / conversions。発信者の報酬管理。非公開
- 読者ドメイン: categories / people / disclosures / products / articles ほか。公開比較メディア
- 将来の Commercial: TrackingLink / ClickEvent / Conversion 二軸 / MetricRollup。03 が正本

## Logical and physical model

- 現状は単一 D1。workspace_id はない
- conversions.status は pending / approved / rejected の単軸。支払軸は未実装
- 公開ゲートは記事メタのみ検査する

## Access and consistency

- 運営者データは MCP 経由。読者データは未公開 UI
- テナント横断の repository は禁止する方針だが、実装は未着手
- 分析集計は生イベントから再計算可能にする（未実装）

## Lifecycle and governance

- 記事公開は publish-gate が著者・広告表記・更新責任者・結論・カテゴリー・次回確認日を要求
- 個人情報と同意は 03 §9。現状のクリック計測は未実装
- スキーマ所有は src/db/schema.ts と drizzle マイグレーション

## Migration and recovery

- 0000 が運営者 3 テーブル、0001 が読者ドメイン
- 2 D1 への分割は停止可能な backfill を前提とし、今回はやらない

## Data verification

- ギャップ分析は data-model-gap.md
- 静的にランキング計算が報酬テーブルへ到達しないことを将来のテスト方針とする

# Backend architecture

## Runtime and architecture pattern

- Next.js 16 + OpenNext + Cloudflare Workers
- パターンは単一 Worker 上の薄いサービス。ドメインサービスを経路ごとに複製しない

## Domain and module boundaries

- 運営者 MCP ツールは src/lib/mcp
- 読者公開ゲートは src/lib/content/publish-gate.ts
- 依存方向: 公開面は報酬テーブルを読まない

## API and service contracts

- Remote MCP 3 ツール（list_programs / record_conversion / get_revenue_summary）
- WebMCP は読み取り PoC
- 正式な Analytics API と Redirect は未実装

## Data and transaction behavior

- Drizzle 経由で単一 D1
- Conversion 再取込の冪等は external_id があるが非一意。To-Be は 03 の conversion_key

## Async processing

- To-Be は Cloudflare Queue で ClickEvent を配送する。現状は同期 PoC のみ

## Security and resilience

- MCP_TOKEN。To-Be は Better Auth + 最小権限ロール
- リダイレクトはオープンリダイレクトを禁止し、登録済み https 原本だけを返す

## Operations and verification

- CI は lint / build / typecheck / 未生成マイグレーション検出
- 本変更の検証は文書ゲートと graph schema
