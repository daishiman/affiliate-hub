---
graph_node_id: "SYS-BLOG-TOP-PAGE-COMPOSITION-P04"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-blog-top-page-composition"
domain: "quality"
tags: ["p04","feat-blog-top-page-composition"]
priority: null
start_date: null
target_date: null
iteration: null
title: "テストファースト: 区画構成・追従ヘッダー・JS無効到達性・非模倣・JSON-LDの受入テスト契約"
owners: ["daishiman"]
created_at: "2026-09-06T00:30:33Z"
updated_at: "2026-09-10T04:53:30Z"
status: "closed"
depends_on: ["SYS-BLOG-TOP-PAGE-COMPOSITION-P03"]
related_nodes: ["spec-system-spec-index","arch-system-spec-overview"]
resource_scope: ["docs/spec/feat-blog-top-page-composition/test-design.md","docs/spec/feat-blog-top-page-composition/acceptance-test-evidence-matrix.json","tests/blog-top-page/section-composition.spec.ts","tests/blog-top-page/sticky-header-budget.spec.ts","tests/blog-top-page/no-js-sort-toggle.spec.ts","tests/blog-top-page/footer-navigation.spec.ts","tests/blog-top-page/a11y-contrast.spec.ts","tests/blog-top-page/thumbnail-card.spec.ts","tests/blog-top-page/edge-and-failure.spec.ts","tests/blog-top-page/non-imitation-scan.spec.ts","tests/blog-top-page/structured-data.spec.ts"]
purpose: "実装(P05)に先立ち、区画順序と空状態、記事カードのCLS 0.1未満とOGP fallback、追従ヘッダーの3機能限定・小画面での畳み/復帰・アンカー自己遮蔽回避、JavaScript無効時のURLでの最新/人気到達性、WebSite+SearchAction+ItemListのJSON-LDのスキーマ整合、axe-core重大違反0件と light/dark 双方のコントラスト、非模倣静的検査のfail-closed動作を検証するテストを先に書く。"
goal: "実装(P05)に先立ち、区画順序と空状態、記事カードのCLS 0.1未満とOGP fallback、追従ヘッダーの3機能限定・小画面での畳み/復帰・アンカー自己遮蔽回避、JavaScript無効時のURLでの最新/人気到達性、WebSite+SearchAction+ItemListのJSON-LDのスキーマ整合、axe-core重大違反0件と light/dark 双方のコントラスト、非模倣静的検査のfail-closed動作を検証するテストを先に書く。"
scope_in: ["Produced artifacts: テスト設計文書、区画構成/追従ヘッダー/JS無効到達性/非模倣/JSON-LDの各テストスイート(失敗する状態で先に用意する)","Consumed artifacts: docs/spec/feat-blog-top-page-composition/architecture-design.md, docs/spec/feat-blog-top-page-composition/url-contract.md, docs/spec/feat-blog-top-page-composition/json-ld-contract.md, docs/spec/feat-blog-top-page-composition/non-imitation-scan-design.md, docs/spec/feat-blog-top-page-composition/design-review-p03.md","Write scope/touches: docs/spec/feat-blog-top-page-composition/test-design.md, tests/blog-top-page/section-composition.spec.ts, tests/blog-top-page/sticky-header-budget.spec.ts, tests/blog-top-page/no-js-sort-toggle.spec.ts, tests/blog-top-page/non-imitation-scan.spec.ts, tests/blog-top-page/structured-data.spec.ts"]
scope_out: ["sticky ヘッダー / サイドバー / フッターの部品実装そのものとテンプレート・配色の選択UI (feat-blog-ui-builder)","サムネイル画像の登録・生成・保存・配信 (feat-thumbnail-visual-system)","検索の索引作成・順位付け・結果面 (feat-reader-search-quality)","記事本文ページの構成と記事タイプ別レイアウト (feat-reader-surface)","管理画面の画面構成。本featureは読者向けトップページ1画面だけを対象とする。自動反映された変更を運営者が辿る履歴・差分・取り消しの面はfeat-seo-aeo-measurement-loopの所有","参照サイトの解析・URL台帳化そのもの (feat-reference-blog-admin-ux)"]
acceptance: ["Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-top-page-composition`","Automated commands: `pnpm typecheck`、`pnpm lint`、`pnpm test`、対象test suite(playwright e2eを含む)。実装を持たないphaseは適用外理由をreportへ残す","Required evidence: docs/spec/feat-blog-top-page-composition/test-design.md, tests/blog-top-page/section-composition.spec.ts, tests/blog-top-page/sticky-header-budget.spec.ts, tests/blog-top-page/no-js-sort-toggle.spec.ts, tests/blog-top-page/non-imitation-scan.spec.ts, tests/blog-top-page/structured-data.spec.ts"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: "feat-blog-top-page-composition"
feature_package_id: "feature-package/feat-blog-top-page-composition"
phase_ref: "P04"
file_path: "tasks/feat-blog-top-page-composition/sys-blog-top-page-composition-p04.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"d6f132708c2c7deb3f6b6a236781db5e59e81ac5446caf45f407393ff8f8c0b1","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-blog-top-page-composition/d6f132708c2c7deb3f6b6a236781db5e59e81ac5446caf45f407393ff8f8c0b1/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-06T00:30:33Z","origin_kind":"system-dev-planner","source_digest":"d6f132708c2c7deb3f6b6a236781db5e59e81ac5446caf45f407393ff8f8c0b1","source_path":".dev-graph/published/generations/feature-package-feat-blog-top-page-composition/d6f132708c2c7deb3f6b6a236781db5e59e81ac5446caf45f407393ff8f8c0b1/task-specs/phase-04-test-design.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-blog-top-page-compositionのP04 lifecycle責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-blog-top-page-composition/sys-blog-top-page-composition-p04.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-9nqv","github_mirror":null,"linked_at":"2026-09-04T07:34:49Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-09-10T04:53:30Z","evidence_refs":["docs/spec/feat-blog-top-page-composition/evidence-index.md","docs/spec/feat-blog-top-page-composition/spec-writeback-receipt.md"],"policy":"manual","reconciled_at":"2026-09-10T04:53:30Z","source":"reconciliation","status":"done"}
implementation_readiness: {"checked_at":"2026-09-04T03:19:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: テストファースト: 区画構成・追従ヘッダー・JS無効到達性・非模倣・JSON-LDの受入テスト契約

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-top-page-composition
- owners: ["daishiman"]
- tags: ["p04", "feat-blog-top-page-composition"]
- related_nodes: ["spec-system-spec-index", "arch-system-spec-overview"]
- parent_feature: feat-blog-top-page-composition
- phase_ref: P04
- classification: confidence=1.0; reason=feat-blog-top-page-compositionのP04 lifecycle責務への確定写像; candidate=tasks/feat-blog-top-page-composition/sys-blog-top-page-composition-p04.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P01のas-is acceptance baseline ledgerを入力に、satisfiedはcharacterization GREEN、gapだけはP05前のRED、unknownは観測taskへ分岐する。A1-A8をtest suite・command・raw evidenceへ1:1対応させ、カードのカテゴリー/公開日時、100/101件境界、全件featured、ratings失敗、read fan-out部分失敗を含む表示・JSON-LD・導線の期待値を先に固定する。

## 背景

現行コードにはsort、WebSite/ItemList、おすすめ・記事・カテゴリー・一覧出口が既にあるため、全項目REDを要求すると正しいcharacterization testまで失敗させる。非模倣静的検査はsrc/runtime code/assetsだけを走査し、provenance文書と規則検証fixtureは対象外に保つ。未観測の項目を推測でRED/GREENへ置かずunknownとして観測taskへ送る。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-top-page-composition, spec-system-spec-index, arch-system-spec-overview, SYS-BLOG-TOP-PAGE-COMPOSITION-P03
- Entry gate: depends_onの全taskがdoneまたはclosed
- P01 upstream entry gate: N/A: intra-feature depends_on gate
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Planner runtime pin: system-dev-planner v0.1.10。host skill pathからplugin rootを解決して`SYSTEM_DEV_PLANNER_ROOT`へ設定し、repository内の別versionを暗黙選択しない
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 区画構成・カード・追従ヘッダー挙動・アクセシビリティのbehaviorテストを先に書く
- Backend: N/A: サービス実装を伴わない
- API: applicable; ?sort=latest|popularのJavaScript無効到達性テストを先に書く
- Data: N/A: DBスキーマ変更を伴わない
- Infrastructure: N/A: 配備変更を伴わない
- Security: applicable; 非模倣静的検査テスト(参照元固有名・色値の混入検知)を先に書く
- Quality: applicable; axe-core重大違反0件・コントラスト・CLS 0.1未満のテストを先に書く
- Documentation: applicable; テスト設計を正本化する
- Operations: N/A: 運用手順の変更を伴わない

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app。読者向けトップページの配信先をこのunitへ固定する
- Compatibility/migration/backfill: 既存のブログトップ(src/app/s/[site]/page.tsx)・記事一覧・カテゴリ導線との後方互換を保ち、破壊的移行はP08のdry-runとrollback証跡なしに実行しない

## 成果物

- Produced artifacts: テスト設計文書、P01のacceptance_contract_digestを変更せず保持するA1-A8 test/evidence matrix、characterization GREEN群、gap RED群、unknown観測分岐、境界/failure injection suite
- Consumed artifacts: docs/spec/feat-blog-top-page-composition/as-is-acceptance-baseline.json, docs/spec/feat-blog-top-page-composition/acceptance-traceability.json, docs/spec/feat-blog-top-page-composition/architecture-design.md, docs/spec/feat-blog-top-page-composition/url-contract.md, docs/spec/feat-blog-top-page-composition/json-ld-contract.md, docs/spec/feat-blog-top-page-composition/non-imitation-scan-design.md, docs/spec/feat-blog-top-page-composition/design-review-p03.md
- Write scope/touches: docs/spec/feat-blog-top-page-composition/test-design.md, docs/spec/feat-blog-top-page-composition/acceptance-test-evidence-matrix.json, tests/blog-top-page/section-composition.spec.ts, tests/blog-top-page/sticky-header-budget.spec.ts, tests/blog-top-page/no-js-sort-toggle.spec.ts, tests/blog-top-page/footer-navigation.spec.ts, tests/blog-top-page/a11y-contrast.spec.ts, tests/blog-top-page/thumbnail-card.spec.ts, tests/blog-top-page/edge-and-failure.spec.ts, tests/blog-top-page/non-imitation-scan.spec.ts, tests/blog-top-page/structured-data.spec.ts

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads bindingではGitHub Projectsを更新しない
- PR completion policy: linked_pr_merged_all
- PR body contract: Beads issue参照とdev-graph graph_node_id=SYS-BLOG-TOP-PAGE-COMPOSITION-P04を記載し、target branchはdevとする
- Ownership boundary: system-dev-plannerはintentを宣言し、dev-graphが起票・依存・完了収束を所有する

## Branch and worktree execution

- Branch: dev-graph登録後にC15がdevgraph/SYS-BLOG-TOP-PAGE-COMPOSITION-P04として割り当てる
- Worktree lease: 実装開始前にSYS-BLOG-TOP-PAGE-COMPOSITION-P04をclaimし、heartbeatとreleaseをlease契約どおり行う
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

- テストレベル選定: 単体はセクション順序、カードのサムネイル・カテゴリー・公開日時、保存時生成OGP URL選択、sort=latest|popularを検証する。結合はSSRトップとJSON-LD、src限定非模倣gateを検証する。境界値は記事0件、100/101件、全件featured、画像不在、長題名、多バイト、不正sort、ratings失敗、origin不明、read fan-out部分失敗を扱い、画面・ItemList・エラー表示・一覧出口・query数を明示する。回帰はP01でsatisfiedの挙動をcharacterization GREENとして保つ。
- カバレッジ目標: 新規または変更するapplication codeは既定80%を下回らない。層別の上書きはせず、非模倣静的検査の判定関数は100%網羅を目標とする。
- 層別方針: Frontendは可視ラベルとaxe-coreによるbehaviorベースの検証を使う。Backendはapplicableの場合のみAPI 契約とDB 結合を確認する統合テストを使い、N/Aの場合は適用外理由を証跡化する。Infrastructureはapplicableの場合のみIaC静的検証とsmokeテストを使い、N/Aの場合は適用外理由を証跡化する。
- 保守性制約: pixel位置依存とDOM構造依存のassertを禁止し、role/name/状態などアクセシブルな契約と出力データの契約で検証する。実装詳細に密結合した過剰テストを作らない。

## Verification and evidence

- Automated commands: `python3 "$SYSTEM_DEV_PLANNER_ROOT/scripts/validate-system-plan.py" --repo-root . --staging .dev-graph/staging/run-20260905-feat-blog-top-dependency-fix`
- Automated commands: `pnpm typecheck`、`pnpm lint`、`pnpm test`、対象test suite(playwright e2eを含む)。実装を持たないphaseは適用外理由をreportへ残す
- Required evidence: docs/spec/feat-blog-top-page-composition/test-design.md, docs/spec/feat-blog-top-page-composition/acceptance-test-evidence-matrix.json, tests/blog-top-page/section-composition.spec.ts, tests/blog-top-page/sticky-header-budget.spec.ts, tests/blog-top-page/no-js-sort-toggle.spec.ts, tests/blog-top-page/footer-navigation.spec.ts, tests/blog-top-page/a11y-contrast.spec.ts, tests/blog-top-page/thumbnail-card.spec.ts, tests/blog-top-page/edge-and-failure.spec.ts, tests/blog-top-page/non-imitation-scan.spec.ts, tests/blog-top-page/structured-data.spec.ts
- Acceptance state: P04: matrixのacceptance_contract_digestがP01と一致したまま、A1-A8全件がtest suite・command・raw evidenceへ対応する。P01でsatisfiedの項目はcharacterization GREEN、gapだけはP05前のRED、unknownは所有者付き観測taskへ分岐する。カードcategory/date、100/101件、全件featured、ratings/read failureを含む境界期待値が明示される。

## Inner goal-seek execution loop

- Methodology contract: system-task-goal-seek/v1
- Goal: P01のacceptance_contract_digestを変更せず、as-is ledgerのsatisfied/gap/unknown分類を保ったA1-A8 test/evidence matrixと境界/failure injection suiteを確定する。
- Generic execution prompt: feature goal、当phaseの目的、depends_on成果物、write_scope、scope_outを入力し、手段を固定せず観測可能なacceptanceを満たす成果物を作る
- Rubric: 当task acceptance、既定80% coverage、回帰0、required evidence、write_scope厳守の全項目
- Feedback loop: 実装と独立した評価へ渡し、findingを次周のpromptへ反映してrubric verdict=PASSまで反復する。上限到達時はfail-closedで前phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13が所有する。

## Rollout and rollback

- Rollout: test/evidence matrix、characterization GREEN群、gap RED群、unknown観測分岐、境界/failure injection suiteをwrite_scope内へ適用し、検証PASS後に依存する次phaseへ渡す
- Rollback trigger and steps: P04のrubric verdictがFAILのまま上限へ到達した場合、write_scope内の当phase変更を戻し、直前のpromoted generationへ復帰する

## Handoff

- Executor: system build route。dev-graph登録とworktree claim後に実行する
- Ready when: confirmed、evaluation pass、implementation readiness complete、promoted digest、dev-graph exact-13 registrationが揃う
- Completion condition: P04: matrixのacceptance_contract_digestがP01と一致したまま、A1-A8全件がtest suite・command・raw evidenceへ対応する。P01でsatisfiedの項目はcharacterization GREEN、gapだけはP05前のRED、unknownは所有者付き観測taskへ分岐する。カードcategory/date、100/101件、全件featured、ratings/read failureを含む境界期待値が明示される。

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-blog-top-page-composition
- Phase doc: .claude/plugins/system-dev-planner/references/system-plan-phase-names.md#P04
- Dependencies: SYS-BLOG-TOP-PAGE-COMPOSITION-P03
