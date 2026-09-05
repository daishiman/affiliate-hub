---
graph_node_id: "SYS-BLOG-METRICS-ROLLUP-P13"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-blog-metrics-rollup"
domain: "operations"
tags: ["p13","feat-blog-metrics-rollup"]
priority: null
start_date: null
target_date: null
iteration: null
title: "日次ロールアップのリリースと仕様書への書き戻し"
owners: ["daishiman"]
created_at: "2026-09-03T23:49:24Z"
updated_at: "2026-09-04T02:46:58.134930Z"
status: "active"
depends_on: ["SYS-BLOG-METRICS-ROLLUP-P12"]
related_nodes: []
resource_scope: ["system-spec/backend.md","system-spec/database.md","docs/spec/feat-blog-metrics-rollup/release-notes.md"]
purpose: "日次ロールアップを dev 経由で本番へ反映し、確定した指標定義とテーブル設計を system-spec の該当章へ書き戻した状態を成立させる。"
goal: "日次ロールアップを dev 経由で本番へ反映し、確定した指標定義とテーブル設計を system-spec の該当章へ書き戻した状態を成立させる。"
scope_in: ["Produced artifacts: system-spec/backend.md への集計処理の書き戻し; system-spec/database.md への2テーブルの書き戻し; docs/spec/feat-blog-metrics-rollup/release-notes.md (反映手順と初回集計の実行手順)","Consumed artifacts: features/feat-blog-metrics-rollup.md; features/feat-blog-metrics-rollup.context.json; system-spec/backend.md; system-spec/database.md; system-spec/maintenance-ops.md","Write scope/touches: system-spec/backend.md, system-spec/database.md, docs/spec/feat-blog-metrics-rollup/release-notes.md"]
scope_out: ["生の行動イベントの収集そのもの (feat-reader-behavior-analytics が所有する)","集計結果の画面表示と示唆生成 (feat-blog-scoped-admin-console が所有する)","アフィリエイト成果の外部取り込み経路 (既存 feature が所有する)","日次より細かい粒度でのリアルタイム集計 (作らない)","P13 以外の phase が所有する成果物への変更"]
acceptance: ["Automated commands: `pnpm run build` (本番相当ビルドが通ることを確認する)","Automated commands: `pnpm vitest run` (反映前の全テスト緑を確認する)","Required evidence: release-notes.md に初回集計と切り戻しの手順が記載されていること","Required evidence: P13 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform","arch-blog-operations-console"]
parent_feature: "feat-blog-metrics-rollup"
feature_package_id: "feature-package/feat-blog-metrics-rollup"
phase_ref: "P13"
file_path: "tasks/feat-blog-metrics-rollup/sys-blog-metrics-rollup-p13.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"f38e68c7d023f98268db47f1238dbd88ddbfe496d94d6eab5996b57f4775c2c0","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-blog-metrics-rollup/f38e68c7d023f98268db47f1238dbd88ddbfe496d94d6eab5996b57f4775c2c0/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-03T23:49:24Z","origin_kind":"system-dev-planner","source_digest":"f38e68c7d023f98268db47f1238dbd88ddbfe496d94d6eab5996b57f4775c2c0","source_path":".dev-graph/published/generations/feature-package-feat-blog-metrics-rollup/f38e68c7d023f98268db47f1238dbd88ddbfe496d94d6eab5996b57f4775c2c0/task-specs/phase-13-release-deploy.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-blog-metrics-rollup の P13 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-blog-metrics-rollup/sys-blog-metrics-rollup-p13.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-q4dt.13","github_mirror":null,"linked_at":"2026-09-04T02:08:03Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T00:00:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: 日次ロールアップのリリースと仕様書への書き戻し

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-metrics-rollup
- owners: ["daishiman"]
- tags: ["p13", "feat-blog-metrics-rollup"]
- related_nodes: []
- parent_feature: feat-blog-metrics-rollup
- phase_ref: P13
- classification: confidence=1.0; reason=feat-blog-metrics-rollup の P13 lifecycle 責務への確定写像; candidate=tasks/feat-blog-metrics-rollup/sys-blog-metrics-rollup-p13.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

日次ロールアップを dev 経由で本番へ反映し、確定した指標定義とテーブル設計を system-spec の該当章へ書き戻した状態を成立させる。

## 背景

