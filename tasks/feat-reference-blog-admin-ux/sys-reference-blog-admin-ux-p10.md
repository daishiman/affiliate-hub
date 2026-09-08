---
graph_node_id: "SYS-REFERENCE-BLOG-ADMIN-UX-P10"
artifact_kind: "task"
artifact_subtypes: []
title: "目的・受入・品質証跡の独立最終レビュー"
project_id: "feature-package-feat-reference-blog-admin-ux"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["p10","feat-reference-blog-admin-ux"]
file_path: "tasks/feat-reference-blog-admin-ux/sys-reference-blog-admin-ux-p10.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"a052d177cdedc029acbb2fd747bce579c0626bed5f6b64f9a94504ed6a2e75bd","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-reference-blog-admin-ux/a052d177cdedc029acbb2fd747bce579c0626bed5f6b64f9a94504ed6a2e75bd/plan-findings.json"}
source_lineage: {"imported_at":"2026-08-29T14:56:20Z","origin_kind":"system-dev-planner","source_digest":"a052d177cdedc029acbb2fd747bce579c0626bed5f6b64f9a94504ed6a2e75bd","source_path":".dev-graph/published/generations/feature-package-feat-reference-blog-admin-ux/a052d177cdedc029acbb2fd747bce579c0626bed5f6b64f9a94504ed6a2e75bd/task-specs/phase-10-final-review.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
created_at: "2026-08-29T14:56:20Z"
updated_at: "2026-08-29T14:56:20Z"
depends_on: ["SYS-REFERENCE-BLOG-ADMIN-UX-P09"]
related_nodes: ["spec-system-spec-index","arch-system-spec-overview"]
resource_scope: ["docs/spec/feat-reference-blog-admin-ux/final-review.md"]
purpose: "P01のbaseline、P03 design verdict、P07 acceptance、P09 QAを同じA1–A12とcurrent bytesで突合し、実装完了判定を生成者から独立して下す。"
goal: "P01のbaseline、P03 design verdict、P07 acceptance、P09 QAを同じA1–A12とcurrent bytesで突合し、実装完了判定を生成者から独立して下す。"
scope_in: ["Produced artifacts: digest-bound independent final review","Consumed artifacts: features/feat-reference-blog-admin-ux.md, features/feat-reference-blog-admin-ux.context.json, system-spec/ui-ux.md, system-spec/frontend.md, SYS-REFERENCE-BLOG-ADMIN-UX-P09","Write scope/touches: docs/spec/feat-reference-blog-admin-ux/final-review.md"]
scope_out: ["認証が必要なページ、アクセス制御の回避、第三者ECの保護APIへの無断接続","参照元の文章・写真・ロゴ・イラスト・固有名・色値・theme/plugin資産の複製","affiliate報酬支払・会計・購入確定、本番公開、承認なしの一括破壊的migration","feat-reference-blog-admin-uxのscope_outに含まれる作業と、別featureの正本責務"]
acceptance: ["Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-reference-blog-admin-ux`","Automated commands: `pnpm typecheck`、`pnpm content:validate`、対象test suite。実装を持たないphaseは適用外理由をreportへ残す","Required evidence: docs/spec/feat-reference-blog-admin-ux/final-review.md","Acceptance state: P10: A1–A12の証跡欠落0、high finding 0、P07/P09のdigest一致、既存feature境界逸脱0、非模倣gate PASS、release blocker 0の場合のみreadiness=completeとし、それ以外はFAILと修正phaseを明記する。"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: "feat-reference-blog-admin-ux"
feature_package_id: "feature-package/feat-reference-blog-admin-ux"
phase_ref: "P10"
classification_confidence: 1
classification_reason: "feat-reference-blog-admin-ux の P10 lifecycle責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-reference-blog-admin-ux/sys-reference-blog-admin-ux-p10.md","confidence":1}]
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

# System task overlay: 目的・受入・品質証跡の独立最終レビュー

## Machine-readable registration fields

- feature_package_id: feature-package/feat-reference-blog-admin-ux
- owners: ["daishiman"]
- tags: ["p10", "feat-reference-blog-admin-ux"]
- related_nodes: ["spec-system-spec-index", "arch-system-spec-overview"]
- parent_feature: feat-reference-blog-admin-ux
- phase_ref: P10
- classification: confidence=1.0; reason=feat-reference-blog-admin-uxのP10 lifecycle責務への確定写像; candidate=tasks/feat-reference-blog-admin-ux/sys-reference-blog-admin-ux-p10.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P01のbaseline、P03 design verdict、P07 acceptance、P09 QAを同じA1–A12とcurrent bytesで突合し、実装完了判定を生成者から独立して下す。

## 背景

