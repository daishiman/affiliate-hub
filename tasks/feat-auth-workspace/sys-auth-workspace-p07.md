---
graph_node_id: "SYS-AUTH-WORKSPACE-P07"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-auth-workspace"
domain: "quality"
tags: ["p07","feat-auth-workspace"]
priority: null
start_date: null
target_date: null
iteration: null
title: "feat-auth-workspace 受け入れ判定"
owners: ["daishiman"]
created_at: "2026-08-16T12:39:37Z"
updated_at: "2026-08-24T12:54:42Z"
status: "closed"
depends_on: ["SYS-AUTH-WORKSPACE-P06"]
related_nodes: []
resource_scope: ["docs/spec/feat-auth-workspace/acceptance-report.md"]
purpose: "P06 のテスト結果を根拠に、feat-auth-workspace の4受け入れ条件 (A1〜A4) がすべて満たされていることをpurpose 由来で判定し、実装完了を確定する。"
goal: "P06 のテスト結果を根拠に、feat-auth-workspace の4受け入れ条件 (A1〜A4) がすべて満たされていることをpurpose 由来で判定し、実装完了を確定する。"
scope_in: ["Produced artifacts: docs/spec/feat-auth-workspace/acceptance-report.md (4条件ごとのPASS/FAIL判定と根拠)","Consumed artifacts: evidence/P06/test-results.json, evidence/P06/coverage-summary.json","Write scope/touches: docs/spec/feat-auth-workspace/acceptance-report.md"]
scope_out: ["feat-auth-workspace の scope_out (外部プラットフォームのアカウント接続, 課金, SSO/SCIM) に該当する変更","write_scope 外のパスへの変更"]
acceptance: ["Automated commands: `pnpm run preview` (Workers ランタイム, localhost:8787) 上で P07 に対応する検証コマンドを実行する","Automated commands: `pnpm vitest run --coverage` (単体/結合/境界値/回帰テストを実行し P07 の証跡を得る)","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-auth-workspace` (本 package の C12 決定論検証を世代非依存に再実行する)","Required evidence: P07 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-system-spec-overview"]
parent_feature: "feat-auth-workspace"
feature_package_id: "feature-package/feat-auth-workspace"
phase_ref: "P07"
file_path: "tasks/feat-auth-workspace/sys-auth-workspace-p07.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"35483f66bb1988fc2b3ede65937a16e41d29637c455a092e3fa463c0c90fbb0c","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-auth-workspace/35483f66bb1988fc2b3ede65937a16e41d29637c455a092e3fa463c0c90fbb0c/plan-findings.json"}
source_lineage: {"imported_at":"2026-08-16T12:39:37Z","origin_kind":"system-dev-planner","source_digest":"35483f66bb1988fc2b3ede65937a16e41d29637c455a092e3fa463c0c90fbb0c","source_path":".dev-graph/published/generations/feature-package-feat-auth-workspace/35483f66bb1988fc2b3ede65937a16e41d29637c455a092e3fa463c0c90fbb0c/task-specs/phase-07-acceptance.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-auth-workspace の P07 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-auth-workspace/sys-auth-workspace-p07.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-361.7","github_mirror":null,"linked_at":"2026-08-16T13:00:16Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-16T21:00:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: feat-auth-workspace 受け入れ判定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-auth-workspace
- owners: ["daishiman"]
- tags: ["p07", "feat-auth-workspace"]
- related_nodes: []
- parent_feature: feat-auth-workspace
- phase_ref: P07
- classification: confidence=1.0; reason=feat-auth-workspace の P07 lifecycle 責務への確定写像; candidate=tasks/feat-auth-workspace/sys-auth-workspace-p07.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P06 のテスト結果を根拠に、feat-auth-workspace の4受け入れ条件 (A1〜A4) がすべて満たされていることをpurpose 由来で判定し、実装完了を確定する。

## 背景

goal-spec.json の acceptance 4項目 (未ログイン遷移/workspace_id分離/標準CTA・標準免責の既定値受渡し/権限なしロールの403) を唯一の合格基準とし、P06 の証跡だけで判定する。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-auth-workspace, system-spec/auth.md, system-spec/security.md, system-spec/database.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: N/A: intra-feature depends_on gate
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 受け入れ判定は P06 証跡 (A1 ログイン遷移の実行結果) の参照のみを行い、コード層を変更しない
- Backend: N/A: 受け入れ判定は P06 証跡 (A2 workspace_id分離の実行結果) の参照のみを行い、コード層を変更しない
- API: N/A: 受け入れ判定は P06 証跡 (A2/A4 API・403応答の実行結果) の参照のみを行い、コード層を変更しない
- Data: N/A: 受け入れ判定は P06 証跡 (A3 標準CTA/標準免責の実行結果) の参照のみを行い、コード層を変更しない
- Infrastructure: N/A: 既存 Cloudflare Workers/D1/R2 基盤を変更しない
- Security: applicable; 権限のないロールの403判定 (A4) の合否を確認する
- Quality: applicable; 4受け入れ条件の総合判定を行う
- Documentation: applicable; 受け入れ判定レポートを作成する
- Operations: N/A: 運用手順は P12/P13 で扱う

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, system-spec/auth.md, system-spec/security.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: §26.4 workspace_id backfill は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-auth-workspace/acceptance-report.md (4条件ごとのPASS/FAIL判定と根拠)
- Consumed artifacts: evidence/P06/test-results.json, evidence/P06/coverage-summary.json
- Write scope/touches: docs/spec/feat-auth-workspace/acceptance-report.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-AUTH-WORKSPACE-P07; default branch target
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-AUTH-WORKSPACE-P07; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-AUTH-WORKSPACE-P07 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on=['P06']の完了 + resource_scope (feat-auth-workspace 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-auth-workspace の scope_out (外部プラットフォームのアカウント接続, 課金, SSO/SCIM) に該当する変更
- write_scope 外のパスへの変更

## テスト戦略

- テストレベル選定: 単体・結合・境界値・回帰は P06 の実行結果を引用するのみで本 task では再実行しない (N/A: 判定作業のみ行い、テストは実行しない)。
- カバレッジ目標: 既定 80% の達成を P06 のカバレッジレポート引用値で確認する。
- 層別方針: N/A: 受け入れ判定は P06 証跡の参照のみを行い、コード層を変更しない。
- 保守性制約: pixel 位置依存・DOM 構造依存の判定基準を用いず、P06 が採用した振る舞いベースの合否基準をそのまま引用する。

## Verification and evidence

- Automated commands: `pnpm run preview` (Workers ランタイム, localhost:8787) 上で P07 に対応する検証コマンドを実行する
- Automated commands: `pnpm vitest run --coverage` (単体/結合/境界値/回帰テストを実行し P07 の証跡を得る)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-auth-workspace` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P07 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: P06 のテスト結果を根拠に、feat-auth-workspace の4受け入れ条件 (A1〜A4) がすべて満たされていることをpurpose 由来で判定し、実装完了を確定する。
- Generic execution prompt: feat-auth-workspace の goal (Google ログインでサインインし、Workspace/Brandを作成でき、全データがworkspace_idで分離され、ロールに応じた操作制限が効いている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P07 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装→独立評価 (P03/P09/P10相当)→findingをGeneric execution promptへ反映→再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止しP01..現phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P07 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P07 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 4受け入れ条件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/auth.md, system-spec/security.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md
- Feature: feat-auth-workspace
- Phase doc: system-plan-phase-names.md#P07
- Dependencies: SYS-AUTH-WORKSPACE-P06

## 実行契約

- source spec: 昇格済み generation の task spec 本文 (byte-for-byte 不変)
- verification: published task spec の Automated commands
- rerun: published task spec 内の `validate-system-plan.py --repo-root . --staging .` は repository root から解決できない。再検証は世代非依存の `python3 plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-auth-workspace` を使い、current pointer から現行世代を再解決する。

## 実行記録 (2026-08-24 最終レビュー)

- Beads `ah-361.7` は closed。ローカル MVP の受入は完了。
- 本番 Google OAuth / remote D1 は未検証（`docs/spec/feat-auth-workspace/release-notes.md` §7）。
- draft PR: https://github.com/daishiman/affiliate-hub/pull/29
- 証跡: `docs/spec/feat-auth-workspace/acceptance-report.md`, `beads:ah-361.7`
