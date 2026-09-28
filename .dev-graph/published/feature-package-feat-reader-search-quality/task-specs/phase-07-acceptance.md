# System task overlay: A1-A8のfeature受入

## Machine-readable registration fields

- feature_package_id: feature-package/feat-reader-search-quality
- owners: ["daishiman"]
- tags: ["p07", "feat-reader-search-quality"]
- related_nodes: ["spec-system-spec-index", "arch-system-spec-overview"]
- parent_feature: feat-reader-search-quality
- phase_ref: P07
- classification: confidence=1.0; reason=feat-reader-search-qualityのP07 lifecycle責務への確定写像; candidate=tasks/feat-reader-search-quality/sys-reader-search-quality-p07.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

feature受入A1-A8を実画面と保存済みdataで検証し、索引追従・日本語部分一致・JavaScript無効完走・画面/WebMCP同一結果を測定する。

## 背景

読者が言葉から記事へ到達できるようにし、検索窓はあるのに index が無く実質使えない状態を解消する。現状の searchArticles ユースケースは published_articles の題名・要約に対する LIKE 部分一致に留まり、本文は検索されず関連度・新しさによる順位付けも無い。D1 上の FTS5 trigram 索引を公開記事から自動で保ち、日本語の部分一致でも妥当な順で結果が返り、検索結果面がサムネイル付きで表示され、JavaScript が無効でも検索が完了し、画面の検索と WebMCP 道具 searchArticles が同一ユースケースを通り、検索の入口が構造化データと llms.txt にも表れている状態にする。本phaseはSYS-READER-SEARCH-QUALITY-P06の確定成果物を入力にする。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-reader-search-quality, spec-system-spec-index, arch-system-spec-overview, SYS-READER-SEARCH-QUALITY-P06
- Entry gate: depends_onの全taskがdoneまたはclosed
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 検索結果面と二経路入口を実画面で受入する
- Backend: applicable; 索引追従と順位付け結果を保存済みdataと照合する
- API: applicable; 画面とWebMCPのsearchArticles応答一致を確認する
- Data: applicable; DB結合後の索引整合を確認する
- Infrastructure: N/A: development環境で受入する
- Security: applicable; 非公開記事非流出をnetwork trace/実データで確認する
- Quality: applicable; A1-A8全件を二値判定する
- Documentation: applicable; reportを正本化する
- Operations: applicable; 0件時代替提案の実地確認結果を記録する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app。検索索引はD1のFTS5仮想表に持ち、記事本文の正本はpublished_articles、索引はそこから導かれる読み取り専用の派生物とする
- Compatibility/migration/backfill: 既存のSearchBox(method=get)・searchArticlesユースケース・published_articles schemaとの後方互換を保ち、破壊的移行はP08のdry-runとrollback証跡なしに実行しない

## 成果物

- Produced artifacts: A1-A8 acceptance report
- Consumed artifacts: features/feat-reader-search-quality.md, features/feat-reader-search-quality.context.json, system-spec/backend.md, system-spec/database.md, system-spec/retrieval-evidence/kajetblog-top-analysis.md, SYS-READER-SEARCH-QUALITY-P06
- Write scope/touches: docs/spec/feat-reader-search-quality/acceptance-report.md

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads bindingではGitHub Projectsを更新しない
- PR completion policy: linked_pr_merged_all
- PR body contract: Beads issue参照とdev-graph graph_node_id=SYS-READER-SEARCH-QUALITY-P07を記載し、target branchはdevとする
- Ownership boundary: system-dev-plannerはintentを宣言し、dev-graphが起票・依存・完了収束を所有する

## Branch and worktree execution

- Branch: dev-graph登録後にC15がdevgraph/SYS-READER-SEARCH-QUALITY-P07として割り当てる
- Worktree lease: 実装開始前にSYS-READER-SEARCH-QUALITY-P07をclaimし、heartbeatとreleaseをlease契約どおり行う
- Parallel safety: depends_on完了、write_scopeとactive leaseの非重複を確認する
- Completion projection: feature branchはpending eventだけを残し、default branch reconciliationでdurable doneを確定する

## スコープ外

