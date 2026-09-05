---
graph_node_id: "SYS-BLOG-METRICS-ROLLUP-P05"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-blog-metrics-rollup"
domain: "backend"
tags: ["p05","feat-blog-metrics-rollup"]
priority: null
start_date: null
target_date: null
iteration: null
title: "日次ロールアップ処理の実装"
owners: ["daishiman"]
created_at: "2026-09-03T23:49:24Z"
updated_at: "2026-09-04T02:43:13.574822Z"
status: "active"
depends_on: ["SYS-BLOG-METRICS-ROLLUP-P04"]
related_nodes: []
resource_scope: ["src/db/schema.ts","drizzle/","src/domain/analytics/daily-metrics.ts","src/application/analytics/rollup-daily-metrics.ts","src/infrastructure/scheduled/rollup.ts","wrangler.jsonc"]
purpose: "site_daily_metrics / article_daily_metrics のスキーマ、rollup-daily-metrics の冪等集計 (対象日の削除と挿入を単一 transaction に閉じ、途中失敗時は対象日を実行前の状態へ戻す)、Cloudflare Workers の定期実行、および対象日を指定した再実行の入口を実装した状態を成立させる。"
goal: "site_daily_metrics / article_daily_metrics のスキーマ、rollup-daily-metrics の冪等集計 (対象日の削除と挿入を単一 transaction に閉じ、途中失敗時は対象日を実行前の状態へ戻す)、Cloudflare Workers の定期実行、および対象日を指定した再実行の入口を実装した状態を成立させる。"
scope_in: ["Produced artifacts: src/db/schema.ts の site_daily_metrics / article_daily_metrics 定義と drizzle マイグレーション; src/domain/analytics/daily-metrics.ts の指標値オブジェクトと標本数判定; src/application/analytics/rollup-daily-metrics.ts の冪等集計 (対象日の削除と挿入を単一 transaction に閉じ、部分書き込みを残さない); src/infrastructure/scheduled/rollup.ts の定期実行と再実行入口","Consumed artifacts: features/feat-blog-metrics-rollup.md; features/feat-blog-metrics-rollup.context.json; system-spec/backend.md; system-spec/database.md; system-spec/maintenance-ops.md","Write scope/touches: src/db/schema.ts, drizzle/, src/domain/analytics/daily-metrics.ts, src/application/analytics/rollup-daily-metrics.ts, src/infrastructure/scheduled/rollup.ts, wrangler.jsonc"]
scope_out: ["生の行動イベントの収集そのもの (feat-reader-behavior-analytics が所有する)","集計結果の画面表示と示唆生成 (feat-blog-scoped-admin-console が所有する)","アフィリエイト成果の外部取り込み経路 (既存 feature が所有する)","日次より細かい粒度でのリアルタイム集計 (作らない)","P05 以外の phase が所有する成果物への変更"]
acceptance: ["Automated commands: `pnpm run typecheck` (実装の型整合を確認する)","Automated commands: `pnpm run lint` (静的検査を通すことを確認する)","Automated commands: `pnpm vitest run` (P04 で設計したテストが緑になることを確認する)","Required evidence: P05 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform","arch-blog-operations-console"]
parent_feature: "feat-blog-metrics-rollup"
feature_package_id: "feature-package/feat-blog-metrics-rollup"
phase_ref: "P05"
file_path: "tasks/feat-blog-metrics-rollup/sys-blog-metrics-rollup-p05.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"f38e68c7d023f98268db47f1238dbd88ddbfe496d94d6eab5996b57f4775c2c0","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-blog-metrics-rollup/f38e68c7d023f98268db47f1238dbd88ddbfe496d94d6eab5996b57f4775c2c0/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-03T23:49:24Z","origin_kind":"system-dev-planner","source_digest":"f38e68c7d023f98268db47f1238dbd88ddbfe496d94d6eab5996b57f4775c2c0","source_path":".dev-graph/published/generations/feature-package-feat-blog-metrics-rollup/f38e68c7d023f98268db47f1238dbd88ddbfe496d94d6eab5996b57f4775c2c0/task-specs/phase-05-implementation.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-blog-metrics-rollup の P05 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-blog-metrics-rollup/sys-blog-metrics-rollup-p05.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-q4dt.5","github_mirror":null,"linked_at":"2026-09-04T02:07:47Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T00:00:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: 日次ロールアップ処理の実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-metrics-rollup
- owners: ["daishiman"]
- tags: ["p05", "feat-blog-metrics-rollup"]
- related_nodes: []
- parent_feature: feat-blog-metrics-rollup
- phase_ref: P05
- classification: confidence=1.0; reason=feat-blog-metrics-rollup の P05 lifecycle 責務への確定写像; candidate=tasks/feat-blog-metrics-rollup/sys-blog-metrics-rollup-p05.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

