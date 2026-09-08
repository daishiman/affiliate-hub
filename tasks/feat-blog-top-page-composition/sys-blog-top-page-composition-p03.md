---
graph_node_id: "SYS-BLOG-TOP-PAGE-COMPOSITION-P03"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-blog-top-page-composition"
domain: "quality"
tags: ["p03","feat-blog-top-page-composition"]
priority: null
start_date: null
target_date: null
iteration: null
title: "トップページ設計の独立レビュー"
owners: ["daishiman"]
created_at: "2026-09-06T00:30:33Z"
updated_at: "2026-09-06T00:38:28.777097Z"
status: "active"
depends_on: ["SYS-BLOG-TOP-PAGE-COMPOSITION-P02"]
related_nodes: ["spec-system-spec-index","arch-system-spec-overview"]
resource_scope: ["docs/spec/feat-blog-top-page-composition/design-review-p03.md"]
purpose: "P02のアーキテクチャ設計をP01の受入条件・非模倣制約・feature間scope境界(feat-blog-ui-builder/feat-thumbnail-visual-system/feat-reader-search-quality/feat-reader-surfaceとの責務分離)に対して、設計を行った当事者から独立した観点でレビューする。"
goal: "P02のアーキテクチャ設計をP01の受入条件・非模倣制約・feature間scope境界(feat-blog-ui-builder/feat-thumbnail-visual-system/feat-reader-search-quality/feat-reader-surfaceとの責務分離)に対して、設計を行った当事者から独立した観点でレビューする。"
scope_in: ["Produced artifacts: 独立設計レビュー結果、指摘事項と解消記録","Consumed artifacts: docs/spec/feat-blog-top-page-composition/architecture-design.md, docs/spec/feat-blog-top-page-composition/url-contract.md, docs/spec/feat-blog-top-page-composition/json-ld-contract.md, docs/spec/feat-blog-top-page-composition/non-imitation-scan-design.md","Write scope/touches: docs/spec/feat-blog-top-page-composition/design-review-p03.md"]
scope_out: ["sticky ヘッダー / サイドバー / フッターの部品実装そのものとテンプレート・配色の選択UI (feat-blog-ui-builder)","サムネイル画像の登録・生成・保存・配信 (feat-thumbnail-visual-system)","検索の索引作成・順位付け・結果面 (feat-reader-search-quality)","記事本文ページの構成と記事タイプ別レイアウト (feat-reader-surface)","管理画面の画面構成。本featureは読者向けトップページ1画面だけを対象とする。自動反映された変更を運営者が辿る履歴・差分・取り消しの面はfeat-seo-aeo-measurement-loopの所有","参照サイトの解析・URL台帳化そのもの (feat-reference-blog-admin-ux)"]
acceptance: ["Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-top-page-composition`","Automated commands: `pnpm typecheck`、`pnpm lint`、`pnpm test`、対象test suite(playwright e2eを含む)。実装を持たないphaseは適用外理由をreportへ残す","Required evidence: docs/spec/feat-blog-top-page-composition/design-review-p03.md"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: "feat-blog-top-page-composition"
feature_package_id: "feature-package/feat-blog-top-page-composition"
phase_ref: "P03"
file_path: "tasks/feat-blog-top-page-composition/sys-blog-top-page-composition-p03.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"d6f132708c2c7deb3f6b6a236781db5e59e81ac5446caf45f407393ff8f8c0b1","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-blog-top-page-composition/d6f132708c2c7deb3f6b6a236781db5e59e81ac5446caf45f407393ff8f8c0b1/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-06T00:30:33Z","origin_kind":"system-dev-planner","source_digest":"d6f132708c2c7deb3f6b6a236781db5e59e81ac5446caf45f407393ff8f8c0b1","source_path":".dev-graph/published/generations/feature-package-feat-blog-top-page-composition/d6f132708c2c7deb3f6b6a236781db5e59e81ac5446caf45f407393ff8f8c0b1/task-specs/phase-03-design-review.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-blog-top-page-compositionのP03 lifecycle責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-blog-top-page-composition/sys-blog-top-page-composition-p03.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-tweu","github_mirror":null,"linked_at":"2026-09-04T07:34:47Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T03:19:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: トップページ設計の独立レビュー

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-top-page-composition
- owners: ["daishiman"]
- tags: ["p03", "feat-blog-top-page-composition"]
- related_nodes: ["spec-system-spec-index", "arch-system-spec-overview"]
- parent_feature: feat-blog-top-page-composition
- phase_ref: P03
- classification: confidence=1.0; reason=feat-blog-top-page-compositionのP03 lifecycle責務への確定写像; candidate=tasks/feat-blog-top-page-composition/sys-blog-top-page-composition-p03.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P02のアーキテクチャ設計をP01の受入条件・非模倣制約・feature間scope境界(feat-blog-ops-crud/feat-blog-ui-builder/feat-reference-blog-admin-ux/feat-thumbnail-visual-system/feat-reader-search-quality/feat-reader-surfaceとの責務分離)に対して、設計を行った当事者から独立した観点でレビューする。

## 背景

独立監査C06は過去に推奨バッジによる誘導などの偏りを指摘した実績があり(qa-neutral-ogp-fallback-v6/qa-neutral-application-mode-v6の再提示経緯)、設計段階での独立レビューを経ないまま実装へ進むと、参照サイトの観測factをそのまま実装契約へ読み替える誤りや、他featureが所有する部品の二重実装が実装後まで発見されない。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-top-page-composition, spec-system-spec-index, arch-system-spec-overview, SYS-BLOG-TOP-PAGE-COMPOSITION-P02
- Entry gate: depends_onの全taskがdoneまたはclosed
- P01 upstream entry gate: N/A: intra-feature depends_on gate
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Planner runtime pin: system-dev-planner v0.1.10。host skill pathからplugin rootを解決して`SYSTEM_DEV_PLANNER_ROOT`へ設定し、repository内の別versionを暗黙選択しない
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 実装を行わずP02成果物のレビューのみ行う
- Backend: N/A: 実装を行わない
- API: N/A: 実装を行わない
- Data: N/A: 実装を行わない
- Infrastructure: N/A: 実装を行わない
- Security: applicable; 非模倣gateがsrc/runtime code/assetsだけを走査し、provenance文書・検査fixtureを除外する境界をレビューする
- Quality: applicable; P02設計とA1-A8の対応漏れ・scope境界違反(他feature責務の混入)を検査する
- Documentation: applicable; レビュー結果を正本化する
- Operations: N/A: 運用手順の変更を伴わない

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app。読者向けトップページの配信先をこのunitへ固定する
- Compatibility/migration/backfill: 既存のブログトップ(src/app/s/[site]/page.tsx)・記事一覧・カテゴリ導線との後方互換を保ち、破壊的移行はP08のdry-runとrollback証跡なしに実行しない

## 成果物

- Produced artifacts: reviewer_role、reviewer_identity、reviewed_artifact_digest、proposer_identity、非同一判定を含む独立設計レビュー結果、指摘事項と解消記録
- Consumed artifacts: docs/spec/feat-blog-top-page-composition/architecture-design.md, docs/spec/feat-blog-top-page-composition/url-contract.md, docs/spec/feat-blog-top-page-composition/json-ld-contract.md, docs/spec/feat-blog-top-page-composition/non-imitation-scan-design.md
- Write scope/touches: docs/spec/feat-blog-top-page-composition/design-review-p03.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads bindingではGitHub Projectsを更新しない
- PR completion policy: linked_pr_merged_all
- PR body contract: Beads issue参照とdev-graph graph_node_id=SYS-BLOG-TOP-PAGE-COMPOSITION-P03を記載し、target branchはdevとする
- Ownership boundary: system-dev-plannerはintentを宣言し、dev-graphが起票・依存・完了収束を所有する

## Branch and worktree execution

- Branch: dev-graph登録後にC15がdevgraph/SYS-BLOG-TOP-PAGE-COMPOSITION-P03として割り当てる
- Worktree lease: 実装開始前にSYS-BLOG-TOP-PAGE-COMPOSITION-P03をclaimし、heartbeatとreleaseをlease契約どおり行う
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
- Required evidence: docs/spec/feat-blog-top-page-composition/design-review-p03.md内のreviewer_role、reviewer_identity、reviewed_artifact_digest、proposer_identity、proposer_not_equal_reviewer=true
- Acceptance state: P03: reviewer identityとP02 reviewed digestを記録し、reviewer != proposerをfail-closedで確認する。独立レビューがA1-A8対応漏れ0件・他feature責務混入0件・観測factの無批判な読み替え0件を確認し、指摘解消記録を残す。

## Inner goal-seek execution loop

- Methodology contract: system-task-goal-seek/v1
- Goal: P02のアーキテクチャ設計をP01の受入条件・非模倣制約・feature間scope境界(feat-blog-ops-crud/feat-blog-ui-builder/feat-reference-blog-admin-ux/feat-thumbnail-visual-system/feat-reader-search-quality/feat-reader-surfaceとの責務分離)に対して、設計を行った当事者から独立した観点でレビューする。
- Generic execution prompt: feature goal、当phaseの目的、depends_on成果物、write_scope、scope_outを入力し、手段を固定せず観測可能なacceptanceを満たす成果物を作る
- Rubric: 当task acceptance、既定80% coverage、回帰0、required evidence、write_scope厳守の全項目
- Feedback loop: 実装と独立した評価へ渡し、findingを次周のpromptへ反映してrubric verdict=PASSまで反復する。上限到達時はfail-closedで前phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13が所有する。

## Rollout and rollback

- Rollout: 独立設計レビュー結果、指摘事項と解消記録をwrite_scope内へ適用し、検証PASS後に依存する次phaseへ渡す
- Rollback trigger and steps: P03のrubric verdictがFAILのまま上限へ到達した場合、write_scope内の当phase変更を戻し、直前のpromoted generationへ復帰する

## Handoff

- Executor: system build route。dev-graph登録とworktree claim後に実行する
- Ready when: confirmed、evaluation pass、implementation readiness complete、promoted digest、dev-graph exact-13 registrationが揃う
- Completion condition: P03: reviewer identityとP02 reviewed digestを記録し、reviewer != proposerをfail-closedで確認する。独立レビューがA1-A8対応漏れ0件・他feature責務混入0件・観測factの無批判な読み替え0件を確認し、指摘解消記録を残す。

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-blog-top-page-composition
- Phase doc: .claude/plugins/system-dev-planner/references/system-plan-phase-names.md#P03
- Dependencies: SYS-BLOG-TOP-PAGE-COMPOSITION-P02
