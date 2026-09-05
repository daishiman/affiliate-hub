# System task overlay: 日次ロールアップの非機能検査

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-metrics-rollup
- owners: ["daishiman"]
- tags: ["p09", "feat-blog-metrics-rollup"]
- related_nodes: []
- parent_feature: feat-blog-metrics-rollup
- phase_ref: P09
- classification: confidence=1.0; reason=feat-blog-metrics-rollup の P09 lifecycle 責務への確定写像; candidate=tasks/feat-blog-metrics-rollup/sys-blog-metrics-rollup-p09.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

集計処理の実行時間と Workers の実行制限との余裕、再実行入口の権限限定、定期実行が失敗したときの検知可能性を検査し、いずれも基準を満たす状態を成立させる。

## 背景

日次集計は記事数の増加とともに重くなる。実行制限に達すると、その日の数字が静かに欠落する。実行時間の余裕と失敗の見え方に加え、実行制限で中断した場合に部分的に書かれた日が残らないことを、運用に入る前に検査する。

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
- Documentation: applicable; 数値の定義と再実行手順の説明を扱う
- Operations: applicable; 定期実行失敗の検知手段を検査する

## Architecture and deploy unit

- Architecture decisions: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存資産との重複解消と移行は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-blog-metrics-rollup/quality-report.md (実行時間・権限・失敗検知・失敗注入時の部分書き込み有無・生イベント削除後の集計済み行の不変性の検査結果)
- Consumed artifacts: features/feat-blog-metrics-rollup.md; features/feat-blog-metrics-rollup.context.json; system-spec/backend.md; system-spec/database.md; system-spec/maintenance-ops.md
- Write scope/touches: docs/spec/feat-blog-metrics-rollup/quality-report.md, tests/

## Tracker publication and completion

> 本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-BLOG-METRICS-ROLLUP-P09; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-BLOG-METRICS-ROLLUP-P09; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-BLOG-METRICS-ROLLUP-P09 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-blog-metrics-rollup 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- 生の行動イベントの収集そのもの (feat-reader-behavior-analytics が所有する)
- 集計結果の画面表示と示唆生成 (feat-blog-scoped-admin-console が所有する)
- アフィリエイト成果の外部取り込み経路 (既存 feature が所有する)
- 日次より細かい粒度でのリアルタイム集計 (作らない)
- P09 以外の phase が所有する成果物への変更

## テスト戦略

- テストレベル選定: 境界値: 大量記事・実行制限近傍・権限不足からの再実行要求・入力ソース障害・書き込み途中での実行中断・90 日削除後の再参照。回帰: 既存の権限テストを維持する。 N/A: 単体・結合 の各テストレベルは、本 task の成果物が文書と判定であり実行可能なコードを含まないため適用しない。
- カバレッジ目標: 既定 80% を新規実装コード (src/domain/analytics, src/application/analytics, src/infrastructure/scheduled) に適用する。
- 層別方針: フロントエンドは可視ラベルとアクセシブル名による behavior 検証、バックエンド/API/データは API 契約テストとロジック単体テストと DB 結合テスト (D1) で検証、インフラは IaC 静的検証とデプロイ後の smoke 検証で確認する。
- 保守性制約: pixel 位置依存・DOM 構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm vitest run` (権限拒否と失敗検知のテストを再実行する)
- Automated commands: `pnpm run build` (本番相当ビルドが通ることを確認する)
- Required evidence: quality-report.md に想定記事数での実行時間見積が記録されていること
- Required evidence: P09 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: 集計処理の実行時間と Workers の実行制限との余裕、再実行入口の権限限定、定期実行が失敗したときの検知可能性を検査し、いずれも基準を満たす状態を成立させる。
- Generic execution prompt: feat-blog-metrics-rollup の goal (記事ごとの売上と PV、滞在・スクロール到達・クリック率が同じ日次行に載り、ブログ単位へ集計され、同じ日を何度処理しても結果が置き換わるだけで二重計上せず、標本数が少ない行は推測に足りないと判る状態になっている) と本 task の 前提条件/成果物/write scope/スコープ外 を渡し、実装手段は固定せず P09 の目的を満たす成果物を作らせる
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

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/maintenance-ops.md
- Architecture: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Feature: feat-blog-metrics-rollup
- Phase doc: system-plan-phase-names.md#P09
- Dependencies: SYS-BLOG-METRICS-ROLLUP-P08
