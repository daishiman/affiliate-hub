---
graph_node_id: "SYS-READER-SEARCH-QUALITY-P05"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-reader-search-quality"
domain: "backend"
tags: ["p05","feat-reader-search-quality"]
priority: null
start_date: null
target_date: null
iteration: null
title: "FTS5索引・日本語部分一致検索・検索結果面・二経路入口・WebMCP同一ユースケースの実装"
owners: ["daishiman"]
created_at: "2026-09-04T04:37:54Z"
updated_at: "2026-09-04T04:37:54Z"
status: "active"
depends_on: ["SYS-READER-SEARCH-QUALITY-P04"]
related_nodes: ["spec-system-spec-index","arch-system-spec-overview"]
resource_scope: ["src/domain/blogops/","src/domain/shared/","src/application/ports/site.ts","src/application/usecases/site/read-site.ts","src/infrastructure/persistence/d1/","src/presentation/site/search-box.tsx","src/presentation/site/","src/app/s/[site]/search/","src/presentation/tools/","src/db/schema.ts","drizzle/","tests/"]
purpose: "P04のテストに従い、FTS5索引migration、日本語部分一致検索、検索結果面、二経路入口、画面とWebMCP道具の同一ユースケース化を実装する。"
goal: "P04のテストに従い、FTS5索引migration、日本語部分一致検索、検索結果面、二経路入口、画面とWebMCP道具の同一ユースケース化を実装する。"
scope_in: ["Produced artifacts: FTS5索引usecase、日本語部分一致検索器、検索結果面component、二経路入口、WebMCP道具searchArticles、tests","Consumed artifacts: features/feat-reader-search-quality.md, features/feat-reader-search-quality.context.json, system-spec/backend.md, system-spec/database.md, system-spec/retrieval-evidence/kajetblog-top-analysis.md, SYS-READER-SEARCH-QUALITY-P04","Write scope/touches: src/domain/blogops/, src/domain/shared/, src/application/ports/site.ts, src/application/usecases/site/read-site.ts, src/infrastructure/persistence/d1/, src/presentation/site/search-box.tsx, src/presentation/site/, src/app/s/[site]/search/, src/presentation/tools/, src/db/schema.ts, drizzle/, tests/"]
scope_out: ["全文検索の外部SaaS利用","AIによる回答生成と対話 (feat-ai-assistant)","商品横断の比較検索 (feat-comparison-engine)","トップページ上の検索窓の配置と見た目、およびWebSite/SearchAction/ItemListのJSON-LD生成そのもの (feat-blog-top-page-compositionが所有)","管理画面内の記事検索。読者向け公開面だけを対象とし、管理画面側の検索は本featureの範囲外とする"]
acceptance: ["Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-reader-search-quality`","Automated commands: `pnpm typecheck`、`pnpm content:validate`、対象test suite。実装を持たないphaseは適用外理由をreportへ残す","Required evidence: src/domain/blogops/, src/domain/shared/, src/application/ports/site.ts, src/application/usecases/site/read-site.ts, src/infrastructure/persistence/d1/, src/presentation/site/search-box.tsx, src/presentation/site/, src/app/s/[site]/search/, src/presentation/tools/, src/db/schema.ts, drizzle/, tests/"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: "feat-reader-search-quality"
feature_package_id: "feature-package/feat-reader-search-quality"
phase_ref: "P05"
file_path: "tasks/feat-reader-search-quality/sys-reader-search-quality-p05.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"b55948e2e68707fa2a8b09dbfe1319c1b799fb956a2f6eaa4f667865b9534d5a","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/feature-package-feat-reader-search-quality/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-04T04:37:54Z","origin_kind":"system-dev-planner","source_digest":"b55948e2e68707fa2a8b09dbfe1319c1b799fb956a2f6eaa4f667865b9534d5a","source_path":".dev-graph/published/feature-package-feat-reader-search-quality/task-specs/phase-05-implementation.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-reader-search-qualityのP05 lifecycle責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-reader-search-quality/sys-reader-search-quality-p05.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-kgn0","github_mirror":null,"linked_at":"2026-09-04T07:33:52Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"linked_pr_merged_all","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T03:19:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: FTS5索引・日本語部分一致検索・検索結果面・二経路入口・WebMCP同一ユースケースの実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-reader-search-quality
- owners: ["daishiman"]
- tags: ["p05", "feat-reader-search-quality"]
- related_nodes: ["spec-system-spec-index", "arch-system-spec-overview"]
- parent_feature: feat-reader-search-quality
- phase_ref: P05
- classification: confidence=1.0; reason=feat-reader-search-qualityのP05 lifecycle責務への確定写像; candidate=tasks/feat-reader-search-quality/sys-reader-search-quality-p05.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04のテストに従い、FTS5索引migration、日本語部分一致検索、検索結果面、二経路入口、画面とWebMCP道具の同一ユースケース化を実装する。

## 背景

読者が言葉から記事へ到達できるようにし、検索窓はあるのに index が無く実質使えない状態を解消する。現状の searchArticles ユースケースは published_articles の題名・要約に対する LIKE 部分一致に留まり、本文は検索されず関連度・新しさによる順位付けも無い。D1 上の FTS5 trigram 索引を公開記事から自動で保ち、日本語の部分一致でも妥当な順で結果が返り、検索結果面がサムネイル付きで表示され、JavaScript が無効でも検索が完了し、画面の検索と WebMCP 道具 searchArticles が同一ユースケースを通り、検索の入口が構造化データと llms.txt にも表れている状態にする。本phaseはSYS-READER-SEARCH-QUALITY-P04の確定成果物を入力にする。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-reader-search-quality, spec-system-spec-index, arch-system-spec-overview, SYS-READER-SEARCH-QUALITY-P04
- Entry gate: depends_onの全taskがdoneまたはclosed
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 検索結果面と二経路入口をbehavior契約どおり実装する
- Backend: applicable; FTS5索引migration・順位付け・2文字以下フォールバック・画面/WebMCP同一usecase化を実装する
- API: applicable; 検索ページURL契約とWebMCP道具searchArticlesのAPI境界を実装する
- Data: applicable; D1 FTS5 trigram仮想表と同一トランザクション追随を実装する
- Infrastructure: N/A: 本番配備はP13が所有する
- Security: applicable; 検索語のliteral化を実装する
- Quality: applicable; test-firstでgreenを維持する
- Documentation: applicable; 実装判断をdesign docsへ反映する
- Operations: applicable; 負荷上限・ページングの打ち切り明示を実装する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app。検索索引はD1のFTS5仮想表に持ち、記事本文の正本はpublished_articles、索引はそこから導かれる読み取り専用の派生物とする
- Compatibility/migration/backfill: 既存のSearchBox(method=get)・searchArticlesユースケース・published_articles schemaとの後方互換を保ち、破壊的移行はP08のdry-runとrollback証跡なしに実行しない

## 成果物

- Produced artifacts: FTS5索引usecase、日本語部分一致検索器、検索結果面component、二経路入口、WebMCP道具searchArticles、tests
- Consumed artifacts: features/feat-reader-search-quality.md, features/feat-reader-search-quality.context.json, system-spec/backend.md, system-spec/database.md, system-spec/retrieval-evidence/kajetblog-top-analysis.md, SYS-READER-SEARCH-QUALITY-P04
- Write scope/touches: src/domain/blogops/, src/domain/shared/, src/application/ports/site.ts, src/application/usecases/site/read-site.ts, src/infrastructure/persistence/d1/, src/presentation/site/search-box.tsx, src/presentation/site/, src/app/s/[site]/search/, src/presentation/tools/, src/db/schema.ts, drizzle/, tests/

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads bindingではGitHub Projectsを更新しない
- PR completion policy: linked_pr_merged_all
- PR body contract: Beads issue参照とdev-graph graph_node_id=SYS-READER-SEARCH-QUALITY-P05を記載し、target branchはdevとする
- Ownership boundary: system-dev-plannerはintentを宣言し、dev-graphが起票・依存・完了収束を所有する

## Branch and worktree execution

- Branch: dev-graph登録後にC15がdevgraph/SYS-READER-SEARCH-QUALITY-P05として割り当てる
- Worktree lease: 実装開始前にSYS-READER-SEARCH-QUALITY-P05をclaimし、heartbeatとreleaseをlease契約どおり行う
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
- Required evidence: src/domain/blogops/, src/domain/shared/, src/application/ports/site.ts, src/application/usecases/site/read-site.ts, src/infrastructure/persistence/d1/, src/presentation/site/search-box.tsx, src/presentation/site/, src/app/s/[site]/search/, src/presentation/tools/, src/db/schema.ts, drizzle/, tests/
- Acceptance state: P05: 依存順に、D1 FTS5 trigram索引のmigration、公開・更新・削除・非公開化への同一トランザクション追随、日本語部分一致検索と2文字以下フォールバック(題名前方一致・カテゴリー誘導)、関連度→新しさ→カテゴリー一致の順位付け、検索結果面(件数・一致箇所抜粋・サムネイル・カテゴリー・公開日・0件時代替提案)、二経路の入口(ヘッダー起動・検索ページ)でのJavaScript無効完走、画面のsearchArticlesユースケースとWebMCP道具searchArticlesの同一usecase化、検索語のliteral化と負荷上限・ページングを実装し、P04のテストをgreenにする。既存SearchBox(method=get)を壊さない。

## Inner goal-seek execution loop

- Methodology contract: system-task-goal-seek/v1
- Goal: P04のテストに従い、FTS5索引migration、日本語部分一致検索、検索結果面、二経路入口、画面とWebMCP道具の同一ユースケース化を実装する。
- Generic execution prompt: feature goal、当phaseの目的、depends_on成果物、write_scope、scope_outを入力し、手段を固定せず観測可能なacceptanceを満たす成果物を作る
- Rubric: 当task acceptance、既定80% coverage、回帰0、required evidence、write_scope厳守の全項目
- Feedback loop: 実装と独立した評価へ渡し、findingを次周のpromptへ反映してrubric verdict=PASSまで反復する。上限到達時はfail-closedで前phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13が所有する。

## Rollout and rollback

- Rollout: FTS5索引usecase、日本語部分一致検索器、検索結果面component、二経路入口、WebMCP道具searchArticles、testsをwrite_scope内へ適用し、検証PASS後に依存する次phaseへ渡す
- Rollback trigger and steps: P05のrubric verdictがFAILのまま上限へ到達した場合、write_scope内の当phase変更を戻し、直前のpromoted generationへ復帰する

## Handoff

- Executor: system build route。dev-graph登録とworktree claim後に実行する
- Ready when: confirmed、evaluation pass、implementation readiness complete、promoted digest、dev-graph exact-13 registrationが揃う
- Completion condition: P05: 依存順に、D1 FTS5 trigram索引のmigration、公開・更新・削除・非公開化への同一トランザクション追随、日本語部分一致検索と2文字以下フォールバック(題名前方一致・カテゴリー誘導)、関連度→新しさ→カテゴリー一致の順位付け、検索結果面(件数・一致箇所抜粋・サムネイル・カテゴリー・公開日・0件時代替提案)、二経路の入口(ヘッダー起動・検索ページ)でのJavaScript無効完走、画面のsearchArticlesユースケースとWebMCP道具searchArticlesの同一usecase化、検索語のliteral化と負荷上限・ページングを実装し、P04のテストをgreenにする。既存SearchBox(method=get)を壊さない。

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-reader-search-quality
- Phase doc: .claude/plugins/system-dev-planner/references/system-plan-phase-names.md#P05
- Dependencies: SYS-READER-SEARCH-QUALITY-P04
