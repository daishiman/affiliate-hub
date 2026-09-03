---
graph_node_id: "feat-auth-workspace"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "platform"
tags: ["auth","workspace","tenant","prototype-all-features"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "認証とWorkspace/Brand基盤"
owners: ["daishiman"]
created_at: "2026-08-16T12:20:00Z"
updated_at: "2026-08-24T13:18:15Z"
status: "closed"
depends_on: []
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "利用者が自分のテナントとブランド設定の中だけで安全に作業できる土台をつくる"
goal: "Google ログインでサインインし、Workspace と Brand を作成でき、全データが workspace_id で分離され、ロールに応じた操作制限が効いている"
scope_in: ["Better Auth + Google OAuth","Workspace / Brand の作成と切替","ブランド設定 (色・ロゴ・表示名・運営会社・編集方針・禁止表現・標準CTA・標準免責・言語・タイムゾーン)","ロールと権限 (§25)","全テーブルへの workspace_id 付与とテナント分離 (§26.4)"]
scope_out: ["外部プラットフォームのアカウント接続","課金","SSO / SCIM"]
acceptance: ["未ログインで管理画面を開くとログイン画面へ遷移する","別 Workspace のデータが一覧・詳細・API のいずれからも取得できない","ブランド設定の標準CTAと標準免責が記事生成の既定値として渡る","権限のないロールが公開操作を実行すると 403 になる"]
architecture_refs: ["arch-system-spec-overview"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-auth-workspace.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"35483f66bb1988fc2b3ede65937a16e41d29637c455a092e3fa463c0c90fbb0c","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-auth-workspace/35483f66bb1988fc2b3ede65937a16e41d29637c455a092e3fa463c0c90fbb0c/plan-findings.json"}
source_lineage: {"imported_at":"2026-08-16T12:20:00Z","origin_kind":"generated","source_digest":"b5fc60987cb79c08c30db4cd94b075a0bf89cd7acba7c8d1ffc8558af6439385","source_path":"docs/spec/01-要求仕様書-v1.0.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.94
classification_reason: "C14 macro decomposition of the approved product specification into feature-level units"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-auth-workspace.md","confidence":0.94}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-361","github_mirror":null,"linked_at":"2026-08-16T13:00:16Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-16T21:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

利用者が自分のテナントとブランド設定の中だけで安全に作業できる土台をつくる

## 到達状態

Google ログインでサインインし、Workspace と Brand を作成でき、全データが workspace_id で分離され、ロールに応じた操作制限が効いている

## スコープ

- スコープ内:
  - Better Auth + Google OAuth
  - Workspace / Brand の作成と切替
  - ブランド設定 (色・ロゴ・表示名・運営会社・編集方針・禁止表現・標準CTA・標準免責・言語・タイムゾーン)
  - ロールと権限 (§25)
  - 全テーブルへの workspace_id 付与とテナント分離 (§26.4)
- スコープ外:
  - 外部プラットフォームのアカウント接続
  - 課金
  - SSO / SCIM

## 受入

- [x] 未ログインで管理画面を開くとログイン画面へ遷移する（ローカル受入。Workers 実 HTTP は未検証）
- [x] 別 Workspace のデータが一覧・詳細・API のいずれからも取得できない
- [x] ブランド設定の標準CTAと標準免責が記事生成の既定値として渡る（ブランド 1 件時）
- [x] 権限のないロールが公開操作を実行すると 403 になる

MVP の実装受入は完了。Google OAuth の実往復、本番 Secrets、dev / production D1 migration はリリース検証であり、本 feature のローカル完了証跡とは分けて `docs/spec/feat-auth-workspace/release-notes.md` §7 に残す。

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview
- 参照理由: 確定済み system-spec (8章) の実装投影を単一の architecture context として参照し、本文を複製しない

## 機能間依存

- `depends_on`: (なし)
- 依存理由: 本 feature は依存を持たない起点であり、テナントと権限の土台を最初に固定する

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入を満たすときだけ done とする