指標定義は後続の画面 feature が参照する。仕様書へ書き戻して、画面側が定義を再解釈しないようにする。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-metrics-rollup, system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/maintenance-ops.md, architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: parent_feature.depends_on all done|closed (P01 claim 時に canonical dev-graph の parent feature が持つ depends_on 全件を都度読み、done|closed のときだけ通す派生 gate。upstream ID を task DAG へ複製しない)
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 集計結果の描画は feat-blog-scoped-admin-console が所有する
- Backend: applicable; rollup-daily-metrics の集計処理を扱う
- API: applicable; 再実行の入口となる管理用エンドポイントを扱う
- Data: applicable; site_daily_metrics と article_daily_metrics の設計を扱う
- Infrastructure: applicable; Cloudflare Workers の定期実行設定を扱う
- Security: applicable; 再実行入口が workspace 権限で守られることを扱う
- Quality: applicable; 同一日の再処理で二重計上しないことを検証する
- Documentation: applicable; system-spec 該当章への書き戻しを扱う
- Operations: applicable; 定期実行の失敗検知と手動再実行を扱う

## Architecture and deploy unit

- Architecture decisions: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: system-spec への書き戻しは compile-spec-doc.py の正規経路を通し、章を直接編集しない

## 成果物

- Produced artifacts: system-spec/backend.md への集計処理の書き戻し; system-spec/database.md への2テーブルの書き戻し; docs/spec/feat-blog-metrics-rollup/release-notes.md (反映手順と初回集計の実行手順)
- Consumed artifacts: features/feat-blog-metrics-rollup.md; features/feat-blog-metrics-rollup.context.json; system-spec/backend.md; system-spec/database.md; system-spec/maintenance-ops.md
- Write scope/touches: system-spec/backend.md, system-spec/database.md, docs/spec/feat-blog-metrics-rollup/release-notes.md

## Tracker publication and completion

> 本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-BLOG-METRICS-ROLLUP-P13; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-BLOG-METRICS-ROLLUP-P13; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-BLOG-METRICS-ROLLUP-P13 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-blog-metrics-rollup 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- 生の行動イベントの収集そのもの (feat-reader-behavior-analytics が所有する)
- 集計結果の画面表示と示唆生成 (feat-blog-scoped-admin-console が所有する)
- アフィリエイト成果の外部取り込み経路 (既存 feature が所有する)
- 日次より細かい粒度でのリアルタイム集計 (作らない)
- P13 以外の phase が所有する成果物への変更

## テスト戦略

- テストレベル選定: 回帰: 反映前に全テストが緑であることを前提とし、反映後は本番で1日分の集計が二回実行しても同じ結果になることを確認する。 N/A: 単体・結合・境界値 の各テストレベルは、本 task の成果物が文書と判定であり実行可能なコードを含まないため適用しない。
- カバレッジ目標: 既定 80% を新規実装コード (src/domain/analytics, src/application/analytics, src/infrastructure/scheduled) に適用する。
- 層別方針: フロントエンドは可視ラベルとアクセシブル名による behavior 検証、バックエンド/API/データは API 契約テストとロジック単体テストと DB 結合テスト (D1) で検証、インフラは IaC 静的検証とデプロイ後の smoke 検証で確認する。
- 保守性制約: pixel 位置依存・DOM 構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run build` (本番相当ビルドが通ることを確認する)
- Automated commands: `pnpm vitest run` (反映前の全テスト緑を確認する)
- Required evidence: release-notes.md に初回集計と切り戻しの手順が記載されていること
- Required evidence: P13 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: 日次ロールアップを dev 経由で本番へ反映し、確定した指標定義とテーブル設計を system-spec の該当章へ書き戻した状態を成立させる。
- Generic execution prompt: feat-blog-metrics-rollup の goal (記事ごとの売上と PV、滞在・スクロール到達・クリック率が同じ日次行に載り、ブログ単位へ集計され、同じ日を何度処理しても結果が置き換わるだけで二重計上せず、標本数が少ない行は推測に足りないと判る状態になっている) と本 task の 前提条件/成果物/write scope/スコープ外 を渡し、実装手段は固定せず P13 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件・カバレッジ目標 green・既存テストの回帰0件・Required evidence の証跡取得・write scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10 相当) へ渡し、finding を Generic execution prompt へ反映して再実行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: required — 本 phase が実行結果・決定・改善 finding の system-spec / architecture への書き戻しを所有する

## Rollout and rollback

- Rollout: P13 の成果物を write scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P13 の write scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: dev での確認が済み、本番反映と仕様書書き戻しの準備が整っている

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/maintenance-ops.md
- Architecture: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Feature: feat-blog-metrics-rollup
- Phase doc: system-plan-phase-names.md#P13
- Dependencies: SYS-BLOG-METRICS-ROLLUP-P12
