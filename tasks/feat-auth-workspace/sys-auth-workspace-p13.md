---
graph_node_id: "SYS-AUTH-WORKSPACE-P13"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-auth-workspace"
domain: "operations"
tags: ["p13","feat-auth-workspace"]
priority: null
start_date: null
target_date: null
iteration: null
title: "リリース/デプロイとクローズアウト"
owners: ["daishiman"]
created_at: "2026-08-16T12:39:37Z"
updated_at: "2026-08-24T13:30:00Z"
status: "done"
depends_on: ["SYS-AUTH-WORKSPACE-P12"]
related_nodes: []
resource_scope: ["docs/spec/feat-auth-workspace/release-notes.md","system-spec/auth.md","architecture/system-spec-overview.md"]
purpose: "feat-auth-workspace を pnpm run preview (Workers ランタイム) 上で最終確認したうえでクローズアウトし、実行結果・判断・改善点を system-spec/architecture へ書き戻した状態を成立させる。"
goal: "feat-auth-workspace を pnpm run preview (Workers ランタイム) 上で最終確認したうえでクローズアウトし、実行結果・判断・改善点を system-spec/architecture へ書き戻した状態を成立させる。"
scope_in: ["Produced artifacts: docs/spec/feat-auth-workspace/release-notes.md (実デプロイ N/A: 理由記載を含む), system-spec/auth.md (実行結果反映), architecture/system-spec-overview.md (実行結果反映)","Consumed artifacts: docs/spec/feat-auth-workspace/runbook.md, docs/spec/feat-auth-workspace/handover.md, docs/spec/feat-auth-workspace/final-review-log.md","Write scope/touches: docs/spec/feat-auth-workspace/release-notes.md, system-spec/auth.md, architecture/system-spec-overview.md"]
scope_out: ["feat-auth-workspace の scope_out (外部プラットフォームのアカウント接続, 課金, SSO/SCIM) に該当する変更","write_scope 外のパスへの変更"]
acceptance: ["Automated commands: `pnpm run preview` (Workers ランタイム, localhost:8787) 上で P13 に対応する検証コマンドを実行する","Automated commands: `pnpm vitest run --coverage` (単体/結合/境界値/回帰テストを実行し P13 の証跡を得る)","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-auth-workspace` (本 package の C12 決定論検証を世代非依存に再実行する)","Required evidence: P13 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-system-spec-overview"]
parent_feature: "feat-auth-workspace"
feature_package_id: "feature-package/feat-auth-workspace"
phase_ref: "P13"
file_path: "tasks/feat-auth-workspace/sys-auth-workspace-p13.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"35483f66bb1988fc2b3ede65937a16e41d29637c455a092e3fa463c0c90fbb0c","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-auth-workspace/35483f66bb1988fc2b3ede65937a16e41d29637c455a092e3fa463c0c90fbb0c/plan-findings.json"}
source_lineage: {"imported_at":"2026-08-16T12:39:37Z","origin_kind":"system-dev-planner","source_digest":"35483f66bb1988fc2b3ede65937a16e41d29637c455a092e3fa463c0c90fbb0c","source_path":".dev-graph/published/generations/feature-package-feat-auth-workspace/35483f66bb1988fc2b3ede65937a16e41d29637c455a092e3fa463c0c90fbb0c/task-specs/phase-13-release-deploy.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-auth-workspace の P13 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-auth-workspace/sys-auth-workspace-p13.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-361.13","github_mirror":null,"linked_at":"2026-08-16T13:00:16Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: [{"number":29,"url":"https://github.com/daishiman/affiliate-hub/pull/29","base":"dev","head":"devgraph/feat-auth-workspace","draft":true}]
execution_contexts: []
completion_evidence: {"completed_at":"2026-08-24T12:00:00Z","evidence_refs":["docs/spec/feat-auth-workspace/release-notes.md","docs/spec-writeback-receipt.md","system-spec/auth.md","architecture/system-spec-overview.md","beads:ah-361.13"],"policy":"manual","reconciled_at":"2026-08-24T13:30:00Z","source":"manual","status":"done"}
implementation_readiness: {"checked_at":"2026-08-16T21:00:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: リリース/デプロイとクローズアウト

## Machine-readable registration fields

- feature_package_id: feature-package/feat-auth-workspace
- owners: ["daishiman"]
- tags: ["p13", "feat-auth-workspace"]
- related_nodes: []
- parent_feature: feat-auth-workspace
- phase_ref: P13
- classification: confidence=1.0; reason=feat-auth-workspace の P13 lifecycle 責務への確定写像; candidate=tasks/feat-auth-workspace/sys-auth-workspace-p13.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

feat-auth-workspace を pnpm run preview (Workers ランタイム) 上で最終確認したうえでクローズアウトし、実行結果・判断・改善点を system-spec/architecture へ書き戻した状態を成立させる。

## 背景

たたき台 (プロトタイプ) 構築段階のため実デプロイは必須ではないが、system-spec/index.md の8章体系と architecture/system-spec-overview.md への書き戻しは正本更新として必須。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-auth-workspace, system-spec/auth.md, system-spec/security.md, system-spec/database.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: N/A: intra-feature depends_on gate
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A: たたき台段階の実デプロイは行わず、pnpm run preview 上の最終確認に限定する
- Backend: N/A: たたき台段階の実デプロイは行わず、pnpm run preview 上の最終確認に限定する
- API: N/A: たたき台段階の実デプロイは行わず、pnpm run preview 上の最終確認に限定する
- Data: N/A: たたき台段階の実デプロイは行わず、pnpm run preview 上の最終確認に限定する
- Infrastructure: N/A: 実デプロイは本フェーズでは行わない (理由: たたき台構築段階であり本番Cloudflare環境への公開は対象外)
- Security: applicable; クローズアウト時点で403制御とworkspace_id分離が維持されていることを最終確認する
- Quality: applicable; 4受け入れ条件の最終再確認をクローズアウト条件とする
- Documentation: applicable; system-spec/architecture への書き戻しを行う
- Operations: applicable; リリースノートとロールバック手順を確定する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, system-spec/auth.md, system-spec/security.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: §26.4 workspace_id backfill は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-auth-workspace/release-notes.md (実デプロイ N/A: 理由記載を含む), system-spec/auth.md (実行結果反映), architecture/system-spec-overview.md (実行結果反映)
- Consumed artifacts: docs/spec/feat-auth-workspace/runbook.md, docs/spec/feat-auth-workspace/handover.md, docs/spec/feat-auth-workspace/final-review-log.md
- Write scope/touches: docs/spec/feat-auth-workspace/release-notes.md, system-spec/auth.md, architecture/system-spec-overview.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-AUTH-WORKSPACE-P13; default branch target
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-AUTH-WORKSPACE-P13; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-AUTH-WORKSPACE-P13 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on=['P12']の完了 + resource_scope (feat-auth-workspace 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-auth-workspace の scope_out (外部プラットフォームのアカウント接続, 課金, SSO/SCIM) に該当する変更
- write_scope 外のパスへの変更

## テスト戦略

- テストレベル選定: 単体・結合・境界値・回帰は P06/P11 で確定済みのテストスイートを pnpm run preview 上で最終再実行し、全件緑を確認する。
- カバレッジ目標: 既定 80% の維持を最終確認としてクローズアウト条件に含める。
- 層別方針: N/A: 実デプロイは対象外 (理由: たたき台構築段階) だが、pnpm run preview 上での最終確認は API 契約 + DB 結合の観点で行う。
- 保守性制約: pixel 位置依存・DOM 構造依存の確認手順を採用せず、pnpm run preview のレスポンス・ログなど振る舞いベースの最終確認に限定する。

## Verification and evidence

- Automated commands: `pnpm run preview` (Workers ランタイム, localhost:8787) 上で P13 に対応する検証コマンドを実行する
- Automated commands: `pnpm vitest run --coverage` (単体/結合/境界値/回帰テストを実行し P13 の証跡を得る)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-auth-workspace` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P13 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: feat-auth-workspace を pnpm run preview (Workers ランタイム) 上で最終確認したうえでクローズアウトし、実行結果・判断・改善点を system-spec/architecture へ書き戻した状態を成立させる。
- Generic execution prompt: feat-auth-workspace の goal (Google ログインでサインインし、Workspace/Brandを作成でき、全データがworkspace_idで分離され、ロールに応じた操作制限が効いている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P13 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装→独立評価 (P03/P09/P10相当)→findingをGeneric execution promptへ反映→再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止しP01..現phaseへ差し戻す
- P13 spec/architecture writeback: required: 実行結果・判断・改善点を system-spec/auth.md と architecture/system-spec-overview.md へ書き戻す

## Rollout and rollback

- Rollout: P13 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P13 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 4受け入れ条件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/auth.md, system-spec/security.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md
- Feature: feat-auth-workspace
- Phase doc: system-plan-phase-names.md#P13
- Dependencies: SYS-AUTH-WORKSPACE-P12

## 実行契約

- source spec: 昇格済み generation の task spec 本文 (byte-for-byte 不変)
- verification: published task spec の Automated commands
- rerun: published task spec 内の `validate-system-plan.py --repo-root . --staging .` は repository root から解決できない。再検証は世代非依存の `python3 plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-auth-workspace` を使い、current pointer から現行世代を再解決する。

## 実行記録 (2026-08-24 最終レビュー)

- Beads `ah-361.13` は closed。ローカル MVP の受入は完了。
- 本番 Google OAuth / remote D1 は未検証（`docs/spec/feat-auth-workspace/release-notes.md` §7）。
- draft PR: https://github.com/daishiman/affiliate-hub/pull/29
- 証跡: `docs/spec/feat-auth-workspace/release-notes.md`, `docs/spec-writeback-receipt.md`, `system-spec/auth.md`, `architecture/system-spec-overview.md`, `beads:ah-361.13`
