# System task overlay: workspace_id 移行とスキーマ整備

## Machine-readable registration fields

- feature_package_id: feature-package/feat-auth-workspace
- owners: ["daishiman"]
- tags: ["p08", "feat-auth-workspace"]
- related_nodes: []
- parent_feature: feat-auth-workspace
- phase_ref: P08
- classification: confidence=1.0; reason=feat-auth-workspace の P08 lifecycle 責務への確定写像; candidate=tasks/feat-auth-workspace/sys-auth-workspace-p08.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

全テーブルへの workspace_id 付与 (§26.4) が既存データとの互換性を壊さず適用できることを確定し、A2 (別Workspaceデータの非取得) を将来データに対しても継続保証する状態を成立させる。

## 背景

system-spec/database.md がテナント分離 (§26.4) の技術投影を確定しており、本 feature は新規テーブル前提のためリファクタ不要だが、移行判断そのものは省略せず記録する。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-auth-workspace, system-spec/auth.md, system-spec/security.md, system-spec/database.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: N/A: intra-feature depends_on gate
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 移行判断はスキーマ層のみを対象とし、UI コードへの変更は行わない
- Backend: N/A: 本 task は新規テーブル前提のため既存ロジックのリファクタは不要 (N/A: 初期構築のため移行対象データが存在しない)
- API: N/A: API 契約は本 task では変更しない
- Data: applicable; workspace_id 列・索引の初期マイグレーションを整備する
- Infrastructure: N/A: 既存 Cloudflare D1 基盤を変更しない
- Security: applicable; workspace_id 分離が索引レベルでも保証されることを確認する
- Quality: applicable; マイグレーション適用後も P06 テストが緑であることを確認する
- Documentation: applicable; 移行判断 (リファクタ不要の理由を含む) を記録する
- Operations: N/A: 運用手順は P12/P13 で扱う

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, system-spec/auth.md, system-spec/security.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 新規テーブル前提のため既存データ backfill は不要。将来の他テーブル追加時に本 task の migration 方針を再利用する

## 成果物

- Produced artifacts: drizzle/migrations/ (workspace_id 列・索引の初期マイグレーション), docs/spec/feat-auth-workspace/migration-decision.md
- Consumed artifacts: drizzle/schema/ (P05 実装成果物)
- Write scope/touches: drizzle/migrations/, docs/spec/feat-auth-workspace/migration-decision.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-AUTH-WORKSPACE-P08; default branch target
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-AUTH-WORKSPACE-P08; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-AUTH-WORKSPACE-P08 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on=['P05']の完了 + resource_scope (feat-auth-workspace 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-auth-workspace の scope_out (外部プラットフォームのアカウント接続, 課金, SSO/SCIM) に該当する変更
- write_scope 外のパスへの変更

## テスト戦略

- テストレベル選定: 単体・結合・回帰はマイグレーション適用後に P06 テストスイートを再実行して確認する。境界値: 索引適用後もworkspace_id境界判定が変わらないことを確認する (N/A ではなく実施)。
- カバレッジ目標: 既定 80% を維持していることを P06 テストスイートの再実行結果で確認する。
- 層別方針: バックエンド/API/データ: DB 結合の観点でマイグレーション適用後の workspace_id 索引整合性を検証する (API 契約に変更がないことも合わせて確認する)。
- 保守性制約: pixel 位置依存・DOM 構造依存のテストは対象外。マイグレーション検証はスキーマ・索引の構造検証に限定し、実装詳細への密結合を避ける。

## Verification and evidence

- Automated commands: `pnpm run preview` (Workers ランタイム, localhost:8787) 上で P08 に対応する検証コマンドを実行する
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-auth-workspace` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P08 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: 全テーブルへの workspace_id 付与 (§26.4) が既存データとの互換性を壊さず適用できることを確定し、A2 (別Workspaceデータの非取得) を将来データに対しても継続保証する状態を成立させる。
- Generic execution prompt: feat-auth-workspace の goal (Google ログインでサインインし、Workspace/Brandを作成でき、全データがworkspace_idで分離され、ロールに応じた操作制限が効いている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P08 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装→独立評価 (P03/P09/P10相当)→findingをGeneric execution promptへ反映→再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止しP01..現phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P08 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P08 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 4受け入れ条件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/auth.md, system-spec/security.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md
- Feature: feat-auth-workspace
- Phase doc: system-plan-phase-names.md#P08
- Dependencies: SYS-AUTH-WORKSPACE-P05
