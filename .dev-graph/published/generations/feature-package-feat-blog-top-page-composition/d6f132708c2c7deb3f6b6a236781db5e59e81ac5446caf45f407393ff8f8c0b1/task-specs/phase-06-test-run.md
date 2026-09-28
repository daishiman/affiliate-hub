# System task overlay: 単体・結合・境界値・回帰・a11y・no-jsテストの実行

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-top-page-composition
- owners: ["daishiman"]
- tags: ["p06", "feat-blog-top-page-composition"]
- related_nodes: ["spec-system-spec-index", "arch-system-spec-overview"]
- parent_feature: feat-blog-top-page-composition
- phase_ref: P06
- classification: confidence=1.0; reason=feat-blog-top-page-compositionのP06 lifecycle責務への確定写像; candidate=tasks/feat-blog-top-page-composition/sys-blog-top-page-composition-p06.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04のA1-A8 test/evidence matrixに従い、characterizationとgap test、カードcategory/date、100/101件、全件featured、ratings/read failure、axe-core、no-js、src限定非模倣を実行する。P01/P04由来のacceptance_contract_digestと、実際にテストしたcode_artifact_digestを別々にtest-run reportへ残し、raw report参照を後者へ結び付ける。

## 背景

実装(P05)とテスト実行(P06)を分離することで、実装者が自分のテストだけを恣意的にGREENにする状態を防ぎ、決定論的な実行結果を証跡として残す。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-top-page-composition, spec-system-spec-index, arch-system-spec-overview, SYS-BLOG-TOP-PAGE-COMPOSITION-P05
- Entry gate: depends_onの全taskがdoneまたはclosed
- P01 upstream entry gate: N/A: intra-feature depends_on gate
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Planner runtime pin: system-dev-planner v0.1.10。host skill pathからplugin rootを解決して`SYSTEM_DEV_PLANNER_ROOT`へ設定し、repository内の別versionを暗黙選択しない
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 区画構成・カード・追従ヘッダー・フッターのbehaviorテストとaxe-coreスキャンを実行する
- Backend: N/A: サービス実装を伴わない
- API: applicable; ?sort=latest|popularのno-js e2eテストを実行する
- Data: N/A: DBスキーマ変更を伴わない
- Infrastructure: N/A: 配備変更を伴わない
- Security: applicable; 非模倣静的検査を実行する
- Quality: applicable; 全テストの実行結果とcoverageを記録する
- Documentation: applicable; test-run reportを正本化する
- Operations: N/A: 運用手順の変更を伴わない

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app。読者向けトップページの配信先をこのunitへ固定する
- Compatibility/migration/backfill: 既存のブログトップ(src/app/s/[site]/page.tsx)・記事一覧・カテゴリ導線との後方互換を保ち、破壊的移行はP08のdry-runとrollback証跡なしに実行しない

## 成果物

