---
graph_node_id: "SYS-AUTH-WORKSPACE-P05"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-auth-workspace"
domain: "backend"
tags: ["p05","feat-auth-workspace"]
priority: null
start_date: null
target_date: null
iteration: null
title: "Better Auth・Workspace・RBAC 実装"
owners: ["daishiman"]
created_at: "2026-08-16T12:39:37Z"
updated_at: "2026-08-16T13:01:28.069852Z"
status: "active"
depends_on: ["SYS-AUTH-WORKSPACE-P04"]
related_nodes: []
resource_scope: ["src/lib/auth/","src/middleware.ts","src/lib/workspace/","src/lib/brand/","src/lib/rbac/","drizzle/schema/","src/app/api/"]
purpose: "Better Auth + Google OAuth のサインイン、Workspace/Brand の作成・切替、全テーブルへの workspace_id 付与、ロール別操作制限を実装し、P04 で設計した4テストが緑化する状態を成立させる。"
goal: "Better Auth + Google OAuth のサインイン、Workspace/Brand の作成・切替、全テーブルへの workspace_id 付与、ロール別操作制限を実装し、P04 で設計した4テストが緑化する状態を成立させる。"
scope_in: ["Produced artifacts: src/lib/auth/ (Better Auth 設定・Google OAuth), src/middleware.ts (未ログイン時のログイン画面遷移), src/lib/workspace/ (Workspace/Brand 作成・切替・workspace_id スコープ), src/lib/rbac/ (ロール判定・403応答), drizzle/schema/ (全テーブルへの workspace_id 列)","Consumed artifacts: src/lib/auth/__tests__/*, src/lib/workspace/__tests__/*, src/lib/brand/__tests__/*, src/lib/rbac/__tests__/*","Write scope/touches: src/lib/auth/, src/middleware.ts, src/lib/workspace/, src/lib/brand/, src/lib/rbac/, drizzle/schema/, src/app/api/"]
scope_out: ["feat-auth-workspace の scope_out (外部プラットフォームのアカウント接続, 課金, SSO/SCIM) に該当する変更","write_scope 外のパスへの変更"]
acceptance: ["Automated commands: `pnpm run preview` (Workers ランタイム, localhost:8787) 上で P05 に対応する検証コマンドを実行する","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-auth-workspace` (本 package の C12 決定論検証を世代非依存に再実行する)","Required evidence: P05 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-system-spec-overview"]
parent_feature: "feat-auth-workspace"
feature_package_id: "feature-package/feat-auth-workspace"
phase_ref: "P05"
file_path: "tasks/feat-auth-workspace/sys-auth-workspace-p05.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"35483f66bb1988fc2b3ede65937a16e41d29637c455a092e3fa463c0c90fbb0c","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-auth-workspace/35483f66bb1988fc2b3ede65937a16e41d29637c455a092e3fa463c0c90fbb0c/plan-findings.json"}
source_lineage: {"imported_at":"2026-08-16T12:39:37Z","origin_kind":"system-dev-planner","source_digest":"35483f66bb1988fc2b3ede65937a16e41d29637c455a092e3fa463c0c90fbb0c","source_path":".dev-graph/published/generations/feature-package-feat-auth-workspace/35483f66bb1988fc2b3ede65937a16e41d29637c455a092e3fa463c0c90fbb0c/task-specs/phase-05-implementation.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-auth-workspace の P05 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-auth-workspace/sys-auth-workspace-p05.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-361.5","github_mirror":null,"linked_at":"2026-08-16T13:00:16Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-16T21:00:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: Better Auth・Workspace・RBAC 実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-auth-workspace
- owners: ["daishiman"]
- tags: ["p05", "feat-auth-workspace"]
- related_nodes: []
- parent_feature: feat-auth-workspace
- phase_ref: P05
- classification: confidence=1.0; reason=feat-auth-workspace の P05 lifecycle 責務への確定写像; candidate=tasks/feat-auth-workspace/sys-auth-workspace-p05.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

Better Auth + Google OAuth のサインイン、Workspace/Brand の作成・切替、全テーブルへの workspace_id 付与、ロール別操作制限を実装し、P04 で設計した4テストが緑化する状態を成立させる。

## 背景

system-spec/auth.md の Better Auth/Google OAuth 契約、system-spec/database.md の workspace_id/§26.4 テナント分離契約、system-spec/security.md の403制御契約を、Next.js 16 + OpenNext + Cloudflare Workers/D1 + Drizzle ORM 上に実装する。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-auth-workspace, system-spec/auth.md, system-spec/security.md, system-spec/database.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: N/A: intra-feature depends_on gate
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 未ログイン時のログイン画面遷移 (A1) と Workspace/Brand 切替 UI を実装する
- Backend: applicable; Better Auth セッションと workspace_id スコープ middleware を実装する
- API: applicable; 別 Workspace データを返さない API (A2) と権限なしロールの403応答 (A4) を実装する
- Data: applicable; 全テーブルへの workspace_id 付与 (§26.4) と標準CTA/標準免責の既定値カラムを実装する (A3)
- Infrastructure: N/A: 既存 Cloudflare Workers/D1/R2 デプロイ単位を変更せず、その上でアプリケーションコードのみ変更する
- Security: applicable; ロールと権限 (§25) に基づく 403 制御を実装する
- Quality: applicable; P04 の4テストが緑化することを実装完了条件とする
- Documentation: N/A: 実装フェーズであり文書更新は P12/P13 で扱う
- Operations: N/A: 運用手順は P12/P13 で扱う

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, system-spec/auth.md, system-spec/security.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: §26.4 workspace_id backfill は P08 が所有する

## 成果物

- Produced artifacts: src/lib/auth/ (Better Auth 設定・Google OAuth), src/middleware.ts (未ログイン時のログイン画面遷移), src/lib/workspace/ (Workspace/Brand 作成・切替・workspace_id スコープ), src/lib/rbac/ (ロール判定・403応答), drizzle/schema/ (全テーブルへの workspace_id 列)
- Consumed artifacts: src/lib/auth/__tests__/*, src/lib/workspace/__tests__/*, src/lib/brand/__tests__/*, src/lib/rbac/__tests__/*
- Write scope/touches: src/lib/auth/, src/middleware.ts, src/lib/workspace/, src/lib/brand/, src/lib/rbac/, drizzle/schema/, src/app/api/

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-AUTH-WORKSPACE-P05; default branch target
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-AUTH-WORKSPACE-P05; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-AUTH-WORKSPACE-P05 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on=['P04']の完了 + resource_scope (feat-auth-workspace 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-auth-workspace の scope_out (外部プラットフォームのアカウント接続, 課金, SSO/SCIM) に該当する変更
- write_scope 外のパスへの変更

## テスト戦略

- テストレベル選定: 単体: workspace_id 判定・ロール判定関数の単体テストを実装と同時に緑化する。結合: 認証→Workspace解決→RBAC→DB参照の結合テストを緑化する。境界値: 未ログイン/他Workspace/権限なしロールの境界テストを緑化する。回帰: 既存テストスイートを0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/lib/auth, src/lib/workspace, src/lib/rbac) に適用する。
- 層別方針: フロントエンド: behavior ベースでログイン遷移・Workspace切替の振る舞いテストを緑化する。バックエンド/API/データ: API 契約 + ロジック単体 + DB 結合でworkspace_id分離・標準値受渡し・403判定を実装検証する。
- 保守性制約: pixel 位置依存・DOM 構造依存のテストを禁止し、リダイレクト先・レスポンスステータス・データのworkspace_id属性など振る舞い検証に限定する。middleware 内部実装詳細への密結合テストを作らない。

## Verification and evidence

- Automated commands: `pnpm run preview` (Workers ランタイム, localhost:8787) 上で P05 に対応する検証コマンドを実行する
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-auth-workspace` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P05 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: Better Auth + Google OAuth のサインイン、Workspace/Brand の作成・切替、全テーブルへの workspace_id 付与、ロール別操作制限を実装し、P04 で設計した4テストが緑化する状態を成立させる。
- Generic execution prompt: feat-auth-workspace の goal (Google ログインでサインインし、Workspace/Brandを作成でき、全データがworkspace_idで分離され、ロールに応じた操作制限が効いている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P05 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装→独立評価 (P03/P09/P10相当)→findingをGeneric execution promptへ反映→再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止しP01..現phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P05 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P05 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 4受け入れ条件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/auth.md, system-spec/security.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md
- Feature: feat-auth-workspace
- Phase doc: system-plan-phase-names.md#P05
- Dependencies: SYS-AUTH-WORKSPACE-P04

## 実行契約

- source spec: 昇格済み generation の task spec 本文 (byte-for-byte 不変)
- verification: published task spec の Automated commands
- rerun: published task spec 内の `validate-system-plan.py --repo-root . --staging .` は repository root から解決できない。再検証は世代非依存の `python3 plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-auth-workspace` を使い、current pointer から現行世代を再解決する。
