---
graph_node_id: "SYS-ARTICLE-BLOCK-EDITOR-P07"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-article-block-editor"
domain: "quality"
tags: ["p07","feat-article-block-editor"]
priority: null
start_date: null
target_date: null
iteration: null
title: "受入確認 — A1-A7 全件のPASS証跡取得"
owners: ["daishiman"]
created_at: "2026-09-07T15:31:08Z"
updated_at: "2026-09-08T08:01:31.166553Z"
status: "active"
depends_on: ["SYS-ARTICLE-BLOCK-EDITOR-P06"]
related_nodes: []
resource_scope: ["docs/spec/feat-article-block-editor/acceptance.md"]
purpose: "feat-article-block-editor の受入7件 (A1-A7) すべてに対して PASS の証跡を取得し、acceptance.md へ記録する。A1 (編集面に記法の生テキストが現れない) から A7 (既存 10種記事の不変性) までを、スクリーンショット・E2E ログ・自動テスト結果のいずれか1種以上で裏付ける。画像アップロードの受入項目 (A5) は Worker API 経由の添付であり、presigned URL・ブラウザ直接 PUT・R2 write CORS の経路が存在しないことも証跡に含める。"
goal: "feat-article-block-editor の受入7件 (A1-A7) すべてに対して PASS の証跡を取得し、acceptance.md へ記録する。"
scope_in: ["Produced artifacts: docs/spec/feat-article-block-editor/acceptance.md (A1-A7 各項目の PASS 判定と証跡ファイル参照)","Consumed artifacts: docs/spec/feat-article-block-editor/test-run.md, features/feat-article-block-editor.context.json (acceptance 定義)","Write scope/touches: docs/spec/feat-article-block-editor/acceptance.md"]
scope_out: ["P05/P06 実装コードの変更","A1-A7 の定義変更 (feat-article-block-editor.context.json の acceptance を変更しない)","presigned URL・ブラウザ直接 PUT・R2 write CORS の動作確認 (存在しないことの確認のみ)"]
acceptance: ["Automated commands: `pnpm run typecheck`","Automated commands: `pnpm vitest run --reporter=dot`","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor`","Required evidence: docs/spec/feat-article-block-editor/acceptance.md の存在と A1-A7 全件 PASS の記録"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: "feat-article-block-editor"
feature_package_id: "feature-package/feat-article-block-editor"
phase_ref: "P07"
file_path: "tasks/feat-article-block-editor/sys-article-block-editor-p07.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-article-block-editor/bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-07T15:31:08Z","origin_kind":"system-dev-planner","source_digest":"bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627","source_path":".dev-graph/published/generations/feature-package-feat-article-block-editor/bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627/task-specs/phase-07-acceptance.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-article-block-editor の P07 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-article-block-editor/sys-article-block-editor-p07.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-7d6u","github_mirror":null,"linked_at":"2026-09-08T07:14:07Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-07T14:20:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: 受入確認 — A1-A7 全件のPASS証跡取得

## Machine-readable registration fields

- feature_package_id: feature-package/feat-article-block-editor
- owners: ["daishiman"]
- tags: ["p07", "feat-article-block-editor"]
- related_nodes: []
- parent_feature: feat-article-block-editor
- phase_ref: P07
- classification: confidence=1.0; reason=feat-article-block-editor の P07 lifecycle 責務への確定写像; candidate=tasks/feat-article-block-editor/sys-article-block-editor-p07.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

feat-article-block-editor の受入7件 (A1-A7) すべてに対して PASS の証跡を取得し、acceptance.md へ記録する。A1 (編集面に記法の生テキストが現れない) から A7 (既存 10種記事の不変性) までを、スクリーンショット・E2E ログ・自動テスト結果のいずれか1種以上で裏付ける。画像アップロードの受入項目 (A5) は Worker API 経由の添付であり、presigned URL・ブラウザ直接 PUT・R2 write CORS の経路が存在しないことも証跡に含める。

## 背景

feat-article-block-editor.context.json の acceptance は7件で定義されており、P06 のテスト全件緑化が先行する。本 phase は P06 の結果を受けて、acceptance の定義と照合し、確定した PASS 証跡を acceptance.md にまとめる。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-article-block-editor, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/security.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Entry gate: SYS-ARTICLE-BLOCK-EDITOR-P06 done|closed
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable — A1 (WYSIWYG)・A2 (見出しレベル固定)・A3 (19種の公開描画一致) の証跡を取得する
- Backend: N/A — 追加実装は行わない
- API: N/A — 追加実装は行わない
- Data: N/A — 追加実装は行わない
- Infrastructure: N/A — 追加実装は行わない
- Security: applicable — A5 (Worker API 経由の画像アップロード・8 MiB 超過拒否・許可外 MIME 拒否) と A6 (許可リスト絞り込み) の証跡を取得する
- Quality: applicable — A1-A7 全件の PASS 判定が本 phase の責務である
- Documentation: applicable — acceptance.md そのものが本 phase の成果物である
- Operations: N/A — 運用手順は P12 が所有する

## Architecture and deploy unit

- Architecture decisions: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存記事マイグレーションと保存形式の前方互換確認は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-article-block-editor/acceptance.md (A1-A7 各項目の PASS 判定と証跡ファイル参照)
- Consumed artifacts: docs/spec/feat-article-block-editor/test-run.md, features/feat-article-block-editor.context.json (acceptance 定義)
- Write scope/touches: docs/spec/feat-article-block-editor/acceptance.md

## Tracker publication and completion

> 本 spec は `tracker_binding_intent` と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A — reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-ARTICLE-BLOCK-EDITOR-P07; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-ARTICLE-BLOCK-EDITOR-P07; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-ARTICLE-BLOCK-EDITOR-P07 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- P05/P06 実装コードの変更
- A1-A7 の定義変更 (feat-article-block-editor.context.json の acceptance を変更しない)
- presigned URL・ブラウザ直接 PUT・R2 write CORS の動作確認 (存在しないことの確認のみ)

## テスト戦略

- テストレベル選定: 単体テストで features/feat-article-block-editor.context.json の acceptance 定義を基準に、A1〜A7 を1件ずつ E2E ログ・スクリーンショット・テスト結果のいずれかで裏付ける。結合テストで A5 (画像アップロード) を tests/e2e/block-editor-publish.e2e.ts の実行結果と、`src/app/api/article-images/route.ts` に presigned PUT 経路が存在しないことのコード確認を証跡とする。境界値テストで A3 (19種すべての公開描画一致) と A7 (既存 10種記事の不変性) を検証する。回帰テストで既存 tests/ 配下の全スイートが 0件失敗であることを確認する。
- カバレッジ目標: 80% — A1-A7 全7件の PASS 確認を完了条件とする。本 phase が生成するコードは無いため、カバレッジ数値は受入カバレッジとして適用する。
- 層別方針: フロントエンド — A1 (WYSIWYG)・A2 (見出しレベル固定)・A3 (19種の公開描画一致) の証跡を behavior 検証 (可視ラベル・アクセシブル名) で取得する。バックエンド — N/A: 本 phase は追加実装を行わないため API 契約テスト・DB 結合テストは対象外。インフラ — N/A: 本 phase はデプロイ単位を変更しないため IaC 静的検証・smoke テストは対象外。証跡ファイルを acceptance.md から参照できる形式 (ファイルパス・コマンドとその出力) で記録する。
- 保守性制約: pixel 位置依存のスクリーンショット比較を避け、DOM 構造への依存を最小化し、証跡の取得手順を acceptance.md に明記して別の実行者が同じ手順で再現できることを確認する。

## Verification and evidence

- Automated commands: `pnpm run typecheck`
- Automated commands: `pnpm vitest run --reporter=dot`
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor`
- Required evidence: docs/spec/feat-article-block-editor/acceptance.md の存在と A1-A7 全件 PASS の記録

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: feat-article-block-editor の受入7件 (A1-A7) すべてに対して PASS の証跡を取得し、acceptance.md へ記録する。
- Generic execution prompt: feat-article-block-editor の goal と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P07 の目的を満たす成果物を作らせる
- Rubric: A1-A7 全7件 PASS・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の3点をすべて満たすこと
- Feedback loop: 未 PASS の項目を P05/P06 差し戻しとして記録し、修正後に再確認し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A — P13 owns writeback

## Rollout and rollback

- Rollout: P07 の成果物を write_scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: A1-A7 全件 PASS に到達できない場合、P05/P06 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: P06 done + A1-A7 全件 PASS の証跡が acceptance.md に記録されている

## 参照情報

- System specification: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-article-block-editor
- Dependencies: SYS-ARTICLE-BLOCK-EDITOR-P06

## task-spec validation

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` で published task spec と package 全体を再検証する。

## 実行契約

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: current pointer から現行世代を解決する `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` で published task spec と package 全体を再検証する。
