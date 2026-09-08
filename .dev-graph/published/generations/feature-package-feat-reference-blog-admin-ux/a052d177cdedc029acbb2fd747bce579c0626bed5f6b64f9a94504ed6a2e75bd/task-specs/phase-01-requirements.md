# System task overlay: 全公開URL・画面型・現行画面の要求ベースライン確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-reference-blog-admin-ux
- owners: ["daishiman"]
- tags: ["p01", "feat-reference-blog-admin-ux"]
- related_nodes: ["spec-system-spec-index", "arch-system-spec-overview"]
- parent_feature: feat-reference-blog-admin-ux
- phase_ref: P01
- classification: confidence=1.0; reason=feat-reference-blog-admin-uxのP01 lifecycle責務への確定写像; candidate=tasks/feat-reference-blog-admin-ux/sys-reference-blog-admin-ux-p01.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

14サブサイトマップの全公開canonical URLを重複除外した台帳、画面型分類、型ごとの代表詳細解析、現行の公開面・管理面gap、A1–A12対応表を同じ画面IDと要件IDで確定する。

## 背景

参照ブログの14サブサイトマップと公開URL 1,072件のベースライン、画面型別の共通構成、現行管理画面の実装済み機能とgapを、features/feat-reference-blog-admin-ux.mdのA1–A12へtraceする。情報階層と操作原則だけを抽象化し、第三者の文章・写真・ロゴ・固有名・色値を転用しない。P01は実装前の情報分析を正本化し、後続phaseが推測で画面を作らないための入口である。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-reference-blog-admin-ux, spec-system-spec-index, arch-system-spec-overview
- Entry gate: depends_onの全taskがdoneまたはclosed

- P01 upstream entry gate: parent_feature.depends_on all done|closed。dev-graph正本の依存3 featureがdoneまたはclosedのときだけ着手する。
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 分析成果物の確定だけを行う
- Backend: N/A: サービス実装を行わない
- API: N/A: API実装を行わない
- Data: applicable; URL台帳と画面IDの機械可読schemaを確定する
- Infrastructure: N/A: 配備変更なし
- Security: applicable; 公開URLのみを対象にしアクセス制御回避を禁止する
- Quality: applicable; 全URL被覆とA1–A12の完全対応を検算する
- Documentation: applicable; 分析結果を正本化する
- Operations: applicable; 取得日・失敗理由・再取得方法を残す

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md
- Deploy unit/environment: cloudflare-workers-opennext-app。分析文書だけのphaseも最終的な適用先をこのunitへ固定する
- Compatibility/migration/backfill: 既存blog-ops、content、affiliate link、D1 schemaとの後方互換を保ち、破壊的移行はP08のdry-runとrollback証跡なしに実行しない

## 成果物

- Produced artifacts: 要求ベースライン、全URL台帳、sitemap snapshot、画面型解析、詳細画面一覧、現行画面gap ledger、A1–A12 traceability
- Consumed artifacts: features/feat-reference-blog-admin-ux.md, features/feat-reference-blog-admin-ux.context.json, system-spec/ui-ux.md, system-spec/frontend.md
- Write scope/touches: docs/spec/feat-reference-blog-admin-ux/requirements-baseline.md, docs/spec/feat-reference-blog-admin-ux/reference-url-inventory.json, docs/spec/feat-reference-blog-admin-ux/sitemap-snapshot.json, docs/spec/feat-reference-blog-admin-ux/page-archetype-analysis.md, docs/spec/feat-reference-blog-admin-ux/screen-inventory.md, docs/spec/feat-reference-blog-admin-ux/current-screen-gap-ledger.md, docs/spec/feat-reference-blog-admin-ux/acceptance-traceability.json

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads bindingではGitHub Projectsを更新しない
- PR completion policy: linked_pr_merged_all
- PR body contract: Beads issue参照とdev-graph graph_node_id=SYS-REFERENCE-BLOG-ADMIN-UX-P01を記載し、target branchはdevとする
- Ownership boundary: system-dev-plannerはintentを宣言し、dev-graphが起票・依存・完了収束を所有する

## Branch and worktree execution

- Branch: dev-graph登録後にC15がdevgraph/SYS-REFERENCE-BLOG-ADMIN-UX-P01として割り当てる
- Worktree lease: 実装開始前にSYS-REFERENCE-BLOG-ADMIN-UX-P01をclaimし、heartbeatとreleaseをlease契約どおり行う
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
- Required evidence: docs/spec/feat-reference-blog-admin-ux/requirements-baseline.md, docs/spec/feat-reference-blog-admin-ux/reference-url-inventory.json, docs/spec/feat-reference-blog-admin-ux/sitemap-snapshot.json, docs/spec/feat-reference-blog-admin-ux/page-archetype-analysis.md, docs/spec/feat-reference-blog-admin-ux/screen-inventory.md, docs/spec/feat-reference-blog-admin-ux/current-screen-gap-ledger.md, docs/spec/feat-reference-blog-admin-ux/acceptance-traceability.json
- Acceptance state: P01: 14サブサイトマップと1,072件ベースラインを再取得可能なsitemap-snapshotとURL台帳で検算でき、全URLの画面型未分類0件、各画面型のdesktop/mobile代表解析あり、A1–A12と画面・データ・証跡の未対応0件、現行画面gapの根拠URLまたはローカルroute欠落0件の状態を成立させる。

## Inner goal-seek execution loop

- Methodology contract: system-task-goal-seek/v1
- Goal: 14サブサイトマップの全公開canonical URLを重複除外した台帳、画面型分類、型ごとの代表詳細解析、現行の公開面・管理面gap、A1–A12対応表を同じ画面IDと要件IDで確定する。
- Generic execution prompt: feature goal、当phaseの目的、depends_on成果物、write_scope、scope_outを入力し、手段を固定せず観測可能なacceptanceを満たす成果物を作る
- Rubric: 当task acceptance、既定80% coverage、回帰0、required evidence、write_scope厳守の全項目
- Feedback loop: 実装と独立した評価へ渡し、findingを次周のpromptへ反映してrubric verdict=PASSまで反復する。上限到達時はfail-closedで前phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13が所有する。

## Rollout and rollback

- Rollout: 要求ベースライン、全URL台帳、sitemap snapshot、画面型解析、詳細画面一覧、現行画面gap ledger、A1–A12 traceabilityをwrite_scope内へ適用し、検証PASS後に依存する次phaseへ渡す
- Rollback trigger and steps: P01のrubric verdictがFAILのまま上限へ到達した場合、write_scope内の当phase変更を戻し、直前のpromoted generationへ復帰する

## Handoff

- Executor: system build route。dev-graph登録とworktree claim後に実行する
- Ready when: confirmed、evaluation pass、implementation readiness complete、promoted digest、dev-graph exact-13 registrationが揃う
- Completion condition: P01: 14サブサイトマップと1,072件ベースラインを再取得可能なsitemap-snapshotとURL台帳で検算でき、全URLの画面型未分類0件、各画面型のdesktop/mobile代表解析あり、A1–A12と画面・データ・証跡の未対応0件、現行画面gapの根拠URLまたはローカルroute欠落0件の状態を成立させる。

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-reference-blog-admin-ux
- Phase doc: system-plan-phase-names.md#P01
- Dependencies: なし
