---
graph_node_id: "spec-gap-ledger"
artifact_kind: "specification"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "specification"
tags: ["spec-canonicalization","mvp"]
priority: null
start_date: "2026-08-16"
target_date: null
iteration: null
title: "ギャップと未決事項の投影"
owners: ["daishiman"]
created_at: "2026-08-16T11:19:17Z"
updated_at: "2026-08-16T11:19:25.035203Z"
status: "draft"
depends_on: []
related_nodes: ["spec-product-requirements","spec-reader-surface"]
resource_scope: ["docs/spec/02-補充仕様-ギャップと追加要件.md"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "specs/spec-gap-ledger.md"
template_id: "specification"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-16T11:19:17Z","origin_kind":"manual","source_digest":"73b3204fcb5c71edf4704817b12af2d36939993ba1194bf04c1f4ceff9c8cd25","source_path":"docs/spec/02-補充仕様-ギャップと追加要件.md","source_plugin":null,"source_version":"1.0.0"}
classification_confidence: 0.92
classification_reason: "specification projection of docs/spec/02-補充仕様-ギャップと追加要件.md"
classification_candidates: [{"artifact_kind":"specification","candidate_path":"specs/spec-gap-ledger.md","confidence":0.92}]
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

v1.0 で欠けていた非 Analytics 要件と未決事項を、本文を増やさずに追跡できる。成功時は未決が 02 §9 に集まり、Analytics 詳細は 03 へ移行済みと分かる。

## スコープ

- In: ギャップの要約、コンプライアンス、運用、未決事項、Phase 0 文書との関係
- Out: クリック計測のフィールド定義、読者面の公開ゲート詳細

## 用語と主体

| Term/Actor | Definition/Responsibility |
|---|---|
| 移行記録 | 以前 02 にあった Analytics 詳細を 03 へ移したことを示す要約 |
| Phase 0 文書 | ai-first-webmcp / data-model-gap / completion-criteria |

## ユースケースとユーザーフロー

1. 実装者が不足要件を探す
2. Analytics なら 03、それ以外なら 02、読者面なら Phase 0 文書へ進む

## 機能要件

- FR-001: TrackingLink と Conversion の欠落を移行記録として残す
- FR-002: 未決事項を 1 か所で管理する
- FR-003: Phase 0 文書を削除せず関心を分離する

## 非機能要件

- Maintainability/Operability: 詳細本文を 02 に再複製しない
- Security/Privacy: 同意とリンク属性の補充を保持する

## UI・状態遷移

N/A: 台帳文書であり画面状態を定義しない。

## ビジネスルールと検証

- BR-001: Analytics の数値が 02 と 03 で違うときは 03 を使う

## API契約

N/A: API 変更なし。

## データモデル

- 追加概念の一覧だけを持ち、フィールドは 03 を指す
- ConsentRecord / NotificationRule / RateBudget は未実装

## 認証・認可

N/A: 認証方式の決定は system-spec/auth.md。

## エラー・例外・回復

- 障害時の転送継続は 03 §1 を正とする

## イベント・非同期処理

N/A: イベント正本は 03。

## 可観測性

- 未決事項の増減をレビュー時に確認する

## 互換性・移行・リリース

- document_status は draft
- Phase 1 マージ後に §10 を追加した

## テストと受入条件

- AC-001: 02 に TrackingLink のフィールド一覧を再掲していない
- AC-002: Phase 0 の 3 文書が残っている

## 未決事項

- 02 §9 の未決 1, 4, 5 が open
