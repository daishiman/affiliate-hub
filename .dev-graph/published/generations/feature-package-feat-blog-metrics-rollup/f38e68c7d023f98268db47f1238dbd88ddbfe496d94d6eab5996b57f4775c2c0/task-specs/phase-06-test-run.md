# System task overlay: 日次ロールアップのテスト実行と緑化

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-metrics-rollup
- owners: ["daishiman"]
- tags: ["p06", "feat-blog-metrics-rollup"]
- related_nodes: []
- parent_feature: feat-blog-metrics-rollup
- phase_ref: P06
- classification: confidence=1.0; reason=feat-blog-metrics-rollup の P06 lifecycle 責務への確定写像; candidate=tasks/feat-blog-metrics-rollup/sys-blog-metrics-rollup-p06.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04 で設計した全テストケースを実行し、失敗0件かつ新規実装コードのカバレッジが80%以上である状態を成立させる。

## 背景

冪等性と合計整合は、実行して初めて崩れが見える。特に記事合計とブログ値の一致は、丸め処理の入れ方で崩れやすい。

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
- Operations: applicable; 定期実行の失敗検知と手動再実行を扱う

## Architecture and deploy unit

- Architecture decisions: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存資産との重複解消と移行は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-blog-metrics-rollup/test-run-report.md (実行結果とカバレッジ); tests/ 配下の日次ロールアップ関連テスト実装
- Consumed artifacts: features/feat-blog-metrics-rollup.md; features/feat-blog-metrics-rollup.context.json; system-spec/backend.md; system-spec/database.md; system-spec/maintenance-ops.md
- Write scope/touches: tests/, docs/spec/feat-blog-metrics-rollup/test-run-report.md

## Tracker publication and completion

> 本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-BLOG-METRICS-ROLLUP-P06; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-BLOG-METRICS-ROLLUP-P06; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-BLOG-METRICS-ROLLUP-P06 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-blog-metrics-rollup 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- 生の行動イベントの収集そのもの (feat-reader-behavior-analytics が所有する)
- 集計結果の画面表示と示唆生成 (feat-blog-scoped-admin-console が所有する)
- アフィリエイト成果の外部取り込み経路 (既存 feature が所有する)
- 日次より細かい粒度でのリアルタイム集計 (作らない)
- P06 以外の phase が所有する成果物への変更

## テスト戦略

- テストレベル選定: P04 のケース表を全件実行し、失敗したケースは実装 phase へ差し戻す。カバレッジ不足は追加ケースで埋める。 N/A: 単体・結合・境界値・回帰 の各テストレベルは、本 task の成果物が文書と判定であり実行可能なコードを含まないため適用しない。
- カバレッジ目標: 既定 80% を新規実装コード (src/domain/analytics, src/application/analytics, src/infrastructure/scheduled) に適用する。
- 層別方針: フロントエンドは可視ラベルとアクセシブル名による behavior 検証、バックエンド/API/データは API 契約テストとロジック単体テストと DB 結合テスト (D1) で検証、インフラは IaC 静的検証とデプロイ後の smoke 検証で確認する。
- 保守性制約: pixel 位置依存・DOM 構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm vitest run --coverage` (全テストの緑化とカバレッジ80%以上を確認する)
- Automated commands: `pnpm run typecheck` (テスト実装を含めた型整合を確認する)
- Required evidence: P06 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: P04 で設計した全テストケースを実行し、失敗0件かつ新規実装コードのカバレッジが80%以上である状態を成立させる。
- Generic execution prompt: feat-blog-metrics-rollup の goal (記事ごとの売上と PV、滞在・スクロール到達・クリック率が同じ日次行に載り、ブログ単位へ集計され、同じ日を何度処理しても結果が置き換わるだけで二重計上せず、標本数が少ない行は推測に足りないと判る状態になっている) と本 task の 前提条件/成果物/write scope/スコープ外 を渡し、実装手段は固定せず P06 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件・カバレッジ目標 green・既存テストの回帰0件・Required evidence の証跡取得・write scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10 相当) へ渡し、finding を Generic execution prompt へ反映して再実行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P06 の成果物を write scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P06 の write scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 全テストが緑でカバレッジ目標を満たし、受入判定へ進める

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/maintenance-ops.md
- Architecture: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Feature: feat-blog-metrics-rollup
- Phase doc: system-plan-phase-names.md#P06
- Dependencies: SYS-BLOG-METRICS-ROLLUP-P05
