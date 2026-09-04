---
graph_node_id: "SYS-READER-BEHAVIOR-ANALYTICS-P09"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-reader-behavior-analytics"
domain: "quality"
tags: ["p09","feat-reader-behavior-analytics"]
priority: null
start_date: null
target_date: null
iteration: null
title: "読者行動計測の非機能検査"
owners: ["daishiman"]
created_at: "2026-09-03T23:47:24Z"
updated_at: "2026-09-04T02:56:27.812263Z"
status: "active"
depends_on: ["SYS-READER-BEHAVIOR-ANALYTICS-P08"]
related_nodes: []
resource_scope: ["docs/spec/feat-reader-behavior-analytics/quality-report.md","tests/"]
purpose: "計測が読者面の描画性能へ与える影響、計測 script 例外時の非破壊性、reader_key 抽出・削除の権限限定、および 90 日削除の実行を検査し、いずれも基準を満たす状態を成立させる。"
goal: "計測が読者面の描画性能へ与える影響、計測 script 例外時の非破壊性、reader_key 抽出・削除の権限限定、および 90 日削除の実行を検査し、いずれも基準を満たす状態を成立させる。"
scope_in: ["Produced artifacts: docs/spec/feat-reader-behavior-analytics/quality-report.md (性能・非破壊性・権限・保持期間の検査結果)","Consumed artifacts: features/feat-reader-behavior-analytics.md; features/feat-reader-behavior-analytics.context.json; system-spec/frontend.md; system-spec/database.md; system-spec/security.md","Write scope/touches: docs/spec/feat-reader-behavior-analytics/quality-report.md, tests/"]
scope_out: ["1 読者の行動を時系列で再生する機能 (作らない)","日次ロールアップと収益・PV との突合 (feat-blog-metrics-rollup が所有する)","行動指標を使った示唆生成と提示順序 (feat-blog-scoped-admin-console が所有する)","既存の汎用イベント/KPI 基盤そのもの (feat-analytics-insight が所有する)","P09 以外の phase が所有する成果物への変更"]
acceptance: ["Automated commands: `pnpm vitest run` (権限拒否と保持期間削除のテストを再実行する)","Automated commands: `pnpm run build` (本番相当ビルドが通ることを確認する)","Required evidence: quality-report.md に計測有無での描画性能差が記録されていること","Required evidence: P09 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform","arch-blog-operations-console"]
parent_feature: "feat-reader-behavior-analytics"
feature_package_id: "feature-package/feat-reader-behavior-analytics"
phase_ref: "P09"
file_path: "tasks/feat-reader-behavior-analytics/sys-reader-behavior-analytics-p09.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"0991946d448ede0701275e1fb4f83325d708cc03cc042b4c54eb80964782f1d0","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-reader-behavior-analytics/0991946d448ede0701275e1fb4f83325d708cc03cc042b4c54eb80964782f1d0/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-03T23:47:24Z","origin_kind":"system-dev-planner","source_digest":"0991946d448ede0701275e1fb4f83325d708cc03cc042b4c54eb80964782f1d0","source_path":".dev-graph/published/generations/feature-package-feat-reader-behavior-analytics/0991946d448ede0701275e1fb4f83325d708cc03cc042b4c54eb80964782f1d0/task-specs/phase-09-quality-assurance.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-reader-behavior-analytics の P09 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-reader-behavior-analytics/sys-reader-behavior-analytics-p09.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-f4do.9","github_mirror":null,"linked_at":"2026-09-04T02:06:59Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T00:00:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: 読者行動計測の非機能検査

## Machine-readable registration fields

- feature_package_id: feature-package/feat-reader-behavior-analytics
- owners: ["daishiman"]
- tags: ["p09", "feat-reader-behavior-analytics"]
- related_nodes: []
- parent_feature: feat-reader-behavior-analytics
- phase_ref: P09
- classification: confidence=1.0; reason=feat-reader-behavior-analytics の P09 lifecycle 責務への確定写像; candidate=tasks/feat-reader-behavior-analytics/sys-reader-behavior-analytics-p09.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

計測が読者面の描画性能へ与える影響、計測 script 例外時の非破壊性、reader_key 抽出・削除の権限限定、および 90 日削除の実行を検査し、いずれも基準を満たす状態を成立させる。

## 背景

