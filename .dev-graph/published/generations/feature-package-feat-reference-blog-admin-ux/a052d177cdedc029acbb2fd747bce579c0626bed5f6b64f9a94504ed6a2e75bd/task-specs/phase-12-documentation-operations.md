# System task overlay: 管理者ガイド・分析更新runbook・障害対応の確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-reference-blog-admin-ux
- owners: ["daishiman"]
- tags: ["p12", "feat-reference-blog-admin-ux"]
- related_nodes: ["spec-system-spec-index", "arch-system-spec-overview"]
- parent_feature: feat-reference-blog-admin-ux
- phase_ref: P12
- classification: confidence=1.0; reason=feat-reference-blog-admin-uxのP12 lifecycle責務への確定写像; candidate=tasks/feat-reference-blog-admin-ux/sys-reference-blog-admin-ux-p12.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

新規作成・改善・保存・affiliate確認を迷わない短い管理者ガイドにし、分析snapshot更新、preview失敗、stale価格/画像、rollback、問い合わせ対応を運用可能にする。

## 背景

参照ブログの14サブサイトマップと公開URL 1,072件のベースライン、画面型別の共通構成、現行管理画面の実装済み機能とgapを、features/feat-reference-blog-admin-ux.mdのA1–A12へtraceする。情報階層と操作原則だけを抽象化し、第三者の文章・写真・ロゴ・固有名・色値を転用しない。本phaseはSYS-REFERENCE-BLOG-ADMIN-UX-P10 と SYS-REFERENCE-BLOG-ADMIN-UX-P11の確定成果物を入力にする。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-reference-blog-admin-ux, spec-system-spec-index, arch-system-spec-overview, SYS-REFERENCE-BLOG-ADMIN-UX-P10, SYS-REFERENCE-BLOG-ADMIN-UX-P11
- Entry gate: depends_onの全taskがdoneまたはclosed

- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 画面ラベルに一致する操作ガイドを作る
- Backend: applicable; 保存/preview error recoveryを文書化する
- API: applicable; API 契約とerror taxonomyを確定する
- Data: applicable; DB 結合・retention・restoreを文書化する
- Infrastructure: applicable; IaC/smokeと環境差を文書化する
- Security: applicable; URL安全策と権利境界を文書化する
- Quality: applicable; runbook rehearsalを検証する
- Documentation: applicable; 利用者/運用者handoffを確定する
- Operations: applicable; owner/trigger/escalationを明示する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md
- Deploy unit/environment: cloudflare-workers-opennext-app。分析文書だけのphaseも最終的な適用先をこのunitへ固定する
- Compatibility/migration/backfill: 既存blog-ops、content、affiliate link、D1 schemaとの後方互換を保ち、破壊的移行はP08のdry-runとrollback証跡なしに実行しない

## 成果物

- Produced artifacts: admin guide、analysis refresh runbook、affiliate preview runbook、operations、確定API/data docs
- Consumed artifacts: features/feat-reference-blog-admin-ux.md, features/feat-reference-blog-admin-ux.context.json, system-spec/ui-ux.md, system-spec/frontend.md, SYS-REFERENCE-BLOG-ADMIN-UX-P10, SYS-REFERENCE-BLOG-ADMIN-UX-P11
- Write scope/touches: docs/spec/feat-reference-blog-admin-ux/admin-guide.md, docs/spec/feat-reference-blog-admin-ux/analysis-refresh-runbook.md, docs/spec/feat-reference-blog-admin-ux/affiliate-preview-runbook.md, docs/spec/feat-reference-blog-admin-ux/operations.md, docs/spec/feat-reference-blog-admin-ux/api-contract.md, docs/spec/feat-reference-blog-admin-ux/data-model.md

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads bindingではGitHub Projectsを更新しない
- PR completion policy: linked_pr_merged_all
- PR body contract: Beads issue参照とdev-graph graph_node_id=SYS-REFERENCE-BLOG-ADMIN-UX-P12を記載し、target branchはdevとする
- Ownership boundary: system-dev-plannerはintentを宣言し、dev-graphが起票・依存・完了収束を所有する

## Branch and worktree execution

- Branch: dev-graph登録後にC15がdevgraph/SYS-REFERENCE-BLOG-ADMIN-UX-P12として割り当てる
- Worktree lease: 実装開始前にSYS-REFERENCE-BLOG-ADMIN-UX-P12をclaimし、heartbeatとreleaseをlease契約どおり行う
- Parallel safety: depends_on完了、write_scopeとactive leaseの非重複を確認する
- Completion projection: feature branchはpending eventだけを残し、default branch reconciliationでdurable doneを確定する

