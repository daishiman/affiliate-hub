---
graph_node_id: "SYS-READER-SEARCH-QUALITY-P01"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-reader-search-quality"
domain: "documentation"
tags: ["p01","feat-reader-search-quality"]
priority: null
start_date: null
target_date: null
iteration: null
title: "検索入口2経路・FTS5索引スコープ・URL契約の要求ベースライン確定"
owners: ["daishiman"]
created_at: "2026-09-04T04:37:54Z"
updated_at: "2026-09-04T04:37:54Z"
status: "active"
depends_on: []
related_nodes: ["spec-system-spec-index","arch-system-spec-overview"]
resource_scope: ["docs/spec/feat-reader-search-quality/requirements-baseline.md","docs/spec/feat-reader-search-quality/search-entry-inventory.md","docs/spec/feat-reader-search-quality/fts5-index-scope-analysis.md","docs/spec/feat-reader-search-quality/url-contract-observed-fact.md","docs/spec/feat-reader-search-quality/acceptance-traceability.json"]
purpose: "検索入口2経路のroute台帳、FTS5索引スコープ(題名・要約・本文の3列)分析、URL契約の現況を同じ画面IDで確定する。"
goal: "検索入口2経路のroute台帳、FTS5索引スコープ(題名・要約・本文の3列)分析、URL契約の現況を同じ画面IDで確定する。"
scope_in: ["Produced artifacts: 要求ベースライン、検索入口2経路route台帳、FTS5索引スコープ分析、URL契約観測fact、A1-A8 traceability","Consumed artifacts: features/feat-reader-search-quality.md, features/feat-reader-search-quality.context.json, system-spec/backend.md, system-spec/database.md, system-spec/retrieval-evidence/kajetblog-top-analysis.md","Write scope/touches: docs/spec/feat-reader-search-quality/requirements-baseline.md, docs/spec/feat-reader-search-quality/search-entry-inventory.md, docs/spec/feat-reader-search-quality/fts5-index-scope-analysis.md, docs/spec/feat-reader-search-quality/url-contract-observed-fact.md, docs/spec/feat-reader-search-quality/acceptance-traceability.json"]
scope_out: ["全文検索の外部SaaS利用","AIによる回答生成と対話 (feat-ai-assistant)","商品横断の比較検索 (feat-comparison-engine)","トップページ上の検索窓の配置と見た目、およびWebSite/SearchAction/ItemListのJSON-LD生成そのもの (feat-blog-top-page-compositionが所有)","管理画面内の記事検索。読者向け公開面だけを対象とし、管理画面側の検索は本featureの範囲外とする"]
acceptance: ["Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-reader-search-quality`","Automated commands: `pnpm typecheck`、`pnpm content:validate`、対象test suite。実装を持たないphaseは適用外理由をreportへ残す","Required evidence: docs/spec/feat-reader-search-quality/requirements-baseline.md, docs/spec/feat-reader-search-quality/search-entry-inventory.md, docs/spec/feat-reader-search-quality/fts5-index-scope-analysis.md, docs/spec/feat-reader-search-quality/url-contract-observed-fact.md, docs/spec/feat-reader-search-quality/acceptance-traceability.json"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: "feat-reader-search-quality"
feature_package_id: "feature-package/feat-reader-search-quality"
phase_ref: "P01"
file_path: "tasks/feat-reader-search-quality/sys-reader-search-quality-p01.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"b55948e2e68707fa2a8b09dbfe1319c1b799fb956a2f6eaa4f667865b9534d5a","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/feature-package-feat-reader-search-quality/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-04T04:37:54Z","origin_kind":"system-dev-planner","source_digest":"b55948e2e68707fa2a8b09dbfe1319c1b799fb956a2f6eaa4f667865b9534d5a","source_path":".dev-graph/published/feature-package-feat-reader-search-quality/task-specs/phase-01-requirements.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-reader-search-qualityのP01 lifecycle責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-reader-search-quality/sys-reader-search-quality-p01.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-ipvp","github_mirror":null,"linked_at":"2026-09-04T07:33:43Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"linked_pr_merged_all","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T03:19:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: 検索入口2経路・FTS5索引スコープ・URL契約の要求ベースライン確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-reader-search-quality
- owners: ["daishiman"]
- tags: ["p01", "feat-reader-search-quality"]
- related_nodes: ["spec-system-spec-index", "arch-system-spec-overview"]
- parent_feature: feat-reader-search-quality
- phase_ref: P01
- classification: confidence=1.0; reason=feat-reader-search-qualityのP01 lifecycle責務への確定写像; candidate=tasks/feat-reader-search-quality/sys-reader-search-quality-p01.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

検索入口2経路のroute台帳、FTS5索引スコープ(題名・要約・本文の3列)分析、URL契約の現況を同じ画面IDで確定する。

## 背景

読者が言葉から記事へ到達できるようにし、検索窓はあるのに index が無く実質使えない状態を解消する。現状の searchArticles ユースケースは published_articles の題名・要約に対する LIKE 部分一致に留まり、本文は検索されず関連度・新しさによる順位付けも無い。D1 上の FTS5 trigram 索引を公開記事から自動で保ち、日本語の部分一致でも妥当な順で結果が返り、検索結果面がサムネイル付きで表示され、JavaScript が無効でも検索が完了し、画面の検索と WebMCP 道具 searchArticles が同一ユースケースを通り、検索の入口が構造化データと llms.txt にも表れている状態にする。本phaseは依存する前phaseの確定成果物を入力にする最初のphaseである。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-reader-search-quality, spec-system-spec-index, arch-system-spec-overview
- Entry gate: depends_onの全taskがdoneまたはclosed
- P01 upstream entry gate: parent_feature.depends_on all done|closed。dev-graph正本の依存2 feature(feat-blog-composition-visibility, feat-webmcp-surface)がdoneまたはclosedのときだけ着手する。
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 分析成果物の確定だけを行う
- Backend: N/A: サービス実装を行わない
- API: N/A: API実装を行わない
- Data: applicable; FTS5索引スコープ(題名・要約・本文の3列)とURL契約現況を機械可読schemaで確定する
- Infrastructure: N/A: 配備変更なし
- Security: applicable; 検索対象を公開記事に限定し非公開流出を扱わない
- Quality: applicable; A1-A8と画面・データ・証跡の完全対応を検算する
- Documentation: applicable; 分析結果を正本化する
- Operations: applicable; 観測factの取得日・再取得方法を残す

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app。検索索引はD1のFTS5仮想表に持ち、記事本文の正本はpublished_articles、索引はそこから導かれる読み取り専用の派生物とする
- Compatibility/migration/backfill: 既存のSearchBox(method=get)・searchArticlesユースケース・published_articles schemaとの後方互換を保ち、破壊的移行はP08のdry-runとrollback証跡なしに実行しない

## 成果物

- Produced artifacts: 要求ベースライン、検索入口2経路route台帳、FTS5索引スコープ分析、URL契約観測fact、A1-A8 traceability
- Consumed artifacts: features/feat-reader-search-quality.md, features/feat-reader-search-quality.context.json, system-spec/backend.md, system-spec/database.md, system-spec/retrieval-evidence/kajetblog-top-analysis.md
- Write scope/touches: docs/spec/feat-reader-search-quality/requirements-baseline.md, docs/spec/feat-reader-search-quality/search-entry-inventory.md, docs/spec/feat-reader-search-quality/fts5-index-scope-analysis.md, docs/spec/feat-reader-search-quality/url-contract-observed-fact.md, docs/spec/feat-reader-search-quality/acceptance-traceability.json

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads bindingではGitHub Projectsを更新しない
- PR completion policy: linked_pr_merged_all
- PR body contract: Beads issue参照とdev-graph graph_node_id=SYS-READER-SEARCH-QUALITY-P01を記載し、target branchはdevとする
- Ownership boundary: system-dev-plannerはintentを宣言し、dev-graphが起票・依存・完了収束を所有する

## Branch and worktree execution

- Branch: dev-graph登録後にC15がdevgraph/SYS-READER-SEARCH-QUALITY-P01として割り当てる
- Worktree lease: 実装開始前にSYS-READER-SEARCH-QUALITY-P01をclaimし、heartbeatとreleaseをlease契約どおり行う
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
- Required evidence: docs/spec/feat-reader-search-quality/requirements-baseline.md, docs/spec/feat-reader-search-quality/search-entry-inventory.md, docs/spec/feat-reader-search-quality/fts5-index-scope-analysis.md, docs/spec/feat-reader-search-quality/url-contract-observed-fact.md, docs/spec/feat-reader-search-quality/acceptance-traceability.json
- Acceptance state: P01: 検索の入口2経路(ヘッダー起動・検索ページ)、既存SearchBox(method=get)・searchArticlesユースケースのroute台帳、FTS5索引スコープ(題名・要約・本文の3列)分析、URL契約(query parameter名・応答形)の現況観測、A1-A8とfeature/データ/証跡の未対応0件を成立させる。

## Inner goal-seek execution loop

- Methodology contract: system-task-goal-seek/v1
- Goal: 検索入口2経路のroute台帳、FTS5索引スコープ(題名・要約・本文の3列)分析、URL契約の現況を同じ画面IDで確定する。
- Generic execution prompt: feature goal、当phaseの目的、depends_on成果物、write_scope、scope_outを入力し、手段を固定せず観測可能なacceptanceを満たす成果物を作る
- Rubric: 当task acceptance、既定80% coverage、回帰0、required evidence、write_scope厳守の全項目
- Feedback loop: 実装と独立した評価へ渡し、findingを次周のpromptへ反映してrubric verdict=PASSまで反復する。上限到達時はfail-closedで前phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13が所有する。

## Rollout and rollback

- Rollout: 要求ベースライン、検索入口2経路route台帳、FTS5索引スコープ分析、URL契約観測fact、A1-A8 traceabilityをwrite_scope内へ適用し、検証PASS後に依存する次phaseへ渡す
- Rollback trigger and steps: P01のrubric verdictがFAILのまま上限へ到達した場合、write_scope内の当phase変更を戻し、直前のpromoted generationへ復帰する

## Handoff

- Executor: system build route。dev-graph登録とworktree claim後に実行する
- Ready when: confirmed、evaluation pass、implementation readiness complete、promoted digest、dev-graph exact-13 registrationが揃う
- Completion condition: P01: 検索の入口2経路(ヘッダー起動・検索ページ)、既存SearchBox(method=get)・searchArticlesユースケースのroute台帳、FTS5索引スコープ(題名・要約・本文の3列)分析、URL契約(query parameter名・応答形)の現況観測、A1-A8とfeature/データ/証跡の未対応0件を成立させる。

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-reader-search-quality
- Phase doc: .claude/plugins/system-dev-planner/references/system-plan-phase-names.md#P01
- Dependencies: なし
