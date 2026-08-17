---
graph_node_id: "task-test-type-coverage"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["quality","testing"]
priority: "high"
start_date: "2026-08-17"
target_date: null
iteration: null
title: "テスト種別の網羅と、要件ごとの必須種別ゲート"
owners: ["daishiman"]
created_at: "2026-08-17T11:00:00Z"
updated_at: "2026-08-17T11:00:00Z"
status: "draft"
depends_on: ["task-test-tier-design","task-mutation-property-testing"]
related_nodes: []
resource_scope: ["docs","scripts","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"現在の 7 種類は目盛りとして粗く、等価分割・境界値・禁止遷移・権限の「できてはいけない側」などが区別できない","mvp_fit":"enabling","purpose":"やっている種別とやっていない種別を、正直に見える形にする","rationale":"全種別を今すぐ 100% やる必要は無い。やっていないものを「やった」と書かないことが要件である"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-test-type-coverage.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T11:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/spec/10-テスト戦略仕様.md","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "利用者からのテスト戦略の要求を作業単位として登録"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-test-type-coverage.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":"manual","status":"in_progress"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

テストの**種別**を表にして、どれをやっていて・どれをやっていないかを
正直に見える形にする。そのうえで、要件ごとに必須の種別を決め、
**新しい要件に必須種別が欠けていたら CI で落とす**。

## 背景

いまの 7 種類（`docs/spec/10-テスト戦略仕様.md` §3）は網羅の目盛りとしては粗い。
「結合テストがある」と書けても、それが等価分割なのか境界値なのか、
禁止された遷移を試しているのかは分からない。

**全種別を今すぐ 100% やる必要は無い。**
やっていない種別を「やった」と書かないことが要件である。

## 入力と前提条件

- N（段の設計）と L（ミューテーション・プロパティベース）の完了

## 出力と成果物

### M-1 種別ごとの表（対象 / 実施方法 / 自動化 / CI 上の位置づけ）

- 構造的: 命令網羅・分岐網羅・条件網羅・パス網羅
- ブラックボックス
  - 等価分割と境界値（**すべての入力欄**について）
  - 判定表（デシジョンテーブル）
  - 状態遷移表（**許可された遷移と禁止された遷移の両方**）
  - ペアワイズ組み合わせ
  - シナリオテスト
- 層ごと
  - API 契約テスト（スキーマから生成する）
  - DB テスト（マイグレーションの往復、制約、同時実行、テナント分離）
  - インフラ・設定のテスト
  - 画面 / E2E / キーボード / フォーカス
  - 見た目の回帰（配色 5 系統 × 明暗 2 通り）
- 非機能
  - 性能（N+1 の検出を含む）、負荷
  - 信頼性（冪等性、障害注入）
  - WCAG 2.2 AA
  - 互換性、多言語
- セキュリティ
  - 権限マトリクス（**できてはいけない側を含む**）
  - ID 直指定によるテナント越境
  - インジェクション、**プロンプトインジェクション**、SSRF
  - 秘密情報の漏れ、画面の写しの黒塗りの焼き込み
  - 依存の監査、CSRF、回数制限、操作の記録
- 探索的（チャーター方式。結果を機能 K の改善要望へ流す）
- 回帰（**再現テストの無い修正を認めない**）

### M-2 要件ごとの必須種別

- 要件 1 つずつに必須の種別を決め、除外には理由を書く
- **新しい要件に必須種別が欠けていたら CI が落ちる**

### M-3 変更容易性シナリオごとに「落ちるべきテスト」を定義する

- 機能を足すときのチェックリストを作る

## 依存関係

`task-test-tier-design`（N）と `task-mutation-property-testing`（L）の後。

## 実装対象

- `docs/spec/10-テスト戦略仕様.md`
- `docs/product/traceability.md`
- `scripts/required-test-types.mjs`（新規。M-2 のゲート）
- `tests/` 各所

## Write scope と競合制約

`docs/` / `scripts/` / `tests/`。

## GitHub publication

`local_only`。

## 実行手順

1. 種別の表を作り、**現況を正直に埋める**（未実施は未実施と書く）
2. 要件ごとの必須種別を決める
3. 欠けを検出するゲートを作る
4. 欠けている種別を、影響の大きい順に埋めていく

## 受入条件

- 種別ごとの現況一覧が公開されていて、未実施が未実施と書かれている
- 新しい要件に必須種別が欠けたとき CI が落ちる
- 変更容易性シナリオごとに「落ちるべきテスト」が定義されている

## 検証方法

必須種別を欠いた要件を一時的に足し、ゲートが落ちることを実測する。

## リスクとロールバック

文書とゲートの追加が中心。既存テストを消さない。

## Handoff

埋まっていない種別は残課題として残し、状態を偽らない。