site_daily_metrics / article_daily_metrics のスキーマ、rollup-daily-metrics の冪等集計 (対象日の削除と挿入を単一 transaction に閉じ、途中失敗時は対象日を実行前の状態へ戻す)、Cloudflare Workers の定期実行、および対象日を指定した再実行の入口を実装した状態を成立させる。

## 背景

集計は定期実行で動くため、失敗しても人が気付きにくい。再実行の入口を最初から実装に含め、失敗した日を後から埋め直せるようにする。処理は対象日を丸ごと置き換えるため、再実行が安全である。ただし置き換えを二段階に分けると、失敗した日が半分だけ書かれた状態で残る。削除と挿入は同一 transaction に閉じ、例外時は対象日ごと巻き戻す。

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
- Infrastructure: applicable; wrangler の定期実行設定を本 phase が扱う
- Security: applicable; 再実行入口が workspace 権限で守られることを扱う
- Quality: applicable; 同一日の再処理で二重計上しないことを検証する
- Documentation: applicable; 数値の定義と再実行手順の説明を扱う
- Operations: applicable; 定期実行の失敗検知と手動再実行を扱う

## Architecture and deploy unit

- Architecture decisions: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存資産との重複解消と移行は P08 が所有する

## 成果物

- Produced artifacts: src/db/schema.ts の site_daily_metrics / article_daily_metrics 定義と drizzle マイグレーション; src/domain/analytics/daily-metrics.ts の指標値オブジェクトと標本数判定; src/application/analytics/rollup-daily-metrics.ts の冪等集計 (対象日の削除と挿入を単一 transaction に閉じ、部分書き込みを残さない); src/infrastructure/scheduled/rollup.ts の定期実行と再実行入口
- Consumed artifacts: features/feat-blog-metrics-rollup.md; features/feat-blog-metrics-rollup.context.json; system-spec/backend.md; system-spec/database.md; system-spec/maintenance-ops.md
- Write scope/touches: src/db/schema.ts, drizzle/, src/domain/analytics/daily-metrics.ts, src/application/analytics/rollup-daily-metrics.ts, src/infrastructure/scheduled/rollup.ts, wrangler.jsonc

## Tracker publication and completion

> 本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-BLOG-METRICS-ROLLUP-P05; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-BLOG-METRICS-ROLLUP-P05; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-BLOG-METRICS-ROLLUP-P05 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-blog-metrics-rollup 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- 生の行動イベントの収集そのもの (feat-reader-behavior-analytics が所有する)
- 集計結果の画面表示と示唆生成 (feat-blog-scoped-admin-console が所有する)
- アフィリエイト成果の外部取り込み経路 (既存 feature が所有する)
- 日次より細かい粒度でのリアルタイム集計 (作らない)
- P05 以外の phase が所有する成果物への変更

## テスト戦略

- テストレベル選定: 単体: 指標算出と標本数判定。結合: 集計から2テーブル書き込み、二回実行の同一性、および例外注入時の対象日 rollback。境界値: 入力0件・欠測・日付境界・書き込み途中失敗。回帰: 既存テストを0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/domain/analytics, src/application/analytics, src/infrastructure/scheduled) に適用する。
- 層別方針: フロントエンドは可視ラベルとアクセシブル名による behavior 検証、バックエンド/API/データは API 契約テストとロジック単体テストと DB 結合テスト (D1) で検証、インフラは IaC 静的検証とデプロイ後の smoke 検証で確認する。
- 保守性制約: pixel 位置依存・DOM 構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run typecheck` (実装の型整合を確認する)
- Automated commands: `pnpm run lint` (静的検査を通すことを確認する)
- Automated commands: `pnpm vitest run` (P04 で設計したテストが緑になることを確認する)
- Required evidence: P05 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: site_daily_metrics / article_daily_metrics のスキーマ、rollup-daily-metrics の冪等集計 (対象日の削除と挿入を単一 transaction に閉じ、途中失敗時は対象日を実行前の状態へ戻す)、Cloudflare Workers の定期実行、および対象日を指定した再実行の入口を実装した状態を成立させる。
- Generic execution prompt: feat-blog-metrics-rollup の goal (記事ごとの売上と PV、滞在・スクロール到達・クリック率が同じ日次行に載り、ブログ単位へ集計され、同じ日を何度処理しても結果が置き換わるだけで二重計上せず、標本数が少ない行は推測に足りないと判る状態になっている) と本 task の 前提条件/成果物/write scope/スコープ外 を渡し、実装手段は固定せず P05 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件・カバレッジ目標 green・既存テストの回帰0件・Required evidence の証跡取得・write scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10 相当) へ渡し、finding を Generic execution prompt へ反映して再実行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P05 の成果物を write scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P05 の write scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: P04 のテストケースが実装に対して実行可能になっている

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/maintenance-ops.md
- Architecture: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Feature: feat-blog-metrics-rollup
- Phase doc: system-plan-phase-names.md#P05
- Dependencies: SYS-BLOG-METRICS-ROLLUP-P04
