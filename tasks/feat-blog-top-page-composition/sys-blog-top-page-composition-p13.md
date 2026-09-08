---
graph_node_id: "SYS-BLOG-TOP-PAGE-COMPOSITION-P13"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-blog-top-page-composition"
domain: "operations"
tags: ["p13","feat-blog-top-page-composition"]
priority: null
start_date: null
target_date: null
iteration: null
title: "development deployment・rollback確認・仕様書への書き戻し"
owners: ["daishiman"]
created_at: "2026-09-06T00:30:33Z"
updated_at: "2026-09-06T00:38:33.822051Z"
status: "active"
depends_on: ["SYS-BLOG-TOP-PAGE-COMPOSITION-P12"]
related_nodes: ["spec-system-spec-index","arch-system-spec-overview"]
resource_scope: ["docs/spec/feat-blog-top-page-composition/release-report.md","system-spec/ui-ux.md","system-spec/frontend.md","architecture/system-spec-overview.md"]
purpose: "feature flagでdevelopmentへ段階展開し、smoke/telemetry/rollbackを確認したうえで、実行結果・判断・改善点をsystem-spec/ui-ux.md・system-spec/frontend.md・architecture/system-spec-overview.mdへ正規reopen経由で書き戻す。"
goal: "feature flagでdevelopmentへ段階展開し、smoke/telemetry/rollbackを確認したうえで、実行結果・判断・改善点をsystem-spec/ui-ux.md・system-spec/frontend.md・architecture/system-spec-overview.mdへ正規reopen経由で書き戻す。"
scope_in: ["Produced artifacts: release/rollback report、close-out receipt、canonical spec/architecture writeback","Consumed artifacts: docs/spec/feat-blog-top-page-composition/runbook.md, docs/spec/feat-blog-top-page-composition/handover.md, docs/spec/feat-blog-top-page-composition/evidence-manifest.json","Write scope/touches: docs/spec/feat-blog-top-page-composition/release-report.md, system-spec/ui-ux.md, system-spec/frontend.md, architecture/system-spec-overview.md"]
scope_out: ["sticky ヘッダー / サイドバー / フッターの部品実装そのものとテンプレート・配色の選択UI (feat-blog-ui-builder)","サムネイル画像の登録・生成・保存・配信 (feat-thumbnail-visual-system)","検索の索引作成・順位付け・結果面 (feat-reader-search-quality)","記事本文ページの構成と記事タイプ別レイアウト (feat-reader-surface)","管理画面の画面構成。本featureは読者向けトップページ1画面だけを対象とする。自動反映された変更を運営者が辿る履歴・差分・取り消しの面はfeat-seo-aeo-measurement-loopの所有","参照サイトの解析・URL台帳化そのもの (feat-reference-blog-admin-ux)"]
acceptance: ["Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-top-page-composition`","Automated commands: `pnpm typecheck`、`pnpm lint`、`pnpm test`、対象test suite(playwright e2eを含む)。実装を持たないphaseは適用外理由をreportへ残す","Required evidence: docs/spec/feat-blog-top-page-composition/release-report.md, system-spec/ui-ux.md, system-spec/frontend.md, architecture/system-spec-overview.md"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: "feat-blog-top-page-composition"
feature_package_id: "feature-package/feat-blog-top-page-composition"
phase_ref: "P13"
file_path: "tasks/feat-blog-top-page-composition/sys-blog-top-page-composition-p13.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"d6f132708c2c7deb3f6b6a236781db5e59e81ac5446caf45f407393ff8f8c0b1","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-blog-top-page-composition/d6f132708c2c7deb3f6b6a236781db5e59e81ac5446caf45f407393ff8f8c0b1/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-06T00:30:33Z","origin_kind":"system-dev-planner","source_digest":"d6f132708c2c7deb3f6b6a236781db5e59e81ac5446caf45f407393ff8f8c0b1","source_path":".dev-graph/published/generations/feature-package-feat-blog-top-page-composition/d6f132708c2c7deb3f6b6a236781db5e59e81ac5446caf45f407393ff8f8c0b1/task-specs/phase-13-release-deploy.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-blog-top-page-compositionのP13 lifecycle責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-blog-top-page-composition/sys-blog-top-page-composition-p13.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-1z9w","github_mirror":null,"linked_at":"2026-09-04T07:35:10Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T03:19:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: development deployment・rollback確認・仕様書への書き戻し

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-top-page-composition
- owners: ["daishiman"]
- tags: ["p13", "feat-blog-top-page-composition"]
- related_nodes: ["spec-system-spec-index", "arch-system-spec-overview"]
- parent_feature: feat-blog-top-page-composition
- phase_ref: P13
- classification: confidence=1.0; reason=feat-blog-top-page-compositionのP13 lifecycle責務への確定写像; candidate=tasks/feat-blog-top-page-composition/sys-blog-top-page-composition-p13.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P12から引き継いだfinal_code_artifact_digestとdeployment前のpre_state_digestが一致する場合だけ既定のdevelopment環境へdeployし、smoke/telemetry/rollbackを確認したうえで、実行結果・判断・改善点をsystem-spec/ui-ux.md・system-spec/frontend.md・architecture/system-spec-overview.mdへ正規reopen経由で書き戻す。

## 背景

P08-P12の確定成果物を入力にする最後のphaseであり、実デプロイが本番承認未了でもN/A: reasonとclose-out receiptを持つことでnodeを省略しない。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-top-page-composition, spec-system-spec-index, arch-system-spec-overview, SYS-BLOG-TOP-PAGE-COMPOSITION-P12
- Entry gate: depends_onの全taskがdoneまたはclosed
- P01 upstream entry gate: N/A: intra-feature depends_on gate
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Planner runtime pin: system-dev-planner v0.1.10。host skill pathからplugin rootを解決して`SYSTEM_DEV_PLANNER_ROOT`へ設定し、repository内の別versionを暗黙選択しない
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; developmentでの区画構成・追従ヘッダー・カード表示をsmokeする
- Backend: N/A: 新規サービスを持たない
- API: applicable; ?sort=latest|popularのlive挙動を確認する
- Data: N/A: DBスキーマ変更を伴わない
- Infrastructure: applicable; IaC静的検証・deployment・smoke・rollbackを実行する
- Security: applicable; production secretを持ち込まず非模倣検査のCI実行を確認する
- Quality: applicable; post-deploy acceptanceを確認する
- Documentation: applicable; release reportとspec writebackを確定する
- Operations: applicable; development deployment・監視・rollback・close-outを所有する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app。読者向けトップページの配信先をこのunitへ固定する
- Compatibility/migration/backfill: 既存のブログトップ(src/app/s/[site]/page.tsx)・記事一覧・カテゴリ導線との後方互換を保ち、破壊的移行はP08のdry-runとrollback証跡なしに実行しない

## 成果物

- Produced artifacts: final_code_artifact_digest、pre_state_digest、digest_equal=true、deployment_id、exact rollback command、post-rollback smoke probe、invalidated evidence IDsを含むrelease/rollback report、close-out receipt、canonical spec/architecture writeback
- Consumed artifacts: docs/spec/feat-blog-top-page-composition/runbook.md, docs/spec/feat-blog-top-page-composition/handover.md内のfinal_code_artifact_digest, docs/spec/feat-blog-top-page-composition/evidence-manifest.json内のfinal_code_artifact_digest
- Write scope/touches: docs/spec/feat-blog-top-page-composition/release-report.md, system-spec/ui-ux.md, system-spec/frontend.md, architecture/system-spec-overview.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads bindingではGitHub Projectsを更新しない
- PR completion policy: linked_pr_merged_all
- PR body contract: Beads issue参照とdev-graph graph_node_id=SYS-BLOG-TOP-PAGE-COMPOSITION-P13を記載し、target branchはdevとする
- Ownership boundary: system-dev-plannerはintentを宣言し、dev-graphが起票・依存・完了収束を所有する

## Branch and worktree execution

- Branch: dev-graph登録後にC15がdevgraph/SYS-BLOG-TOP-PAGE-COMPOSITION-P13として割り当てる
- Worktree lease: 実装開始前にSYS-BLOG-TOP-PAGE-COMPOSITION-P13をclaimし、heartbeatとreleaseをlease契約どおり行う
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
- Required evidence: docs/spec/feat-blog-top-page-composition/release-report.md内のfinal_code_artifact_digest、pre_state_digest、digest_equal=true、deployment_id、rollback_command、probe_command、probe_result、invalidated_evidence_ids、system-spec/ui-ux.md、system-spec/frontend.md、architecture/system-spec-overview.md
- Acceptance state: P13: deployment前にpre_state_digest == P12/P11.final_code_artifact_digestをfail-closedで確認し、release reportへdigest_equal=trueとdeployment IDを固定する。実行可能なrollback command、成功判定probe、timeout、owner、rollback時に無効化する下流evidence IDを記録し、rehearsal PASS後だけclose-outする。本番未承認はN/A reasonを残し、P13 spec/architecture writeback: requiredをR4-reopen経由で行う。

## Inner goal-seek execution loop

- Methodology contract: system-task-goal-seek/v1
- Goal: P11/P12が引き継いだfinal_code_artifact_digestと同一のpre_stateだけを既定のdevelopment環境へdeployし、smoke/telemetry/rollbackを確認したうえで、実行結果・判断・改善点をsystem-spec/ui-ux.md・system-spec/frontend.md・architecture/system-spec-overview.mdへ正規reopen経由で書き戻す。
- Generic execution prompt: feature goal、当phaseの目的、depends_on成果物、write_scope、scope_outを入力し、手段を固定せず観測可能なacceptanceを満たす成果物を作る
- Rubric: 当task acceptance、既定80% coverage、回帰0、required evidence、write_scope厳守の全項目
- Feedback loop: 実装と独立した評価へ渡し、findingを次周のpromptへ反映してrubric verdict=PASSまで反復する。上限到達時はfail-closedで前phaseへ差し戻す
- P13 spec/architecture writeback: required。実行結果・判断・改善点をR4-reopen経由で確定章へ反映する。

## Rollout and rollback

- Rollout: pre_state/deployment/rollback/probe/evidence invalidationを固定したrelease report、close-out receipt、canonical spec/architecture writebackをwrite_scope内へ適用する
- Rollback trigger and steps: deployment smoke・telemetry・rubricのいずれかがFAIL、またはtimeout時に、release reportのdeployment_idとpre_state_digestを照合し、記録済みrollback_commandを実行する。記録済みprobe_commandの成功を確認し、invalidated_evidence_idsを失効化してclose-outを停止する

## Handoff

- Executor: system build route。dev-graph登録とworktree claim後に実行する
- Ready when: confirmed、evaluation pass、implementation readiness complete、promoted digest、dev-graph exact-13 registrationが揃う
- Completion condition: P13: deployment前にpre_state_digest == P12/P11.final_code_artifact_digestをfail-closedで確認し、release reportへdigest_equal=trueとdeployment IDを固定する。実行可能なrollback command、成功判定probe、timeout、owner、rollback時に無効化する下流evidence IDを記録し、rehearsal PASS後だけclose-outする。本番未承認はN/A reasonを残し、P13 spec/architecture writeback: requiredをR4-reopen経由で行う。

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-blog-top-page-composition
- Phase doc: .claude/plugins/system-dev-planner/references/system-plan-phase-names.md#P13
- Dependencies: SYS-BLOG-TOP-PAGE-COMPOSITION-P12
