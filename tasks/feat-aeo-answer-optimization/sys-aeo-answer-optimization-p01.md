---
graph_node_id: "SYS-AEO-ANSWER-OPTIMIZATION-P01"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-aeo-answer-optimization"
domain: "documentation"
tags: ["p01","feat-aeo-answer-optimization"]
priority: null
start_date: null
target_date: null
iteration: null
title: "回答単位と AI クローラ方針の要求ベースライン確定"
owners: ["daishiman"]
created_at: "2026-09-03T23:50:39Z"
updated_at: "2026-09-04T02:30:26.680606Z"
status: "active"
depends_on: []
related_nodes: []
resource_scope: ["docs/spec/feat-aeo-answer-optimization/requirements-baseline.md","docs/spec/feat-aeo-answer-optimization/answer-unit-catalog.md","docs/spec/feat-aeo-answer-optimization/crawler-policy.md"]
purpose: "feat-aeo-answer-optimization の受入9件を検証可能な条件文へ写像し、回答単位6種の定義と、AI クローラ方針の既定が許可であることを要求として確定した状態を成立させる。"
goal: "feat-aeo-answer-optimization の受入9件を検証可能な条件文へ写像し、回答単位6種の定義と、AI クローラ方針の既定が許可であることを要求として確定した状態を成立させる。"
scope_in: ["Produced artifacts: docs/spec/feat-aeo-answer-optimization/requirements-baseline.md (受入9件と検証条件の一意対応表); docs/spec/feat-aeo-answer-optimization/answer-unit-catalog.md (結論・要点・比較表・FAQ・出典・最終更新日の各定義と欠落判定); docs/spec/feat-aeo-answer-optimization/crawler-policy.md (AI クローラ方針の既定と拒否リストの意味)","Consumed artifacts: features/feat-aeo-answer-optimization.md; features/feat-aeo-answer-optimization.context.json; system-spec/frontend.md; system-spec/database.md; docs/spec/feat-seo-assessment-reflection/validation-design.md","Write scope/touches: docs/spec/feat-aeo-answer-optimization/requirements-baseline.md, docs/spec/feat-aeo-answer-optimization/answer-unit-catalog.md, docs/spec/feat-aeo-answer-optimization/crawler-policy.md"]
scope_out: ["特定の AI 検索サービスでの露出保証や順位保証 (作らない)","索引可能性・sitemap・一般的な構造化データ検査 (feat-seo-assessment-reflection が所有する)","回答単位の本文を自動生成して無承認で公開すること (行わない)","残数・優先度の提示順序 (feat-blog-scoped-admin-console が所有する)","P01 以外の phase が所有する成果物への変更"]
acceptance: ["Automated commands: `pnpm run typecheck` (要求が参照する既存型と矛盾しないことを確認する)","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-aeo-answer-optimization` (本 package の C12 決定論検証を再実行する)","Required evidence: P01 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform","arch-blog-operations-console"]
parent_feature: "feat-aeo-answer-optimization"
feature_package_id: "feature-package/feat-aeo-answer-optimization"
phase_ref: "P01"
file_path: "tasks/feat-aeo-answer-optimization/sys-aeo-answer-optimization-p01.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"28ef645b555a296f2897d328cb89a1c45e5257b2282cc3394e8839e61783af03","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-aeo-answer-optimization/28ef645b555a296f2897d328cb89a1c45e5257b2282cc3394e8839e61783af03/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-03T23:50:39Z","origin_kind":"system-dev-planner","source_digest":"28ef645b555a296f2897d328cb89a1c45e5257b2282cc3394e8839e61783af03","source_path":".dev-graph/published/generations/feature-package-feat-aeo-answer-optimization/28ef645b555a296f2897d328cb89a1c45e5257b2282cc3394e8839e61783af03/task-specs/phase-01-requirements.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-aeo-answer-optimization の P01 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-aeo-answer-optimization/sys-aeo-answer-optimization-p01.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-4d0q.1","github_mirror":null,"linked_at":"2026-09-04T02:09:21Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T00:00:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: 回答単位と AI クローラ方針の要求ベースライン確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-aeo-answer-optimization
- owners: ["daishiman"]
- tags: ["p01", "feat-aeo-answer-optimization"]
- related_nodes: []
- parent_feature: feat-aeo-answer-optimization
- phase_ref: P01
- classification: confidence=1.0; reason=feat-aeo-answer-optimization の P01 lifecycle 責務への確定写像; candidate=tasks/feat-aeo-answer-optimization/sys-aeo-answer-optimization-p01.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

feat-aeo-answer-optimization の受入9件を検証可能な条件文へ写像し、回答単位6種の定義と、AI クローラ方針の既定が許可であることを要求として確定した状態を成立させる。

## 背景