- 全文検索の外部SaaS利用
- AIによる回答生成と対話 (feat-ai-assistant)
- 商品横断の比較検索 (feat-comparison-engine)
- トップページ上の検索窓の配置と見た目、およびWebSite/SearchAction/ItemListのJSON-LD生成そのもの (feat-blog-top-page-compositionが所有)
- 管理画面内の記事検索。読者向け公開面だけを対象とし、管理画面側の検索は本featureの範囲外とする

## テスト戦略

- テストレベル選定: 単体はFTS5索引ranking関数・2文字以下フォールバック判定・検索語literal化の純粋関数を検証する。結合はD1接続とusecase境界(searchArticles)を検証する。E2Eは検索ページ・ヘッダー起動・JavaScript無効時のmethod=get完走を検証する。境界値は空文字列・多バイト文字・2文字以下・長大問い合わせ・索引未反映・D1障害を検証する。回帰は既存SearchBox・既存LIKE検索結果との後方互換を保つ。
- カバレッジ目標: 新規または変更するapplication codeは既定80%を下回らず、画面とWebMCP道具searchArticlesの同一結果契約テストは対象関数100%網羅を要求する。
- 層別方針: Frontendは可視ラベルとアクセシブル名によるbehavior検証とJavaScript無効時の完走検証、BackendはD1結合とAPI契約、InfrastructureはIaC静的検証とdevelopment smokeを使う。
- 保守性制約: pixel位置依存とDOM構造依存のassertを禁止し、操作結果・状態・契約・検索応答の内容を検証する。

## Verification and evidence

- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-reader-search-quality`
- Automated commands: `pnpm typecheck`、`pnpm content:validate`、対象test suite。実装を持たないphaseは適用外理由をreportへ残す
- Required evidence: docs/spec/feat-reader-search-quality/acceptance-report.md
- Acceptance state: P07: A1-A8の全件が手順・expected・actual・evidenceでPASSし、公開・更新・非公開化それぞれで索引追従を実データで確認し、日本語部分一致で結果が返り無関係な語で0件になることを実測し、JavaScript無効での検索完走をnetwork trace/screenshotで確認し、画面とWebMCPのsearchArticlesが同一入力で同一結果を返すことをacceptance-reportに記録する。

## Inner goal-seek execution loop

- Methodology contract: system-task-goal-seek/v1
- Goal: feature受入A1-A8を実画面と保存済みdataで検証し、索引追従・日本語部分一致・JavaScript無効完走・画面/WebMCP同一結果を測定する。
- Generic execution prompt: feature goal、当phaseの目的、depends_on成果物、write_scope、scope_outを入力し、手段を固定せず観測可能なacceptanceを満たす成果物を作る
- Rubric: 当task acceptance、既定80% coverage、回帰0、required evidence、write_scope厳守の全項目
- Feedback loop: 実装と独立した評価へ渡し、findingを次周のpromptへ反映してrubric verdict=PASSまで反復する。上限到達時はfail-closedで前phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13が所有する。

## Rollout and rollback

- Rollout: A1-A8 acceptance reportをwrite_scope内へ適用し、検証PASS後に依存する次phaseへ渡す
- Rollback trigger and steps: P07のrubric verdictがFAILのまま上限へ到達した場合、write_scope内の当phase変更を戻し、直前のpromoted generationへ復帰する

## Handoff

- Executor: system build route。dev-graph登録とworktree claim後に実行する
- Ready when: confirmed、evaluation pass、implementation readiness complete、promoted digest、dev-graph exact-13 registrationが揃う
- Completion condition: P07: A1-A8の全件が手順・expected・actual・evidenceでPASSし、公開・更新・非公開化それぞれで索引追従を実データで確認し、日本語部分一致で結果が返り無関係な語で0件になることを実測し、JavaScript無効での検索完走をnetwork trace/screenshotで確認し、画面とWebMCPのsearchArticlesが同一入力で同一結果を返すことをacceptance-reportに記録する。

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-reader-search-quality
- Phase doc: .claude/plugins/system-dev-planner/references/system-plan-phase-names.md#P07
- Dependencies: SYS-READER-SEARCH-QUALITY-P06
