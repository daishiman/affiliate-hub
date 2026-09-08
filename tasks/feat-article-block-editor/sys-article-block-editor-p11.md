---
graph_node_id: "SYS-ARTICLE-BLOCK-EDITOR-P11"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-article-block-editor"
domain: "documentation"
tags: ["p11","feat-article-block-editor"]
priority: null
start_date: null
target_date: null
iteration: null
title: "受入・品質証跡の集約と検証可能性の確保"
owners: ["daishiman"]
created_at: "2026-09-07T15:31:08Z"
updated_at: "2026-09-07T15:51:20.463649Z"
status: "active"
depends_on: ["SYS-ARTICLE-BLOCK-EDITOR-P07","SYS-ARTICLE-BLOCK-EDITOR-P09"]
related_nodes: []
resource_scope: ["docs/spec/feat-article-block-editor/evidence.md"]
purpose: "P07 の acceptance.md と P09 の qa-report.md を統合し、evidence.md として本 feature の最終エビデンスパッケージを生成する。エビデンスには A1-A7 の PASS 証跡 (スクリーンショット参照・テスト実行結果)、Worker API 画像ライフサイクル記録 (pending 予約→R2 put→ready 確定の D1 遷移ログ、DB-IMAGE-01〜03 の受入証跡、OPS-REQ-008〜010 の掃除ジョブ設計の根拠記録)、SEC-REQ-006〜009 の PASS 記録を含める。"
goal: "P07 の acceptance.md と P09 の qa-report.md を統合し、A1-A7 PASS 証跡・Worker API 画像ライフサイクル記録・SEC-REQ-006〜009 PASS 記録・DB-IMAGE-01〜03 受入証跡・OPS-REQ-008〜010 掃除ジョブ設計根拠を含む evidence.md を生成する。"
scope_in: ["Produced artifacts: docs/spec/feat-article-block-editor/evidence.md (A1-A7 PASS 証跡・Worker API 画像ライフサイクル記録・DB-IMAGE-01〜03 受入証跡・SEC-REQ-006〜009 PASS 記録・OPS-REQ-008〜010 掃除ジョブ設計根拠・presigned PUT 不在確認)","Consumed artifacts: docs/spec/feat-article-block-editor/acceptance.md (P07), docs/spec/feat-article-block-editor/qa-report.md (P09), docs/spec/feat-article-block-editor/test-run.md (P06)","Write scope/touches: docs/spec/feat-article-block-editor/evidence.md"]
scope_out: ["実装コードの変更","system-spec への書き戻し (P13 が所有する)","presigned PUT のエビデンス収集 (存在しないことの確認のみ)"]
acceptance: ["Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor`","Required evidence: docs/spec/feat-article-block-editor/evidence.md の存在と17件の証跡カバレッジの記録"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: "feat-article-block-editor"
feature_package_id: "feature-package/feat-article-block-editor"
phase_ref: "P11"
file_path: "tasks/feat-article-block-editor/sys-article-block-editor-p11.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-article-block-editor/bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-07T15:31:08Z","origin_kind":"system-dev-planner","source_digest":"bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627","source_path":".dev-graph/published/generations/feature-package-feat-article-block-editor/bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627/task-specs/phase-11-evidence.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-article-block-editor の P11 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-article-block-editor/sys-article-block-editor-p11.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-07T14:20:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: エビデンス収集 — A1-A7対応証跡と画像ライフサイクル記録

## Machine-readable registration fields

- feature_package_id: feature-package/feat-article-block-editor
- owners: ["daishiman"]
- tags: ["p11", "feat-article-block-editor"]
- related_nodes: []
- parent_feature: feat-article-block-editor
- phase_ref: P11
- classification: confidence=1.0; reason=feat-article-block-editor の P11 lifecycle 責務への確定写像; candidate=tasks/feat-article-block-editor/sys-article-block-editor-p11.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P07 の acceptance.md と P09 の qa-report.md を統合し、evidence.md として本 feature の最終エビデンスパッケージを生成する。エビデンスには A1-A7 の PASS 証跡 (スクリーンショット参照・テスト実行結果)、Worker API 画像ライフサイクル記録 (pending 予約→R2 put→ready 確定の D1 遷移ログ、DB-IMAGE-01〜03 の受入証跡、OPS-REQ-008〜010 の掃除ジョブ設計の根拠記録)、SEC-REQ-006〜009 の PASS 記録を含める。

## 背景

P11 は P07 (受入確認) と P09 (QA) の両者の依存を持つ。P07 は A1-A7 の PASS を確認し、P09 は SEC-REQ-006〜009 を検証している。P11 はこれらを1つの evidence.md にまとめ、P12 が運用手順書を書くときと P13 が system-spec に書き戻すときの根拠文書とする。画像アップロードのエビデンスは presigned PUT ではなく Worker API 経由の pending→ready 遷移を記録する。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-article-block-editor, system-spec/backend.md, system-spec/database.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Entry gate: SYS-ARTICLE-BLOCK-EDITOR-P07 done|closed および SYS-ARTICLE-BLOCK-EDITOR-P09 done|closed
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A — 追加実装は行わない
- Backend: applicable — Worker API 画像ライフサイクル (pending→R2 put→ready) の D1 遷移ログを証跡として収集する
- API: N/A — 追加実装は行わない
- Data: applicable — DB-IMAGE-01〜03 の受入証跡 (D1 への INSERT/SELECT 往復・lifecycle 遷移・tenant 越境拒否) を収集する
- Infrastructure: applicable — presigned PUT 不在の静的検査結果と R2 バインディング経由の書き込み証跡を収集する
- Security: applicable — SEC-REQ-006〜009 の PASS 記録を qa-report.md から引用して evidence.md に統合する
- Quality: applicable — evidence.md の生成と証跡の完全性確認が本 phase の責務である
- Documentation: applicable — evidence.md そのものが本 phase の成果物である
- Operations: applicable — OPS-REQ-008〜010 の掃除ジョブ設計根拠を evidence.md に記録する

## Architecture and deploy unit

- Architecture decisions: system-spec/backend.md, system-spec/database.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存記事マイグレーション不要の記録を evidence.md に含める

## 成果物

- Produced artifacts: docs/spec/feat-article-block-editor/evidence.md (A1-A7 PASS 証跡・Worker API 画像ライフサイクル記録・DB-IMAGE-01〜03 受入証跡・SEC-REQ-006〜009 PASS 記録・OPS-REQ-008〜010 掃除ジョブ設計根拠・presigned PUT 不在確認)
- Consumed artifacts: docs/spec/feat-article-block-editor/acceptance.md (P07), docs/spec/feat-article-block-editor/qa-report.md (P09), docs/spec/feat-article-block-editor/test-run.md (P06)
- Write scope/touches: docs/spec/feat-article-block-editor/evidence.md

## Tracker publication and completion

> 本 spec は `tracker_binding_intent` と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A — reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-ARTICLE-BLOCK-EDITOR-P11; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-ARTICLE-BLOCK-EDITOR-P11; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-ARTICLE-BLOCK-EDITOR-P11 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- 実装コードの変更
- system-spec への書き戻し (P13 が所有する)
- presigned PUT のエビデンス収集 (存在しないことの確認のみ)

## テスト戦略

- テストレベル選定: 単体テストとして evidence.md が A1-A7 全件・SEC-REQ-006〜009 全件・DB-IMAGE-01〜03 全件・OPS-REQ-008〜010 全件をカバーしていることを確認する。結合テストとして evidence.md から参照している証跡ファイル (スクリーンショット・テスト結果) がすべてアクセス可能なパスに存在することを確認する。境界値テストとして17件の証跡カバレッジの網羅性を検証する。回帰テストで既存 tests/ 配下の全スイートが 0件失敗であることを確認する。
- カバレッジ目標: 80% — evidence.md のカバレッジとして A1-A7 全7件・SEC-REQ-006〜009 全4件・DB-IMAGE-01〜03 全3件・OPS-REQ-008〜010 全3件の計17件すべての証跡が記録されていることを完了条件とする。
- 層別方針: フロントエンド — N/A: 本 phase は追加実装を行わないため behavior 検証は対象外。バックエンド — API 契約テストの観点で Worker API 画像ライフサイクル (pending→R2 put→ready) の D1 遷移ログを証跡として収集し、DB 結合テストの観点で DB-IMAGE-01〜03 の受入証跡を収集する。インフラ — IaC 静的検証の観点で presigned PUT 不在の静的検査結果を証跡として収集し、smoke テストの観点で R2 バインディング経由の書き込み証跡を収集する。
- 保守性制約: pixel 位置依存のスクリーンショット比較を避け、DOM 構造への依存を最小化し、引用する証跡のファイルパスとコマンドを evidence.md に明記して再実行可能な形にする。

## Verification and evidence

- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor`
- Required evidence: docs/spec/feat-article-block-editor/evidence.md の存在と17件の証跡カバレッジの記録

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: P07 の acceptance.md と P09 の qa-report.md を統合し、A1-A7 PASS 証跡・Worker API 画像ライフサイクル記録・SEC-REQ-006〜009 PASS 記録・DB-IMAGE-01〜03 受入証跡・OPS-REQ-008〜010 掃除ジョブ設計根拠を含む evidence.md を生成する。
- Generic execution prompt: feat-article-block-editor の goal と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P11 の目的を満たす成果物を作らせる
- Rubric: 17件のカバレッジ・参照可能性確認・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の4点をすべて満たすこと
- Feedback loop: カバレッジ不足の場合は P07/P09/P06 の成果物を再確認し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A — P13 owns writeback

## Rollout and rollback

- Rollout: P11 の成果物を write_scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: evidence.md の生成に失敗した場合、write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: P07 done + P09 done + evidence.md に17件の証跡カバレッジが記録されている

## 参照情報

- System specification: system-spec/backend.md, system-spec/database.md, system-spec/security.md, system-spec/maintenance-ops.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-article-block-editor
- Dependencies: SYS-ARTICLE-BLOCK-EDITOR-P07, SYS-ARTICLE-BLOCK-EDITOR-P09

## task-spec validation

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` で published task spec と package 全体を再検証する。

## 実行契約

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: current pointer から現行世代を解決する `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` で published task spec と package 全体を再検証する。