計測は全読者のブラウザで動くため、性能劣化がそのまま読者体験の劣化になる。また保持期間の削除が動かないと、持たないと宣言した情報が残り続けることになる。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-reader-behavior-analytics, system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/frontend.md, system-spec/database.md, system-spec/security.md, system-spec/ui-ux.md, architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: parent_feature.depends_on all done|closed (P01 claim 時に canonical dev-graph の parent feature が持つ depends_on 全件を都度読み、done|closed のときだけ通す派生 gate。upstream ID を task DAG へ複製しない)
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 読者面の計測プローブと管理画面の canvas 重ね描画を扱う
- Backend: applicable; ingest-reader-interactions の追記専用受入を扱う
- API: applicable; sendBeacon が叩く受入エンドポイントの契約を扱う
- Data: applicable; reader_interaction_events の列設計と 90 日削除を扱う
- Infrastructure: N/A: 既存 Workers/D1 デプロイ単位を変更しない
- Security: applicable; reader_key 指定の抽出・削除が Owner 限定であり実行が audit_logs に残ることを検査する
- Quality: applicable; 集計分布としてしか描けないことと計測失敗が読者面を壊さないことを検証する
- Documentation: applicable; 計測項目と保持期間の説明を扱う
- Operations: applicable; 90 日削除の定期実行を検査する

## Architecture and deploy unit

- Architecture decisions: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存資産との重複解消と移行は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-reader-behavior-analytics/quality-report.md (性能・非破壊性・権限・保持期間の検査結果)
- Consumed artifacts: features/feat-reader-behavior-analytics.md; features/feat-reader-behavior-analytics.context.json; system-spec/frontend.md; system-spec/database.md; system-spec/security.md
- Write scope/touches: docs/spec/feat-reader-behavior-analytics/quality-report.md, tests/

## Tracker publication and completion

> 本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-READER-BEHAVIOR-ANALYTICS-P09; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-READER-BEHAVIOR-ANALYTICS-P09; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-READER-BEHAVIOR-ANALYTICS-P09 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-reader-behavior-analytics 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- 1 読者の行動を時系列で再生する機能 (作らない)
- 日次ロールアップと収益・PV との突合 (feat-blog-metrics-rollup が所有する)
- 行動指標を使った示唆生成と提示順序 (feat-blog-scoped-admin-console が所有する)
- 既存の汎用イベント/KPI 基盤そのもの (feat-analytics-insight が所有する)
- P09 以外の phase が所有する成果物への変更

## テスト戦略

- テストレベル選定: 境界値: 計測 script 例外・Owner 未満からの抽出削除要求・90 日境界・audit_logs へ記録されない実行が無いこと。回帰: 既存の権限テストを維持する。 N/A: 単体・結合 の各テストレベルは、本 task の成果物が文書と判定であり実行可能なコードを含まないため適用しない。
- カバレッジ目標: 既定 80% を新規実装コード (src/domain/analytics, src/application/analytics, src/components/reader, src/app/api/reader-events) に適用する。
- 層別方針: フロントエンドは可視ラベルとアクセシブル名による behavior 検証、バックエンド/API/データは API 契約テストとロジック単体テストと DB 結合テスト (D1) で検証、インフラは IaC 静的検証とデプロイ後の smoke 検証で確認する。
- 保守性制約: pixel 位置依存・DOM 構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm vitest run` (権限拒否と保持期間削除のテストを再実行する)
- Automated commands: `pnpm run build` (本番相当ビルドが通ることを確認する)
- Required evidence: quality-report.md に計測有無での描画性能差が記録されていること
- Required evidence: P09 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: 計測が読者面の描画性能へ与える影響、計測 script 例外時の非破壊性、reader_key 抽出・削除の権限限定、および 90 日削除の実行を検査し、いずれも基準を満たす状態を成立させる。
- Generic execution prompt: feat-reader-behavior-analytics の goal (読者面が滞在・スクロール到達・要素クリック・ポインタ標本を要素相対比率で束ねて送り、reader_interaction_events へ追記され、管理画面が viewport_bucket ごとの集計分布としてヒートマップを描き、同意が無い読者は reader_key を持たず 90 日で生データが消える状態になっている) と本 task の 前提条件/成果物/write scope/スコープ外 を渡し、実装手段は固定せず P09 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件・カバレッジ目標 green・既存テストの回帰0件・Required evidence の証跡取得・write scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10 相当) へ渡し、finding を Generic execution prompt へ反映して再実行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P09 の成果物を write scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P09 の write scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 非機能検査の基準未達が0件である

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/frontend.md, system-spec/database.md, system-spec/security.md, system-spec/ui-ux.md
- Architecture: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Feature: feat-reader-behavior-analytics
- Phase doc: system-plan-phase-names.md#P09
- Dependencies: SYS-READER-BEHAVIOR-ANALYTICS-P08
