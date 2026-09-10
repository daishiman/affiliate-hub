---
graph_node_id: "SYS-BLOG-TOP-PAGE-COMPOSITION-P01"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-blog-top-page-composition"
domain: "documentation"
tags: ["p01","feat-blog-top-page-composition"]
priority: null
start_date: null
target_date: null
iteration: null
title: "トップページ区画構成・カード規約・追従ヘッダー機能予算・非模倣ゲートの要求ベースライン確定"
owners: ["daishiman"]
created_at: "2026-09-06T00:30:33Z"
updated_at: "2026-09-10T04:53:30Z"
status: "closed"
depends_on: []
related_nodes: ["spec-system-spec-index","arch-system-spec-overview"]
resource_scope: ["docs/spec/feat-blog-top-page-composition/requirements-baseline.md","docs/spec/feat-blog-top-page-composition/as-is-acceptance-baseline.json","docs/spec/feat-blog-top-page-composition/section-composition-inventory.md","docs/spec/feat-blog-top-page-composition/sticky-header-function-budget.md","docs/spec/feat-blog-top-page-composition/non-imitation-gate-definition.md","docs/spec/feat-blog-top-page-composition/acceptance-traceability.json"]
purpose: "おすすめ記事→最新/人気切替→カテゴリーから探す→記事一覧導線の区画順・件数・空状態、記事カードの16:9規約とサムネイル欠落時のOGP自動生成fallback、追従ヘッダーへ置く機能をサイト名/検索起動/カテゴリへの移動の3つに限定する予算、フッター導線集約(運営者情報/全カテゴリー/サイトポリシー/プライバシーポリシー/特定商取引法に基づく表記/お問い合わせ/RSS/SNS)、JavaScript無効時のURL到達性、WebSite+SearchAction+ItemListの構造化データ、参照元(kajetblog.com)の非模倣ゲートの検査対象を、同じacceptance IDで確定する。"
goal: "おすすめ記事→最新/人気切替→カテゴリーから探す→記事一覧導線の区画順・件数・空状態、記事カードの16:9規約とサムネイル欠落時のOGP自動生成fallback、追従ヘッダーへ置く機能をサイト名/検索起動/カテゴリへの移動の3つに限定する予算、フッター導線集約(運営者情報/全カテゴリー/サイトポリシー/プライバシーポリシー/特定商取引法に基づく表記/お問い合わせ/RSS/SNS)、JavaScript無効時のURL到達性、WebSite+SearchAction+ItemListの構造化データ、参照元(kajetblog.com)の非模倣ゲートの検査対象を、同じacceptance IDで確定する。"
scope_in: ["Produced artifacts: 要求ベースライン、区画構成台帳(セクション順・件数・空状態)、追従ヘッダー機能予算定義、非模倣ゲート対象定義、acceptance traceability","Consumed artifacts: features/feat-blog-top-page-composition.md, features/feat-blog-top-page-composition.context.json, system-spec/ui-ux.md (qa-uiux-web-top-composition-v6/qa-request-thumbnail-coverage-v6/qa-neutral-ogp-fallback-v6), system-spec/frontend.md, system-spec/retrieval-evidence/kajetblog-top-analysis.md","Write scope/touches: docs/spec/feat-blog-top-page-composition/requirements-baseline.md, docs/spec/feat-blog-top-page-composition/section-composition-inventory.md, docs/spec/feat-blog-top-page-composition/sticky-header-function-budget.md, docs/spec/feat-blog-top-page-composition/non-imitation-gate-definition.md, docs/spec/feat-blog-top-page-composition/acceptance-traceability.json"]
scope_out: ["sticky ヘッダー / サイドバー / フッターの部品実装そのものとテンプレート・配色の選択UI (feat-blog-ui-builder)","サムネイル画像の登録・生成・保存・配信 (feat-thumbnail-visual-system)","検索の索引作成・順位付け・結果面 (feat-reader-search-quality)","記事本文ページの構成と記事タイプ別レイアウト (feat-reader-surface)","管理画面の画面構成。本featureは読者向けトップページ1画面だけを対象とする。自動反映された変更を運営者が辿る履歴・差分・取り消しの面はfeat-seo-aeo-measurement-loopの所有","参照サイトの解析・URL台帳化そのもの (feat-reference-blog-admin-ux)"]
acceptance: ["Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-top-page-composition`","Automated commands: `pnpm typecheck`、`pnpm lint`、`pnpm test`、対象test suite(playwright e2eを含む)。実装を持たないphaseは適用外理由をreportへ残す","Required evidence: docs/spec/feat-blog-top-page-composition/requirements-baseline.md, docs/spec/feat-blog-top-page-composition/section-composition-inventory.md, docs/spec/feat-blog-top-page-composition/sticky-header-function-budget.md, docs/spec/feat-blog-top-page-composition/non-imitation-gate-definition.md, docs/spec/feat-blog-top-page-composition/acceptance-traceability.json"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: "feat-blog-top-page-composition"
feature_package_id: "feature-package/feat-blog-top-page-composition"
phase_ref: "P01"
file_path: "tasks/feat-blog-top-page-composition/sys-blog-top-page-composition-p01.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"d6f132708c2c7deb3f6b6a236781db5e59e81ac5446caf45f407393ff8f8c0b1","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-blog-top-page-composition/d6f132708c2c7deb3f6b6a236781db5e59e81ac5446caf45f407393ff8f8c0b1/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-06T00:30:33Z","origin_kind":"system-dev-planner","source_digest":"d6f132708c2c7deb3f6b6a236781db5e59e81ac5446caf45f407393ff8f8c0b1","source_path":".dev-graph/published/generations/feature-package-feat-blog-top-page-composition/d6f132708c2c7deb3f6b6a236781db5e59e81ac5446caf45f407393ff8f8c0b1/task-specs/phase-01-requirements.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-blog-top-page-compositionのP01 lifecycle責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-blog-top-page-composition/sys-blog-top-page-composition-p01.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-87y9","github_mirror":null,"linked_at":"2026-09-04T07:34:43Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-09-10T04:53:30Z","evidence_refs":["docs/spec/feat-blog-top-page-composition/evidence-index.md","docs/spec/feat-blog-top-page-composition/spec-writeback-receipt.md"],"policy":"manual","reconciled_at":"2026-09-10T04:53:30Z","source":"reconciliation","status":"done"}
implementation_readiness: {"checked_at":"2026-09-04T03:19:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: トップページ区画構成・カード規約・追従ヘッダー機能予算・非模倣ゲートの要求ベースライン確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-top-page-composition
- owners: ["daishiman"]
- tags: ["p01", "feat-blog-top-page-composition"]
- related_nodes: ["spec-system-spec-index", "arch-system-spec-overview"]
- parent_feature: feat-blog-top-page-composition
- phase_ref: P01
- classification: confidence=1.0; reason=feat-blog-top-page-compositionのP01 lifecycle責務への確定写像; candidate=tasks/feat-blog-top-page-composition/sys-blog-top-page-composition-p01.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

おすすめ記事→最新/人気切替→カテゴリーから探す→記事一覧導線の区画順・件数・空状態、記事カードのサムネイル・カテゴリー・公開日時と16:9規約、追従ヘッダーの3機能予算、フッター7導線、JavaScript無効時のURL到達性、WebSite+SearchAction+ItemList、src/runtime code/assetsを対象とする非模倣ゲートをA1-A8へ対応付ける。同時に現行実装をsatisfied/gap/unknownへ分類するas-is acceptance baseline ledgerを確定する。

## 背景

現行トップにはsort、WebSite/ItemList、おすすめ・記事・カテゴリー・一覧出口の相当部分が既に存在するため、greenfield前提の全REDへ戻さない。共有アイコン体系はfeat-blog-ui-builder、OGP画像の生成・保存はfeat-thumbnail-visual-systemが所有し、本featureは提供部品と保存済みURLを消費する。SNSは公開URL・表示データ・正本acceptanceがないため今回の必須scopeから外し、フッターは運営者情報からRSSまでの7導線に固定する。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-top-page-composition, spec-system-spec-index, arch-system-spec-overview
- Entry gate: parent_feature.depends_on all done|closed (P01)
- P01 upstream entry gate: macro apply receiptを正規チョークポイントから取得し、receiptが示す更新済みfeatureからcontextを再生成し、そのcontext SHA-256とfeature-package.jsonのsource_feature_digestが一致した後にだけ着手する。更新後のparent_feature.depends_on 5 feature(feat-blog-ops-crud, feat-blog-ui-builder, feat-reference-blog-admin-ux, feat-thumbnail-visual-system, feat-reader-search-quality)を都度読み、全件がdoneまたはclosedであることを要求する。
- Dependency gate contract: 現行dev-graphの正規契約はparent_feature.depends_on単位のdone|closed判定であり、capability単位の部分完了receiptは入力にしない。必要能力だけを待つ方式より待機時間が延びる可能性は受容し、依存未完了を通さないfail-closedな正しさを優先する。
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Planner runtime pin: system-dev-planner v0.1.10。host skill pathからplugin rootを解決して`SYSTEM_DEV_PLANNER_ROOT`へ設定し、repository内の別versionを暗黙選択しない
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 要求文書の確定だけを行い実装は行わない
- Backend: N/A: サービス実装を行わない
- API: N/A: API実装を行わない
- Data: N/A: データ層の変更を行わない
- Infrastructure: N/A: 配備変更なし
- Security: applicable; 非模倣ゲートをsrc/runtime code/assetsへ限定し、provenance文書と検査fixtureを走査対象外として保持する境界を確定する
- Quality: applicable; A1-A8と要件文書・観測fact引用の対応を検算する
- Documentation: applicable; 要求ベースラインを正本化する
- Operations: applicable; 観測fact(kajetblog-top-analysis.md)の取得日・再取得方法を残す

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app。読者向けトップページの配信先をこのunitへ固定する
- Compatibility/migration/backfill: 既存のブログトップ(src/app/s/[site]/page.tsx)・記事一覧・カテゴリ導線との後方互換を保ち、破壊的移行はP08のdry-runとrollback証跡なしに実行しない

## 成果物

- Produced artifacts: 要求ベースライン、as-is acceptance baseline ledger、区画構成台帳、追従ヘッダー機能予算定義、非模倣ゲート対象定義、acceptance traceability、A1-A8の正本文言とID対応だけから算出したacceptance_contract_digest
- Consumed artifacts: macro release guard、macro apply receipt、receiptから再生成したfeatures/feat-blog-top-page-composition.context.json、features/feat-blog-top-page-composition.md、system-spec/ui-ux.md、system-spec/frontend.md、system-spec/retrieval-evidence/kajetblog-top-analysis.md
- Write scope/touches: docs/spec/feat-blog-top-page-composition/requirements-baseline.md, docs/spec/feat-blog-top-page-composition/as-is-acceptance-baseline.json, docs/spec/feat-blog-top-page-composition/section-composition-inventory.md, docs/spec/feat-blog-top-page-composition/sticky-header-function-budget.md, docs/spec/feat-blog-top-page-composition/non-imitation-gate-definition.md, docs/spec/feat-blog-top-page-composition/acceptance-traceability.json

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads bindingではGitHub Projectsを更新しない
- PR completion policy: linked_pr_merged_all
- PR body contract: Beads issue参照とdev-graph graph_node_id=SYS-BLOG-TOP-PAGE-COMPOSITION-P01を記載し、target branchはdevとする
- Ownership boundary: system-dev-plannerはintentを宣言し、dev-graphが起票・依存・完了収束を所有する

## Branch and worktree execution

- Branch: dev-graph登録後にC15がdevgraph/SYS-BLOG-TOP-PAGE-COMPOSITION-P01として割り当てる
- Worktree lease: 実装開始前にSYS-BLOG-TOP-PAGE-COMPOSITION-P01をclaimし、heartbeatとreleaseをlease契約どおり行う
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
- Required evidence: macro release guard, macro apply receipt, regenerated feature context digest, acceptance_contract_digest, docs/spec/feat-blog-top-page-composition/requirements-baseline.md, docs/spec/feat-blog-top-page-composition/as-is-acceptance-baseline.json, docs/spec/feat-blog-top-page-composition/section-composition-inventory.md, docs/spec/feat-blog-top-page-composition/sticky-header-function-budget.md, docs/spec/feat-blog-top-page-composition/non-imitation-gate-definition.md, docs/spec/feat-blog-top-page-composition/acceptance-traceability.json
- Acceptance state: P01: macro release guardのexpected before/after digestとfresh previewを照合し、apply receipt→context再生成→package freshnessを順に確認してから、上流5featureをfeature-level gateへ含める。A1-A8の正本文言とID対応だけからacceptance_contract_digestを算出してtraceabilityへ固定する。A1-A8ごとに現行実装をsatisfied/gap/unknownへ分類し、カードのサムネイル・カテゴリー・公開日時、フッター7導線、詳細A3/A8、src/runtime限定A6を1:1で追跡して未対応0件を成立させる。

## Inner goal-seek execution loop

- Methodology contract: system-task-goal-seek/v1
- Goal: A1-A8の次世代契約と現行実装を照合し、acceptance_contract_digestで契約世代を識別しつつ、各項目をsatisfied/gap/unknownへ分類した再現可能なbaseline ledgerを確定する。
- Generic execution prompt: feature goal、当phaseの目的、depends_on成果物、write_scope、scope_outを入力し、手段を固定せず観測可能なacceptanceを満たす成果物を作る
- Rubric: 当task acceptance、既定80% coverage、回帰0、required evidence、write_scope厳守の全項目
- Feedback loop: 実装と独立した評価へ渡し、findingを次周のpromptへ反映してrubric verdict=PASSまで反復する。上限到達時はfail-closedで前phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13が所有する。

## Rollout and rollback

- Rollout: 要求ベースライン、as-is acceptance baseline ledger、区画構成台帳、追従ヘッダー機能予算定義、非模倣ゲート対象定義、acceptance traceabilityをwrite_scope内へ適用し、検証PASS後に依存する次phaseへ渡す
- Rollback trigger and steps: P01のrubric verdictがFAILのまま上限へ到達した場合、write_scope内の当phase変更を戻し、直前のpromoted generationへ復帰する

## Handoff

- Executor: system build route。dev-graph登録とworktree claim後に実行する
- Ready when: confirmed、evaluation pass、implementation readiness complete、promoted digest、dev-graph exact-13 registrationが揃う
- Completion condition: P01: macro release guardのexpected before/after digestとfresh previewを照合し、apply receipt→context再生成→package freshnessを順に確認してから、上流5featureをfeature-level gateへ含める。A1-A8の正本文言とID対応からacceptance_contract_digestを固定し、各項目をsatisfied/gap/unknownへ分類する。カードのサムネイル・カテゴリー・公開日時、フッター7導線、詳細A3/A8、src/runtime限定A6を1:1で追跡して未対応0件を成立させる。

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-blog-top-page-composition
- Phase doc: .claude/plugins/system-dev-planner/references/system-plan-phase-names.md#P01
- Dependencies: なし
