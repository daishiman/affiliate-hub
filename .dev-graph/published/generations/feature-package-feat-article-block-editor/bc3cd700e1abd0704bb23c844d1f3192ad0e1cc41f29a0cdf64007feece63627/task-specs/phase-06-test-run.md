---
graph_node_id: "SYS-ARTICLE-BLOCK-EDITOR-P06"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-article-block-editor"
domain: "quality"
tags: ["p06","feat-article-block-editor"]
priority: null
start_date: null
target_date: null
iteration: null
title: "テスト実行 — 実装全量の回帰・境界値・Worker APIシナリオ"
owners: ["daishiman"]
status: "active"
depends_on: ["SYS-ARTICLE-BLOCK-EDITOR-P05"]
related_nodes: []
resource_scope: ["docs/spec/feat-article-block-editor/test-run.md","tests"]
parent_feature: "feat-article-block-editor"
feature_package_id: "feature-package/feat-article-block-editor"
phase_ref: "P06"
file_path: "tasks/feat-article-block-editor/sys-article-block-editor-p06.md"
tracker_binding: "beads"
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
source_lineage: {"origin_kind":"system-dev-planner","source_digest":"sha256:9a9bfacc9dd444dfcaaf27d9ac1d83a0a3596dce3afffc094f1ace4d430eac02","source_plugin":"system-dev-planner","source_version":"0.1.0"}
---

# System task overlay: テスト実行 — 実装全量の回帰・境界値・Worker APIシナリオ

## Machine-readable registration fields

- feature_package_id: feature-package/feat-article-block-editor
- owners: ["daishiman"]
- tags: ["p06", "feat-article-block-editor"]
- related_nodes: []
- parent_feature: feat-article-block-editor
- phase_ref: P06
- classification: confidence=1.0; reason=feat-article-block-editor の P06 lifecycle 責務への確定写像; candidate=tasks/feat-article-block-editor/sys-article-block-editor-p06.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P05 の実装に対して P04 が設計したテストスイート全量を実行し、回帰・境界値・Worker API シナリオの全ケースが緑であることを確認する。失敗ケースを P05 差し戻しとして記録し、全件緑になるまで P05 との往復を行う。P06 の完了条件は `pnpm vitest run --reporter=dot` が 0件失敗で終了することである。

## 背景

P05 で実装した Worker API 送信 UI・WYSIWYG 編集面・許可リストレンダラが P04 の設計通りに動くことを、実際のテスト実行で確認する。特に、Worker API の境界値テスト (8 MiB 超過拒否・マジックバイト不一致拒否・same-origin 違反拒否・未認証拒否) が R2 put 呼び出しに到達する前に失敗していることを、テスト結果のログで確認する。presigned PUT シナリオのテストは存在しないことを確認する。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-article-block-editor, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Entry gate: SYS-ARTICLE-BLOCK-EDITOR-P05 done|closed
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable — 編集面 behavior テスト・E2E スクリーンショット比較の結果を確認する
- Backend: applicable — Worker API 境界値テスト・article_image D1 結合テストの結果を確認する
- API: N/A — API 実装は P05 が所有する
- Data: N/A — スキーマ実装は P05 が所有する
- Infrastructure: N/A — デプロイ単位を変更しない
- Security: N/A — 追加実装は行わない
- Quality: applicable — テスト実行と失敗ケースの差し戻し記録が本 phase の責務である
- Documentation: applicable — test-run.md そのものが本 phase の成果物である
- Operations: N/A — 運用手順は P12 が所有する

## Architecture and deploy unit

- Architecture decisions: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存記事マイグレーションと保存形式の前方互換確認は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-article-block-editor/test-run.md (テスト実行結果サマリ・失敗ケース差し戻し記録・全件緑の確認)
- Consumed artifacts: docs/spec/feat-article-block-editor/test-design.md, src (P05 実装全量)
- Write scope/touches: docs/spec/feat-article-block-editor/test-run.md, tests (失敗修正分のみ)

## Tracker publication and completion

> 本 spec は `tracker_binding_intent` と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A — reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-ARTICLE-BLOCK-EDITOR-P06; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-ARTICLE-BLOCK-EDITOR-P06; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-ARTICLE-BLOCK-EDITOR-P06 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- P05 実装コードの変更 (テスト結果に基づく差し戻しは P05 の write_scope で行う)
- presigned PUT シナリオのテスト実行 (存在しないことを確認するのみ)
- P04 設計文書の変更

## テスト戦略

- テストレベル選定: 単体テストで `pnpm vitest run --reporter=dot` により P04 指定スイートを含む全量を実行する。結合テストで Worker API 境界値ケース (8 MiB 超過/マジックバイト不一致/same-origin 違反/未認証) の各テストが R2 put 呼び出し前に失敗していることをログで確認する。境界値テストで8 MiB 上限・マジックバイト・認可のそれぞれの閾値ケースが正しく判定されていることを確認する。回帰テストで既存 tests/ 配下の全スイートが 0件失敗であることを確認する。
- カバレッジ目標: 80% — 新規実装コード (src/domain/blogops, src/presentation/prose, src/application/ports, src/application/usecases, src/infrastructure/persistence/d1, src/app/api/article-images) に適用し、カバレッジレポートを test-run.md に添付する。
- 層別方針: フロントエンド — behavior テスト (可視ラベル・アクセシブル名) の PASS を確認する。バックエンド — API 契約テストで Worker API 境界値テストの PASS と各拒否ケースが R2 put 前に発生していることを確認し、DB 結合テストで article_image テーブルの lifecycle 遷移を確認する。インフラ — N/A: 本 phase はデプロイ単位を変更しないため IaC 静的検証・smoke テストは対象外。presigned PUT テスト・R2 CORS テストが存在しないことをテストファイル一覧で確認する。
- 保守性制約: pixel 位置依存のスクリーンショット比較を避け、DOM 構造への依存を最小化し、可視ラベル・アクセシブル名・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run typecheck`
- Automated commands: `pnpm run lint`
- Automated commands: `pnpm vitest run --reporter=dot` (全量 0件失敗)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor`
- Required evidence: docs/spec/feat-article-block-editor/test-run.md の存在と全件緑の記録

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: P05 の実装に対して P04 が設計したテストスイート全量を実行し、回帰・境界値・Worker API シナリオの全ケースが緑であることを確認する。
- Generic execution prompt: feat-article-block-editor の goal と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P06 の目的を満たす成果物を作らせる
- Rubric: 全件緑・カバレッジ 80% 達成・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の4点をすべて満たすこと
- Feedback loop: 失敗ケースを P05 差し戻しとして記録し、P05 修正後に再実行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A — P13 owns writeback

## Rollout and rollback

- Rollout: P06 の成果物を write_scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: 全件緑に到達できない場合、P05 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: P05 done + pnpm vitest run が 0件失敗

## 参照情報

- System specification: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-article-block-editor
- Dependencies: SYS-ARTICLE-BLOCK-EDITOR-P05

## task-spec validation

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` で published task spec と package 全体を再検証する。
