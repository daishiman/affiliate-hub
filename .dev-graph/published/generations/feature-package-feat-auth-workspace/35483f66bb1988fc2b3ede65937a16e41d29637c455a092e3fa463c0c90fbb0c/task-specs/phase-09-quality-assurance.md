# System task overlay: 品質・セキュリティ・運用保証

## Machine-readable registration fields

- feature_package_id: feature-package/feat-auth-workspace
- owners: ["daishiman"]
- tags: ["p09", "feat-auth-workspace"]
- related_nodes: []
- parent_feature: feat-auth-workspace
- phase_ref: P09
- classification: confidence=1.0; reason=feat-auth-workspace の P09 lifecycle 責務への確定写像; candidate=tasks/feat-auth-workspace/sys-auth-workspace-p09.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

workspace_id 分離とロール別403制御が、既知の迂回経路 (直接API呼び出し・クエリパラメータ改ざん等) に対しても破られないことを検証し、feat-auth-workspace のセキュリティ品質を確定する。

## 背景

system-spec/security.md が確定した403制御・権限境界の技術投影を根拠に、P05実装が想定外の経路でもworkspace_id 分離とロール制御を維持することを確認する。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-auth-workspace, system-spec/auth.md, system-spec/security.md, system-spec/database.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: N/A: intra-feature depends_on gate
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A: セキュリティ検証はAPI/バックエンド境界を対象とし、UIコードの変更は行わない
- Backend: applicable; workspace_id 分離ロジックへの迂回経路がないことを検証する
- API: applicable; 権限なしロールの操作が全エンドポイントで403になること (A4) を横断的に検証する
- Data: N/A: 本 task はロジック・APIの検証が中心で、スキーマ変更は行わない
- Infrastructure: N/A: 既存 Cloudflare Workers/D1/R2 基盤を変更しない
- Security: applicable; 迂回経路の有無を含む403制御とworkspace_id分離の品質保証を行う
- Quality: applicable; セキュリティ観点の品質保証結果を記録する
- Documentation: applicable; 品質・セキュリティ保証レポートを作成する
- Operations: applicable; 運用時の異常検知観点 (403多発時のアラート要否) を記録する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, system-spec/auth.md, system-spec/security.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: §26.4 workspace_id backfill は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-auth-workspace/quality-security-report.md
- Consumed artifacts: src/lib/workspace/, src/lib/rbac/, src/app/api/
- Write scope/touches: docs/spec/feat-auth-workspace/quality-security-report.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-AUTH-WORKSPACE-P09; default branch target
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-AUTH-WORKSPACE-P09; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-AUTH-WORKSPACE-P09 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on=['P08']の完了 + resource_scope (feat-auth-workspace 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-auth-workspace の scope_out (外部プラットフォームのアカウント接続, 課金, SSO/SCIM) に該当する変更
- write_scope 外のパスへの変更

## テスト戦略

- テストレベル選定: 単体・結合・境界値・回帰の4レベルに加え、迂回経路 (直接API呼び出し・クエリ改ざん) を境界値の追加ケースとして検証する。
- カバレッジ目標: 既定 80% を維持しつつ、workspace_id 分離とRBAC判定コードは追加ケースでのカバレッジ低下がないことを確認する。
- 層別方針: バックエンド/API: API 契約 + ロジック単体 + DB 結合の観点で、迂回経路に対する403判定とworkspace_id分離を検証する。
- 保守性制約: pixel 位置依存・DOM 構造依存のテストは対象外。セキュリティ検証はAPIレスポンスステータスとデータ境界の検証に限定し、実装詳細への密結合を避ける。

## Verification and evidence

- Automated commands: `pnpm run preview` (Workers ランタイム, localhost:8787) 上で P09 に対応する検証コマンドを実行する
- Automated commands: `pnpm vitest run --coverage` (単体/結合/境界値/回帰テストを実行し P09 の証跡を得る)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-auth-workspace` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P09 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: workspace_id 分離とロール別403制御が、既知の迂回経路 (直接API呼び出し・クエリパラメータ改ざん等) に対しても破られないことを検証し、feat-auth-workspace のセキュリティ品質を確定する。
- Generic execution prompt: feat-auth-workspace の goal (Google ログインでサインインし、Workspace/Brandを作成でき、全データがworkspace_idで分離され、ロールに応じた操作制限が効いている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P09 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装→独立評価 (P03/P09/P10相当)→findingをGeneric execution promptへ反映→再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止しP01..現phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P09 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P09 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 4受け入れ条件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/auth.md, system-spec/security.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md
- Feature: feat-auth-workspace
- Phase doc: system-plan-phase-names.md#P09
- Dependencies: SYS-AUTH-WORKSPACE-P08