AEO は成果の測り方が定まりにくい領域である。露出の保証を要求に混ぜると検証できない条件になるため、要求段階で「構造が存在すること」「配信が行われること」「観測が残ること」という検証可能な形へ限定する。クローラ方針の既定を許可と定めるのは、拒否を既定にすると気付かぬうちに全ブログが対象外になるためである。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-aeo-answer-optimization, system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/ui-ux.md, architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: parent_feature.depends_on all done|closed (P01 claim 時に canonical dev-graph の parent feature が持つ depends_on 全件を都度読み、done|closed のときだけ通す派生 gate。upstream ID を task DAG へ複製しない)
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 記事の回答単位ブロックと著者プロフィール面を扱う
- Backend: applicable; 回答単位の管理と引用観測台帳の記録を扱う
- API: applicable; llms.txt と robots.txt の AI クローラ方針配信を扱う
- Data: applicable; site_aeo_profiles と article_answer_units の設計を扱う
- Infrastructure: N/A: 既存 Workers/D1 デプロイ単位を変更しない
- Security: applicable; 回答単位が下書き経由でしか公開面へ入らないことを扱う
- Quality: applicable; 露出保証のような検証不能条件が要求に無いことを検査する
- Documentation: applicable; 回答単位の書き方と AI クローラ方針の説明を扱う
- Operations: applicable; 引用状況の定点観測の運用を扱う

## Architecture and deploy unit

- Architecture decisions: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存資産との重複解消と移行は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-aeo-answer-optimization/requirements-baseline.md (受入9件と検証条件の一意対応表); docs/spec/feat-aeo-answer-optimization/answer-unit-catalog.md (結論・要点・比較表・FAQ・出典・最終更新日の各定義と欠落判定); docs/spec/feat-aeo-answer-optimization/crawler-policy.md (AI クローラ方針の既定と拒否リストの意味)
- Consumed artifacts: features/feat-aeo-answer-optimization.md; features/feat-aeo-answer-optimization.context.json; system-spec/frontend.md; system-spec/database.md; docs/spec/feat-seo-assessment-reflection/validation-design.md
- Write scope/touches: docs/spec/feat-aeo-answer-optimization/requirements-baseline.md, docs/spec/feat-aeo-answer-optimization/answer-unit-catalog.md, docs/spec/feat-aeo-answer-optimization/crawler-policy.md

## Tracker publication and completion

> 本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-AEO-ANSWER-OPTIMIZATION-P01; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-AEO-ANSWER-OPTIMIZATION-P01; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-AEO-ANSWER-OPTIMIZATION-P01 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-aeo-answer-optimization 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- 特定の AI 検索サービスでの露出保証や順位保証 (作らない)
- 索引可能性・sitemap・一般的な構造化データ検査 (feat-seo-assessment-reflection が所有する)
- 回答単位の本文を自動生成して無承認で公開すること (行わない)
- 残数・優先度の提示順序 (feat-blog-scoped-admin-console が所有する)
- P01 以外の phase が所有する成果物への変更

## テスト戦略

- テストレベル選定: 文書 phase のため実行テストを持たず、受入9件すべてが検証可能文へ写像されたことを完了条件とする。 N/A: 単体・結合・境界値・回帰 の各テストレベルは、本 task の成果物が文書と判定であり実行可能なコードを含まないため適用しない。
- カバレッジ目標: 既定 80% を新規実装コード (src/domain/aeo, src/application/aeo, src/components/reader) に適用する。
- 層別方針: フロントエンドは可視ラベルとアクセシブル名による behavior 検証、バックエンド/API/データは API 契約テストとロジック単体テストと DB 結合テスト (D1) で検証、インフラは IaC 静的検証とデプロイ後の smoke 検証で確認する。
- 保守性制約: pixel 位置依存・DOM 構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run typecheck` (要求が参照する既存型と矛盾しないことを確認する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-aeo-answer-optimization` (本 package の C12 決定論検証を再実行する)
- Required evidence: P01 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: feat-aeo-answer-optimization の受入9件を検証可能な条件文へ写像し、回答単位6種の定義と、AI クローラ方針の既定が許可であることを要求として確定した状態を成立させる。
- Generic execution prompt: feat-aeo-answer-optimization の goal (記事が結論・要点・比較表・FAQ・出典・最終更新日という回答単位を持ち、article_answer_units と site_aeo_profiles として管理され、llms.txt とブログごとのクローラ方針が配信され、AI 検索での引用状況を定点で記録できる状態になっている) と本 task の 前提条件/成果物/write scope/スコープ外 を渡し、実装手段は固定せず P01 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件・カバレッジ目標 green・既存テストの回帰0件・Required evidence の証跡取得・write scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10 相当) へ渡し、finding を Generic execution prompt へ反映して再実行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P01 の成果物を write scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P01 の write scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入9件の要求写像、回答単位カタログ、クローラ方針が確定している

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/ui-ux.md
- Architecture: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Feature: feat-aeo-answer-optimization
- Phase doc: system-plan-phase-names.md#P01
- Dependencies: N/A: P01 は intra-feature 依存を持たない起点 task である