参照ブログの14サブサイトマップと公開URL 1,072件のベースライン、画面型別の共通構成、現行管理画面の実装済み機能とgapを、features/feat-reference-blog-admin-ux.mdのA1–A12へtraceする。情報階層と操作原則だけを抽象化し、第三者の文章・写真・ロゴ・固有名・色値を転用しない。本phaseはSYS-REFERENCE-BLOG-ADMIN-UX-P09の確定成果物を入力にする。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-reference-blog-admin-ux, spec-system-spec-index, arch-system-spec-overview, SYS-REFERENCE-BLOG-ADMIN-UX-P09
- Entry gate: depends_onの全taskがdoneまたはclosed

- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 最終画面のbehavior evidenceをレビューする
- Backend: applicable; API 契約と保存結果をレビューする
- API: applicable; preview contract evidenceをレビューする
- Data: applicable; DB 結合・migration evidenceをレビューする
- Infrastructure: applicable; IaC/smoke evidenceをレビューする
- Security: applicable; SSRF/認可/非模倣evidenceをレビューする
- Quality: applicable; C1–C4とA1–A12を独立採点する
- Documentation: applicable; final verdictを正本化する
- Operations: applicable; rollback/release blockerを確認する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md
- Deploy unit/environment: cloudflare-workers-opennext-app。分析文書だけのphaseも最終的な適用先をこのunitへ固定する
- Compatibility/migration/backfill: 既存blog-ops、content、affiliate link、D1 schemaとの後方互換を保ち、破壊的移行はP08のdry-runとrollback証跡なしに実行しない

## 成果物

- Produced artifacts: digest-bound independent final review
- Consumed artifacts: features/feat-reference-blog-admin-ux.md, features/feat-reference-blog-admin-ux.context.json, system-spec/ui-ux.md, system-spec/frontend.md, SYS-REFERENCE-BLOG-ADMIN-UX-P09
- Write scope/touches: docs/spec/feat-reference-blog-admin-ux/final-review.md

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads bindingではGitHub Projectsを更新しない
- PR completion policy: linked_pr_merged_all
- PR body contract: Beads issue参照とdev-graph graph_node_id=SYS-REFERENCE-BLOG-ADMIN-UX-P10を記載し、target branchはdevとする
- Ownership boundary: system-dev-plannerはintentを宣言し、dev-graphが起票・依存・完了収束を所有する

## Branch and worktree execution

- Branch: dev-graph登録後にC15がdevgraph/SYS-REFERENCE-BLOG-ADMIN-UX-P10として割り当てる
- Worktree lease: 実装開始前にSYS-REFERENCE-BLOG-ADMIN-UX-P10をclaimし、heartbeatとreleaseをlease契約どおり行う
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
- Required evidence: docs/spec/feat-reference-blog-admin-ux/final-review.md
- Acceptance state: P10: A1–A12の証跡欠落0、high finding 0、P07/P09のdigest一致、既存feature境界逸脱0、非模倣gate PASS、release blocker 0の場合のみreadiness=completeとし、それ以外はFAILと修正phaseを明記する。

## Inner goal-seek execution loop

- Methodology contract: system-task-goal-seek/v1
- Goal: P01のbaseline、P03 design verdict、P07 acceptance、P09 QAを同じA1–A12とcurrent bytesで突合し、実装完了判定を生成者から独立して下す。
- Generic execution prompt: feature goal、当phaseの目的、depends_on成果物、write_scope、scope_outを入力し、手段を固定せず観測可能なacceptanceを満たす成果物を作る
- Rubric: 当task acceptance、既定80% coverage、回帰0、required evidence、write_scope厳守の全項目
- Feedback loop: 実装と独立した評価へ渡し、findingを次周のpromptへ反映してrubric verdict=PASSまで反復する。上限到達時はfail-closedで前phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13が所有する。

## Rollout and rollback

- Rollout: digest-bound independent final reviewをwrite_scope内へ適用し、検証PASS後に依存する次phaseへ渡す
- Rollback trigger and steps: P10のrubric verdictがFAILのまま上限へ到達した場合、write_scope内の当phase変更を戻し、直前のpromoted generationへ復帰する

## Handoff

- Executor: system build route。dev-graph登録とworktree claim後に実行する
- Ready when: confirmed、evaluation pass、implementation readiness complete、promoted digest、dev-graph exact-13 registrationが揃う
- Completion condition: P10: A1–A12の証跡欠落0、high finding 0、P07/P09のdigest一致、既存feature境界逸脱0、非模倣gate PASS、release blocker 0の場合のみreadiness=completeとし、それ以外はFAILと修正phaseを明記する。

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-reference-blog-admin-ux
- Phase doc: system-plan-phase-names.md#P10
- Dependencies: SYS-REFERENCE-BLOG-ADMIN-UX-P09

## 実行契約

- source spec: 昇格済み generation の task spec 本文 (byte-for-byte 不変)
- verification: published task spec の Automated commands
- rerun: published task spec 内の `validate-system-plan.py --repo-root . --staging .` は repository root から解決できない。再検証は世代非依存の `python3 plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-reference-blog-admin-ux` を使い、current pointer から現行世代を再解決する。

