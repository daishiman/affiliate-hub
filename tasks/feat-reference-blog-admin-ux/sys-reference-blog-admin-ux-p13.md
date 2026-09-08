---
graph_node_id: "SYS-REFERENCE-BLOG-ADMIN-UX-P13"
artifact_kind: "task"
artifact_subtypes: []
title: "development段階展開・rollback確認・仕様書への書き戻し"
project_id: "feature-package-feat-reference-blog-admin-ux"
domain: "operations"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["p13","feat-reference-blog-admin-ux"]
file_path: "tasks/feat-reference-blog-admin-ux/sys-reference-blog-admin-ux-p13.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"a052d177cdedc029acbb2fd747bce579c0626bed5f6b64f9a94504ed6a2e75bd","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-reference-blog-admin-ux/a052d177cdedc029acbb2fd747bce579c0626bed5f6b64f9a94504ed6a2e75bd/plan-findings.json"}
source_lineage: {"imported_at":"2026-08-29T14:56:20Z","origin_kind":"system-dev-planner","source_digest":"a052d177cdedc029acbb2fd747bce579c0626bed5f6b64f9a94504ed6a2e75bd","source_path":".dev-graph/published/generations/feature-package-feat-reference-blog-admin-ux/a052d177cdedc029acbb2fd747bce579c0626bed5f6b64f9a94504ed6a2e75bd/task-specs/phase-13-release-deploy.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
created_at: "2026-08-29T14:56:20Z"
updated_at: "2026-08-29T14:56:20Z"
depends_on: ["SYS-REFERENCE-BLOG-ADMIN-UX-P12"]
related_nodes: ["spec-system-spec-index","arch-system-spec-overview"]
resource_scope: ["docs/spec/feat-reference-blog-admin-ux/release-report.md","system-spec/ui-ux.md","system-spec/frontend.md","system-spec/backend.md","system-spec/database.md","architecture/system-spec-overview.md"]
purpose: "feature flagでdevelopmentへ段階展開し、smoke/telemetry/rollbackを確認したうえで、実行結果・判断・改善点を確定仕様とarchitectureへ正規reopen経由で書き戻す。"
goal: "feature flagでdevelopmentへ段階展開し、smoke/telemetry/rollbackを確認したうえで、実行結果・判断・改善点を確定仕様とarchitectureへ正規reopen経由で書き戻す。"
scope_in: ["Produced artifacts: release/rollback report、close-out receipt、canonical spec/architecture writeback","Consumed artifacts: features/feat-reference-blog-admin-ux.md, features/feat-reference-blog-admin-ux.context.json, system-spec/ui-ux.md, system-spec/frontend.md, SYS-REFERENCE-BLOG-ADMIN-UX-P12","Write scope/touches: docs/spec/feat-reference-blog-admin-ux/release-report.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, architecture/system-spec-overview.md"]
scope_out: ["認証が必要なページ、アクセス制御の回避、第三者ECの保護APIへの無断接続","参照元の文章・写真・ロゴ・イラスト・固有名・色値・theme/plugin資産の複製","affiliate報酬支払・会計・購入確定、本番公開、承認なしの一括破壊的migration","feat-reference-blog-admin-uxのscope_outに含まれる作業と、別featureの正本責務"]
acceptance: ["Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-reference-blog-admin-ux`","Automated commands: `pnpm typecheck`、`pnpm content:validate`、対象test suite。実装を持たないphaseは適用外理由をreportへ残す","Required evidence: docs/spec/feat-reference-blog-admin-ux/release-report.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, architecture/system-spec-overview.md","Acceptance state: P13: development deployment、smoke、save/preview/placement telemetry、rollback rehearsalがPASSし、本番releaseが未承認ならN/A理由を記録し、P13 spec/architecture writeback: required としてUI・frontend・backend・database・architectureの確定章へ実装差分と残findingをR4-reopen経由で反映しclose-out receiptを残す。"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: "feat-reference-blog-admin-ux"
feature_package_id: "feature-package/feat-reference-blog-admin-ux"
phase_ref: "P13"
classification_confidence: 1
classification_reason: "feat-reference-blog-admin-ux の P13 lifecycle責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-reference-blog-admin-ux/sys-reference-blog-admin-ux-p13.md","confidence":1}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-29T14:38:12Z","missing_sections":[],"status":"complete"}
---

# System task overlay: development段階展開・rollback確認・仕様書への書き戻し

## Machine-readable registration fields

- feature_package_id: feature-package/feat-reference-blog-admin-ux
- owners: ["daishiman"]
- tags: ["p13", "feat-reference-blog-admin-ux"]
- related_nodes: ["spec-system-spec-index", "arch-system-spec-overview"]
- parent_feature: feat-reference-blog-admin-ux
- phase_ref: P13
- classification: confidence=1.0; reason=feat-reference-blog-admin-uxのP13 lifecycle責務への確定写像; candidate=tasks/feat-reference-blog-admin-ux/sys-reference-blog-admin-ux-p13.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

feature flagでdevelopmentへ段階展開し、smoke/telemetry/rollbackを確認したうえで、実行結果・判断・改善点を確定仕様とarchitectureへ正規reopen経由で書き戻す。

## 背景

参照ブログの14サブサイトマップと公開URL 1,072件のベースライン、画面型別の共通構成、現行管理画面の実装済み機能とgapを、features/feat-reference-blog-admin-ux.mdのA1–A12へtraceする。情報階層と操作原則だけを抽象化し、第三者の文章・写真・ロゴ・固有名・色値を転用しない。本phaseはSYS-REFERENCE-BLOG-ADMIN-UX-P12の確定成果物を入力にする。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-reference-blog-admin-ux, spec-system-spec-index, arch-system-spec-overview, SYS-REFERENCE-BLOG-ADMIN-UX-P12
- Entry gate: depends_onの全taskがdoneまたはclosed

- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; developmentのpublic/admin behaviorをsmokeする
- Backend: applicable; 保存/preview API 契約をsmokeする
- API: applicable; live error taxonomyを確認する
- Data: applicable; DB 結合とmigration状態を確認する
- Infrastructure: applicable; IaC静的検証・deployment・smoke・rollbackを実行する
- Security: applicable; production secretやthird-party権利を持ち込まない
- Quality: applicable; post-deploy acceptanceを確認する
- Documentation: applicable; release reportとspec writebackを確定する
- Operations: applicable; 段階展開・監視・rollback・close-outを所有する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md
- Deploy unit/environment: cloudflare-workers-opennext-app。分析文書だけのphaseも最終的な適用先をこのunitへ固定する
- Compatibility/migration/backfill: 既存blog-ops、content、affiliate link、D1 schemaとの後方互換を保ち、破壊的移行はP08のdry-runとrollback証跡なしに実行しない

## 成果物

- Produced artifacts: release/rollback report、close-out receipt、canonical spec/architecture writeback
- Consumed artifacts: features/feat-reference-blog-admin-ux.md, features/feat-reference-blog-admin-ux.context.json, system-spec/ui-ux.md, system-spec/frontend.md, SYS-REFERENCE-BLOG-ADMIN-UX-P12
- Write scope/touches: docs/spec/feat-reference-blog-admin-ux/release-report.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, architecture/system-spec-overview.md

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads bindingではGitHub Projectsを更新しない
- PR completion policy: linked_pr_merged_all
- PR body contract: Beads issue参照とdev-graph graph_node_id=SYS-REFERENCE-BLOG-ADMIN-UX-P13を記載し、target branchはdevとする
- Ownership boundary: system-dev-plannerはintentを宣言し、dev-graphが起票・依存・完了収束を所有する

## Branch and worktree execution

- Branch: dev-graph登録後にC15がdevgraph/SYS-REFERENCE-BLOG-ADMIN-UX-P13として割り当てる
- Worktree lease: 実装開始前にSYS-REFERENCE-BLOG-ADMIN-UX-P13をclaimし、heartbeatとreleaseをlease契約どおり行う
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
- Required evidence: docs/spec/feat-reference-blog-admin-ux/release-report.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, architecture/system-spec-overview.md
- Acceptance state: P13: development deployment、smoke、save/preview/placement telemetry、rollback rehearsalがPASSし、本番releaseが未承認ならN/A理由を記録し、P13 spec/architecture writeback: required としてUI・frontend・backend・database・architectureの確定章へ実装差分と残findingをR4-reopen経由で反映しclose-out receiptを残す。

## Inner goal-seek execution loop

- Methodology contract: system-task-goal-seek/v1
- Goal: feature flagでdevelopmentへ段階展開し、smoke/telemetry/rollbackを確認したうえで、実行結果・判断・改善点を確定仕様とarchitectureへ正規reopen経由で書き戻す。
- Generic execution prompt: feature goal、当phaseの目的、depends_on成果物、write_scope、scope_outを入力し、手段を固定せず観測可能なacceptanceを満たす成果物を作る
- Rubric: 当task acceptance、既定80% coverage、回帰0、required evidence、write_scope厳守の全項目
- Feedback loop: 実装と独立した評価へ渡し、findingを次周のpromptへ反映してrubric verdict=PASSまで反復する。上限到達時はfail-closedで前phaseへ差し戻す
- P13 spec/architecture writeback: required。実行結果・判断・改善点をR4-reopen経由で確定章へ反映する。

## Rollout and rollback

- Rollout: release/rollback report、close-out receipt、canonical spec/architecture writebackをwrite_scope内へ適用し、検証PASS後に依存する次phaseへ渡す
- Rollback trigger and steps: P13のrubric verdictがFAILのまま上限へ到達した場合、write_scope内の当phase変更を戻し、直前のpromoted generationへ復帰する

## Handoff

- Executor: system build route。dev-graph登録とworktree claim後に実行する
- Ready when: confirmed、evaluation pass、implementation readiness complete、promoted digest、dev-graph exact-13 registrationが揃う
- Completion condition: P13: development deployment、smoke、save/preview/placement telemetry、rollback rehearsalがPASSし、本番releaseが未承認ならN/A理由を記録し、P13 spec/architecture writeback: required としてUI・frontend・backend・database・architectureの確定章へ実装差分と残findingをR4-reopen経由で反映しclose-out receiptを残す。

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-reference-blog-admin-ux
- Phase doc: system-plan-phase-names.md#P13
- Dependencies: SYS-REFERENCE-BLOG-ADMIN-UX-P12

## 実行契約

- source spec: 昇格済み generation の task spec 本文 (byte-for-byte 不変)
- verification: published task spec の Automated commands
- rerun: published task spec 内の `validate-system-plan.py --repo-root . --staging .` は repository root から解決できない。再検証は世代非依存の `python3 plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-reference-blog-admin-ux` を使い、current pointer から現行世代を再解決する。

