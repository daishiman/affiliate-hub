---
graph_node_id: "SYS-ARTICLE-BLOCK-EDITOR-P08"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-article-block-editor"
domain: "backend"
tags: ["p08","feat-article-block-editor"]
priority: null
start_date: null
target_date: null
iteration: null
title: "リファクタリング・既存記事移行互換確認"
owners: ["daishiman"]
created_at: "2026-09-07T15:31:08Z"
updated_at: "2026-09-08T08:01:58.772601Z"
status: "active"
depends_on: ["SYS-ARTICLE-BLOCK-EDITOR-P05"]
related_nodes: []
resource_scope: ["src/domain/blogops","src/presentation/prose","src/application","src/infrastructure/persistence/d1","tests"]
purpose: "P05 の実装で発生した技術的負債を整理し、既存 10種の断片で書かれた記事が新しい `parseProse` で壊れずに読み込め、保存し直しても内容が変わらないこと (BE-PROSE-01/03、受入 A7) を、既存記事 fixture 全件を使った退行テストで確認する。保存形式 (拡張 Markdown 文字列) を変えていないため移行スクリプトが不要であることを記録する。"
goal: "P05 の実装の技術的負債を整理し、既存 10種記事が新しい parseProse で壊れずに読み込め、保存し直しても内容が変わらないことを確認する。"
scope_in: ["Produced artifacts: src/domain/blogops/ (リファクタリング済み・退行テスト確認); src/presentation/prose/ (リファクタリング済み); src/application/ (リファクタリング済み); src/infrastructure/persistence/d1/ (リファクタリング済み); tests/ (既存10種記事 fixture を使った退行テストの追加)","Consumed artifacts: docs/spec/feat-article-block-editor/test-design.md, docs/spec/feat-article-block-editor/test-run.md","Write scope/touches: src/domain/blogops, src/presentation/prose, src/application, src/infrastructure/persistence/d1, tests"]
scope_out: ["振る舞いを変えるリファクタリング (振る舞いを変えずに整理する)","保存形式 (拡張 Markdown 文字列) の変更 (変えないことが決定済み)","移行スクリプトの実装 (不要であることを記録するのみ)","presigned PUT / signed URL / R2 CORS のコードが残っている場合はここで除去する (P09 の QA 前に除去を完了させる)"]
acceptance: ["Automated commands: `pnpm run typecheck`","Automated commands: `pnpm run lint`","Automated commands: `pnpm vitest run --reporter=dot`","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor`","Required evidence: P08 の 成果物 section に記載した produced artifacts のパスと、退行テスト全件 PASS の記録"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: "feat-article-block-editor"
feature_package_id: "feature-package/feat-article-block-editor"
phase_ref: "P08"
file_path: "tasks/feat-article-block-editor/sys-article-block-editor-p08.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-article-block-editor/bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-07T15:31:08Z","origin_kind":"system-dev-planner","source_digest":"bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627","source_path":".dev-graph/published/generations/feature-package-feat-article-block-editor/bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627/task-specs/phase-08-refactoring-migration.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-article-block-editor の P08 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-article-block-editor/sys-article-block-editor-p08.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-nwbr","github_mirror":null,"linked_at":"2026-09-08T07:14:07Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-07T14:20:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: リファクタリング・既存記事移行互換確認

## Machine-readable registration fields

- feature_package_id: feature-package/feat-article-block-editor
- owners: ["daishiman"]
- tags: ["p08", "feat-article-block-editor"]
- related_nodes: []
- parent_feature: feat-article-block-editor
- phase_ref: P08
- classification: confidence=1.0; reason=feat-article-block-editor の P08 lifecycle 責務への確定写像; candidate=tasks/feat-article-block-editor/sys-article-block-editor-p08.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P05 の実装で発生した技術的負債を整理し、既存 10種の断片で書かれた記事が新しい `parseProse` で壊れずに読み込め、保存し直しても内容が変わらないこと (BE-PROSE-01/03、受入 A7) を、既存記事 fixture 全件を使った退行テストで確認する。保存形式 (拡張 Markdown 文字列) を変えていないため移行スクリプトが不要であることを記録する。

## 背景

BE-PROSE-01 は「保存形式を拡張 Markdown 文字列のままにする」という決定に基づいており、移行スクリプトは不要である。しかし `parseProse` の追加9種サポートにより既存の10種のパースが壊れていないかを退行テストで確認する必要がある。また P05 で急ぎ実装した箇所のリファクタリング (重複コードの統合・不要な抽象の除去) をこの phase で行い、P09 の QA がきれいな実装に対して実施できる状態にする。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-article-block-editor, system-spec/backend.md, system-spec/database.md, system-spec/frontend.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Entry gate: SYS-ARTICLE-BLOCK-EDITOR-P05 done|closed
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable — prose-editor.tsx 等の編集面コードのリファクタリングを行う (振る舞いを変えずに整理する)
- Backend: applicable — parseProse/serializeProse の既存10種記事に対する退行テストを実行する (BE-PROSE-01/03)
- API: N/A — API 契約を変更しない
- Data: applicable — article_image テーブルのマイグレーションを確認・補完する
- Infrastructure: N/A — デプロイ単位を変更しない
- Security: N/A — 追加実装は行わない
- Quality: applicable — リファクタリング後の全テスト緑化が本 phase の完了条件である
- Documentation: N/A — 文書化は P12 が所有する
- Operations: N/A — 運用手順は P12 が所有する

## Architecture and deploy unit

- Architecture decisions: system-spec/backend.md, system-spec/database.md, system-spec/frontend.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存記事の保存形式 (拡張 Markdown 文字列) を変えないため移行スクリプトは不要。保存形式の前方互換は本 phase で確認する。

## 成果物

- Produced artifacts: src/domain/blogops/ (リファクタリング済み・退行テスト確認); src/presentation/prose/ (リファクタリング済み); src/application/ (リファクタリング済み); src/infrastructure/persistence/d1/ (リファクタリング済み); tests/ (既存10種記事 fixture を使った退行テストの追加)
- Consumed artifacts: docs/spec/feat-article-block-editor/test-design.md, docs/spec/feat-article-block-editor/test-run.md
- Write scope/touches: src/domain/blogops, src/presentation/prose, src/application, src/infrastructure/persistence/d1, tests

## Tracker publication and completion

> 本 spec は `tracker_binding_intent` と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A — reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-ARTICLE-BLOCK-EDITOR-P08; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-ARTICLE-BLOCK-EDITOR-P08; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-ARTICLE-BLOCK-EDITOR-P08 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- 振る舞いを変えるリファクタリング (振る舞いを変えずに整理する)
- 保存形式 (拡張 Markdown 文字列) の変更 (変えないことが決定済み)
- 移行スクリプトの実装 (不要であることを記録するのみ)
- presigned PUT / signed URL / R2 CORS のコードが残っている場合はここで除去する (P09 の QA 前に除去を完了させる)

## テスト戦略

- テストレベル選定: 単体テストで `parseProse(serializeProse(nodes)) === nodes` が19種すべてで成り立つことを確認する (BE-PROSE-02)。結合テストで既存の公開済み記事 fixture 全件を新しい `parseProse` で読み、既存の描画結果と差分が出ないことを確認する (BE-PROSE-01)。境界値テストで未知の記法 (将来の断片を模した文字列) を含む本文を保存→読み出し→再保存する往復テストにより、元の文字列がバイト単位で一致して残ることを確認する (BE-PROSE-03)。回帰テストで `pnpm vitest run` が 0件失敗で終了することを確認する。
- カバレッジ目標: 80% — リファクタリング後も新規実装コードのカバレッジを維持する。
- 層別方針: フロントエンド — リファクタリング後の prose-editor.tsx が P06 のテスト全量で緑を維持することを behavior 検証で確認する。バックエンド — API 契約テストの観点で `parseProse`/`serializeProse` の往復テストを19種全件で実行し退行が 0件であることを確認し、DB 結合テストで article_image テーブルの整合性が維持されていることを確認する。インフラ — N/A: 本 phase はデプロイ単位を変更しないため IaC 静的検証・smoke テストは対象外。
- 保守性制約: pixel 位置依存のスクリーンショット比較を避け、DOM 構造への依存を最小化し、リファクタリングはテストが全件緑の状態で1ステップずつ行い、各ステップで `pnpm vitest run` を実行して退行が無いことを確認する。

## Verification and evidence

- Automated commands: `pnpm run typecheck`
- Automated commands: `pnpm run lint`
- Automated commands: `pnpm vitest run --reporter=dot`
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor`
- Required evidence: P08 の 成果物 section に記載した produced artifacts のパスと、退行テスト全件 PASS の記録

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: P05 の実装の技術的負債を整理し、既存 10種記事が新しい parseProse で壊れずに読み込め、保存し直しても内容が変わらないことを確認する。
- Generic execution prompt: feat-article-block-editor の goal と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P08 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・退行テスト全件 PASS・カバレッジ 80% 維持・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: リファクタリングで退行が発生した場合は直ちに revert し、原因を特定してから再試行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A — P13 owns writeback

## Rollout and rollback

- Rollout: P08 の成果物を write_scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: 退行が解決できない場合、P08 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: P05 done + 退行テスト全件 PASS + pnpm vitest run が 0件失敗

## 参照情報

- System specification: system-spec/backend.md, system-spec/database.md, system-spec/frontend.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-article-block-editor
- Dependencies: SYS-ARTICLE-BLOCK-EDITOR-P05

## task-spec validation

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` で published task spec と package 全体を再検証する。

## 実行契約

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: current pointer から現行世代を解決する `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` で published task spec と package 全体を再検証する。