## スコープ外

- 認証が必要なページ、アクセス制御の回避、第三者ECの保護APIへの無断接続
- 参照元の文章・写真・ロゴ・イラスト・固有名・色値・theme/plugin資産の複製
- affiliate報酬支払・会計・購入確定、本番公開、承認なしの一括破壊的migration
- feat-reference-blog-admin-uxのscope_outに含まれる作業と、別featureの正本責務

## テスト戦略

- テストレベル選定: 単体は純粋な分類・状態遷移・正規化を検証する。結合はAPIとDB/routeの接続を検証する。境界値は空・重複・timeout・競合・権限・mobileを検証する。回帰は既存blog/content/affiliate/public routeを保つ。
- カバレッジ目標: 新規または変更するapplication codeは既定80%を下回らず、文書phaseはtraceabilityの項目被覆100%を要求する。
- 層別方針: Frontendは可視ラベルとアクセシブル名によるbehavior検証、BackendはAPI 契約・ロジック単体・DB 結合、InfrastructureはIaC静的検証とdevelopment smokeを使う。
- 保守性制約: pixel位置依存とDOM構造依存のassertを禁止し、操作結果・状態・契約を検証する。

## Verification and evidence

- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-reference-blog-admin-ux`
- Automated commands: `pnpm typecheck`、`pnpm content:validate`、対象test suite。実装を持たないphaseは適用外理由をreportへ残す
- Required evidence: docs/spec/feat-reference-blog-admin-ux/admin-guide.md, docs/spec/feat-reference-blog-admin-ux/analysis-refresh-runbook.md, docs/spec/feat-reference-blog-admin-ux/affiliate-preview-runbook.md, docs/spec/feat-reference-blog-admin-ux/operations.md, docs/spec/feat-reference-blog-admin-ux/api-contract.md, docs/spec/feat-reference-blog-admin-ux/data-model.md
- Acceptance state: P12: 初回利用者向けガイドが主タスク4つを各3段階以内の説明で案内し、分析再取得・差分レビュー・preview retry/manual fallback・placement差替え・保存競合復元・rollback・監査確認のrunbookがowner/trigger/command/evidence/escalationを持ち、P02契約が実装確定内容へ更新される。

## Inner goal-seek execution loop

- Methodology contract: system-task-goal-seek/v1
- Goal: 新規作成・改善・保存・affiliate確認を迷わない短い管理者ガイドにし、分析snapshot更新、preview失敗、stale価格/画像、rollback、問い合わせ対応を運用可能にする。
- Generic execution prompt: feature goal、当phaseの目的、depends_on成果物、write_scope、scope_outを入力し、手段を固定せず観測可能なacceptanceを満たす成果物を作る
- Rubric: 当task acceptance、既定80% coverage、回帰0、required evidence、write_scope厳守の全項目
- Feedback loop: 実装と独立した評価へ渡し、findingを次周のpromptへ反映してrubric verdict=PASSまで反復する。上限到達時はfail-closedで前phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13が所有する。

## Rollout and rollback

- Rollout: admin guide、analysis refresh runbook、affiliate preview runbook、operations、確定API/data docsをwrite_scope内へ適用し、検証PASS後に依存する次phaseへ渡す
- Rollback trigger and steps: P12のrubric verdictがFAILのまま上限へ到達した場合、write_scope内の当phase変更を戻し、直前のpromoted generationへ復帰する

## Handoff

- Executor: system build route。dev-graph登録とworktree claim後に実行する
- Ready when: confirmed、evaluation pass、implementation readiness complete、promoted digest、dev-graph exact-13 registrationが揃う
- Completion condition: P12: 初回利用者向けガイドが主タスク4つを各3段階以内の説明で案内し、分析再取得・差分レビュー・preview retry/manual fallback・placement差替え・保存競合復元・rollback・監査確認のrunbookがowner/trigger/command/evidence/escalationを持ち、P02契約が実装確定内容へ更新される。

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-reference-blog-admin-ux
- Phase doc: system-plan-phase-names.md#P12
- Dependencies: SYS-REFERENCE-BLOG-ADMIN-UX-P10, SYS-REFERENCE-BLOG-ADMIN-UX-P11