- Produced artifacts: A1-A8 matrixに対応するtest-run report(単体/結合/境界/failure injection/characterization/gap/axe/no-js/non-imitationの結果、P01/P04と同じacceptance_contract_digest、テスト対象のcode_artifact_digest、coverage)
- Consumed artifacts: docs/spec/feat-blog-top-page-composition/acceptance-traceability.json, docs/spec/feat-blog-top-page-composition/acceptance-test-evidence-matrix.json, src/app/s/[site]/page.tsx, src/presentation/site/home-content.tsx, src/presentation/site/blog-top-bands.tsx, tests/blog-top-page/*
- Write scope/touches: docs/spec/feat-blog-top-page-composition/test-run-report.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads bindingではGitHub Projectsを更新しない
- PR completion policy: linked_pr_merged_all
- PR body contract: Beads issue参照とdev-graph graph_node_id=SYS-BLOG-TOP-PAGE-COMPOSITION-P06を記載し、target branchはdevとする
- Ownership boundary: system-dev-plannerはintentを宣言し、dev-graphが起票・依存・完了収束を所有する

## Branch and worktree execution

- Branch: dev-graph登録後にC15がdevgraph/SYS-BLOG-TOP-PAGE-COMPOSITION-P06として割り当てる
- Worktree lease: 実装開始前にSYS-BLOG-TOP-PAGE-COMPOSITION-P06をclaimし、heartbeatとreleaseをlease契約どおり行う
- Parallel safety: depends_on完了、write_scopeとactive leaseの非重複を確認する
- Completion projection: feature branchはpending eventだけを残し、default branch reconciliationでdurable doneを確定する

## スコープ外

- sticky ヘッダー / サイドバー / フッターの部品実装そのものとテンプレート・配色の選択UI (feat-blog-ui-builder)
- サムネイル画像の登録・生成・保存・配信 (feat-thumbnail-visual-system)
- 検索の索引作成・順位付け・結果面 (feat-reader-search-quality)
- 記事本文ページの構成と記事タイプ別レイアウト (feat-reader-surface)
- 管理画面の画面構成。本featureは読者向けトップページ1画面だけを対象とする。自動反映された変更を運営者が辿る履歴・差分・取り消しの面はfeat-seo-aeo-measurement-loopの所有
- 参照サイトの解析・URL台帳化そのもの (feat-reference-blog-admin-ux)

## テスト戦略

- テストレベル選定: 単体はセクション順序決定・カード非空判定(自動生成OGP fallback選択含む)・URLパラメータ解析(sort=latest|popular)の純粋関数を検証する。結合はSSRされたトップページとJSON-LD生成・非模倣静的検査ツールの結合を検証する。境界値は空状態(記事0件)・画像不在記事・極端に長い題名・多バイト文字・sort未指定/不正値を検証する。回帰は既存のブログトップ(src/app/s/[site]/page.tsx)の記事一覧・カテゴリ一覧・検索導線・固定ページ導線を保つ。
- カバレッジ目標: 新規または変更するapplication codeは既定80%を下回らない。層別の上書きはせず、非模倣静的検査の判定関数は100%網羅を目標とする。
- 層別方針: Frontendは可視ラベルとaxe-coreによるbehaviorベースの検証を使う。Backendはapplicableの場合のみAPI 契約とDB 結合を確認する統合テストを使い、N/Aの場合は適用外理由を証跡化する。Infrastructureはapplicableの場合のみIaC静的検証とsmokeテストを使い、N/Aの場合は適用外理由を証跡化する。
- 保守性制約: pixel位置依存とDOM構造依存のassertを禁止し、role/name/状態などアクセシブルな契約と出力データの契約で検証する。実装詳細に密結合した過剰テストを作らない。

## Verification and evidence

- Automated commands: `python3 "$SYSTEM_DEV_PLANNER_ROOT/scripts/validate-system-plan.py" --repo-root . --staging .dev-graph/staging/run-20260905-feat-blog-top-dependency-fix`
- Automated commands: `pnpm typecheck`、`pnpm lint`、`pnpm test`、対象test suite(playwright e2eを含む)。実装を持たないphaseは適用外理由をreportへ残す
- Required evidence: docs/spec/feat-blog-top-page-composition/test-run-report.md
- Acceptance state: P06: acceptance_contract_digestがP01/P04と一致し、A1-A8 matrixのcharacterization/gap/境界/failure injection/axe/no-js/src限定非模倣が単一のcode_artifact_digestに対して全PASSし、新規/変更application codeのcoverageが既定80%以上であることを記録する。

## Inner goal-seek execution loop

- Methodology contract: system-task-goal-seek/v1
- Goal: P04のacceptance_contract_digestを保ったA1-A8 test/evidence matrixを、P05後の単一code_artifact_digestへ実行し、raw evidence付きtest-run reportを確定する。
- Generic execution prompt: feature goal、当phaseの目的、depends_on成果物、write_scope、scope_outを入力し、手段を固定せず観測可能なacceptanceを満たす成果物を作る
- Rubric: 当task acceptance、既定80% coverage、回帰0、required evidence、write_scope厳守の全項目
- Feedback loop: 実装と独立した評価へ渡し、findingを次周のpromptへ反映してrubric verdict=PASSまで反復する。上限到達時はfail-closedで前phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13が所有する。

## Rollout and rollback

- Rollout: test-run report(単体/結合/境界値/回帰/axe-core/no-js e2e/非模倣静的検査の実行結果とcoverage)をwrite_scope内へ適用し、検証PASS後に依存する次phaseへ渡す
- Rollback trigger and steps: P06のrubric verdictがFAILのまま上限へ到達した場合、write_scope内の当phase変更を戻し、直前のpromoted generationへ復帰する

## Handoff

- Executor: system build route。dev-graph登録とworktree claim後に実行する
- Ready when: confirmed、evaluation pass、implementation readiness complete、promoted digest、dev-graph exact-13 registrationが揃う
- Completion condition: P06: acceptance_contract_digestがP01/P04と一致し、A1-A8 matrixのcharacterization/gap/境界/failure injection/axe/no-js/src限定非模倣が単一のcode_artifact_digestに対して全PASSし、新規/変更application codeのcoverageが既定80%以上であることを記録する。

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-blog-top-page-composition
- Phase doc: .claude/plugins/system-dev-planner/references/system-plan-phase-names.md#P06
- Dependencies: SYS-BLOG-TOP-PAGE-COMPOSITION-P05
