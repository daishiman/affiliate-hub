# System task overlay: アーキテクチャ独立設計レビュー

## Machine-readable registration fields

- feature_package_id: feature-package/feat-auth-workspace
- owners: ["daishiman"]
- tags: ["p03", "feat-auth-workspace"]
- related_nodes: []
- parent_feature: feat-auth-workspace
- phase_ref: P03
- classification: confidence=1.0; reason=feat-auth-workspace の P03 lifecycle 責務への確定写像; candidate=tasks/feat-auth-workspace/sys-auth-workspace-p03.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P02 の設計が feat-auth-workspace の4受け入れ条件を満たせる設計であることを、設計者から独立した観点でレビューし、実装着手前に整合性・網羅性を確定する。

## 背景

system-spec-harness の確定成果物 (system-spec/auth.md・security.md・database.md) と architecture/system-spec-overview.md を正本として、P02 設計がそれらと矛盾しないかを検証する。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-auth-workspace, system-spec/auth.md, system-spec/security.md, system-spec/database.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: N/A: intra-feature depends_on gate
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A: レビューは既存設計文書の査読であり、コード変更を伴わない
- Backend: N/A: レビューは既存設計文書の査読であり、コード変更を伴わない
- API: N/A: レビューは既存設計文書の査読であり、コード変更を伴わない
- Data: N/A: レビューは既存設計文書の査読であり、コード変更を伴わない
- Infrastructure: N/A: 既存 Cloudflare Workers/D1/R2 基盤を変更しない
- Security: applicable; ロール権限 (§25) の403境界が設計上網羅されているかを査読する
- Quality: applicable; 4受け入れ条件それぞれに対応する設計要素の網羅性を判定する
- Documentation: applicable; レビュー結果を文書化する
- Operations: N/A: 運用手順は P12/P13 で扱う

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, system-spec/auth.md, system-spec/security.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: §26.4 workspace_id backfill は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-auth-workspace/design-review-log.md (指摘事項と解消記録)
- Consumed artifacts: docs/spec/feat-auth-workspace/architecture-design.md
- Write scope/touches: docs/spec/feat-auth-workspace/design-review-log.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-AUTH-WORKSPACE-P03; default branch target
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-AUTH-WORKSPACE-P03; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-AUTH-WORKSPACE-P03 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on=['P02']の完了 + resource_scope (feat-auth-workspace 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-auth-workspace の scope_out (外部プラットフォームのアカウント接続, 課金, SSO/SCIM) に該当する変更
- write_scope 外のパスへの変更

## テスト戦略

- テストレベル選定: 単体・結合・境界値・回帰は本 task が直接実装しないため N/A: 設計文書レビューのみを行い、実行コードを持たない。
- カバレッジ目標: 既定 80% を P05/P06 が満たすべき目標としてレビュー観点に含め、数値目標自体の変更は行わない。
- 層別方針: N/A: 設計文書レビューのみを対象とし、Frontend/Backend/API/Data いずれのコード層も変更しない。
- 保守性制約: レビュー観点として pixel 位置依存・DOM 構造依存のテスト設計を指摘対象に含め、実装詳細への密結合を許容しない基準をレビュー基準に明記する。

## Verification and evidence

- Automated commands: `pnpm run preview` (Workers ランタイム, localhost:8787) 上で P03 に対応する検証コマンドを実行する
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-auth-workspace` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P03 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: P02 の設計が feat-auth-workspace の4受け入れ条件を満たせる設計であることを、設計者から独立した観点でレビューし、実装着手前に整合性・網羅性を確定する。
- Generic execution prompt: feat-auth-workspace の goal (Google ログインでサインインし、Workspace/Brandを作成でき、全データがworkspace_idで分離され、ロールに応じた操作制限が効いている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P03 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装→独立評価 (P03/P09/P10相当)→findingをGeneric execution promptへ反映→再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止しP01..現phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P03 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P03 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 4受け入れ条件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/auth.md, system-spec/security.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md
- Feature: feat-auth-workspace
- Phase doc: system-plan-phase-names.md#P03
- Dependencies: SYS-AUTH-WORKSPACE-P02
