---
graph_node_id: "SYS-SEO-ASSESSMENT-REFLECTION-P04"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-seo-assessment-reflection"
domain: "quality"
tags: ["p04","feat-seo-assessment-reflection"]
priority: null
start_date: null
target_date: null
iteration: null
title: "SEO 診断の受入テスト設計"
owners: ["daishiman"]
created_at: "2026-09-03T23:47:29Z"
updated_at: "2026-09-04T02:59:55.764323Z"
status: "active"
depends_on: ["SYS-SEO-ASSESSMENT-REFLECTION-P03"]
related_nodes: []
resource_scope: ["docs/spec/feat-seo-assessment-reflection/test-plan.md","docs/spec/feat-seo-assessment-reflection/test-cases.md"]
purpose: "受入10件を自動テストへ写像し、不正な構造化データが指摘として立ち妥当なものは立たないこと、採用した推奨が下書きにだけ書かれること、sitemap と RSS/Atom が公開記事を漏れなく列挙すること、拒否設定が robots.txt に反映されることを、実行可能なケース表として確定した状態を成立させる。"
goal: "受入10件を自動テストへ写像し、不正な構造化データが指摘として立ち妥当なものは立たないこと、採用した推奨が下書きにだけ書かれること、sitemap と RSS/Atom が公開記事を漏れなく列挙すること、拒否設定が robots.txt に反映されることを、実行可能なケース表として確定した状態を成立させる。"
scope_in: ["Produced artifacts: docs/spec/feat-seo-assessment-reflection/test-plan.md (受入10件とテストケースの一意対応表); docs/spec/feat-seo-assessment-reflection/test-cases.md (単体・結合・境界値・回帰のケース一覧)","Consumed artifacts: features/feat-seo-assessment-reflection.md; features/feat-seo-assessment-reflection.context.json; system-spec/backend.md; system-spec/database.md; system-spec/frontend.md","Write scope/touches: docs/spec/feat-seo-assessment-reflection/test-plan.md, docs/spec/feat-seo-assessment-reflection/test-cases.md"]
scope_out: ["検索順位そのものの保証や、ベンダー推定の数値目標 (作らない)","公開面を直接書き換える経路 (必ず下書き経由とする)","AI 検索・回答エンジン向けの回答単位と llms.txt (feat-aeo-answer-optimization が所有する)","診断結果の残数表示と提示順序 (feat-blog-scoped-admin-console が所有する)","P04 以外の phase が所有する成果物への変更"]
acceptance: ["Automated commands: `pnpm vitest run --reporter=dot` (既存テストが緑のままであることを基準線として確認する)","Required evidence: test-plan.md の受入10件すべてに対応テストケースが存在すること","Required evidence: P04 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform","arch-blog-operations-console"]
parent_feature: "feat-seo-assessment-reflection"
feature_package_id: "feature-package/feat-seo-assessment-reflection"
phase_ref: "P04"
file_path: "tasks/feat-seo-assessment-reflection/sys-seo-assessment-reflection-p04.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"7d8842a138d09aacfd5b87277165649d3c17a1ffa89019dfa4a6aa68b4480f49","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-seo-assessment-reflection/7d8842a138d09aacfd5b87277165649d3c17a1ffa89019dfa4a6aa68b4480f49/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-03T23:47:29Z","origin_kind":"system-dev-planner","source_digest":"7d8842a138d09aacfd5b87277165649d3c17a1ffa89019dfa4a6aa68b4480f49","source_path":".dev-graph/published/generations/feature-package-feat-seo-assessment-reflection/7d8842a138d09aacfd5b87277165649d3c17a1ffa89019dfa4a6aa68b4480f49/task-specs/phase-04-test-design.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-seo-assessment-reflection の P04 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-seo-assessment-reflection/sys-seo-assessment-reflection-p04.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-ji7d.4","github_mirror":null,"linked_at":"2026-09-04T02:08:35Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T00:00:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: SEO 診断の受入テスト設計

## Machine-readable registration fields

- feature_package_id: feature-package/feat-seo-assessment-reflection
- owners: ["daishiman"]
- tags: ["p04", "feat-seo-assessment-reflection"]
- related_nodes: []
- parent_feature: feat-seo-assessment-reflection
- phase_ref: P04
- classification: confidence=1.0; reason=feat-seo-assessment-reflection の P04 lifecycle 責務への確定写像; candidate=tasks/feat-seo-assessment-reflection/sys-seo-assessment-reflection-p04.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

受入10件を自動テストへ写像し、不正な構造化データが指摘として立ち妥当なものは立たないこと、採用した推奨が下書きにだけ書かれること、sitemap と RSS/Atom が公開記事を漏れなく列挙すること、拒否設定が robots.txt に反映されることを、実行可能なケース表として確定した状態を成立させる。

## 背景

「妥当なものは指摘として立たない」という条件は、偽陽性を防ぐための検証であり、正常系のケースを明示的に用意しないと確かめられない。テスト設計で正常系と異常系を対で並べる。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-seo-assessment-reflection, system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/backend.md, system-spec/database.md, system-spec/frontend.md, system-spec/ui-ux.md, architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: parent_feature.depends_on all done|closed (P01 claim 時に canonical dev-graph の parent feature が持つ depends_on 全件を都度読み、done|closed のときだけ通す派生 gate。upstream ID を task DAG へ複製しない)
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 記事画面の診断結果と推奨採用の操作面を扱う
- Backend: applicable; assess-article-seo と apply-seo-recommendation を扱う
- API: applicable; sitemap.xml / RSS・Atom / robots.txt の配信経路を扱う
- Data: applicable; article_seo_assessments の設計を扱う
- Infrastructure: N/A: 既存 Workers/D1 デプロイ単位を変更しない
- Security: applicable; 推奨採用が承認経路を迂回しないことを扱う
- Quality: applicable; 構造化データ検証が純関数で外部通信なしに検査できることを検証する
- Documentation: applicable; 指針の出典と 90 日見直しの説明を扱う
- Operations: applicable; 月次再診断の定期実行を扱う

## Architecture and deploy unit

- Architecture decisions: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存資産との重複解消と移行は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-seo-assessment-reflection/test-plan.md (受入10件とテストケースの一意対応表); docs/spec/feat-seo-assessment-reflection/test-cases.md (単体・結合・境界値・回帰のケース一覧)
- Consumed artifacts: features/feat-seo-assessment-reflection.md; features/feat-seo-assessment-reflection.context.json; system-spec/backend.md; system-spec/database.md; system-spec/frontend.md
- Write scope/touches: docs/spec/feat-seo-assessment-reflection/test-plan.md, docs/spec/feat-seo-assessment-reflection/test-cases.md

## Tracker publication and completion

> 本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-SEO-ASSESSMENT-REFLECTION-P04; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-SEO-ASSESSMENT-REFLECTION-P04; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-SEO-ASSESSMENT-REFLECTION-P04 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-seo-assessment-reflection 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- 検索順位そのものの保証や、ベンダー推定の数値目標 (作らない)
- 公開面を直接書き換える経路 (必ず下書き経由とする)
- AI 検索・回答エンジン向けの回答単位と llms.txt (feat-aeo-answer-optimization が所有する)
- 診断結果の残数表示と提示順序 (feat-blog-scoped-admin-console が所有する)
- P04 以外の phase が所有する成果物への変更

## テスト戦略

- テストレベル選定: 単体: 構造化データ検証の純関数を妥当・不正の対で検査する。結合: 公開・更新契機からの診断生成と下書き書き戻し。境界値: 構造化データ欠落・部分的に不正・noindex 記事・クローラ拒否ブログ・公開記事0件。回帰: 既存 tests 配下を0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/domain/seo, src/application/seo, src/app/admin/sites) に適用する。
- 層別方針: フロントエンドは可視ラベルとアクセシブル名による behavior 検証、バックエンド/API/データは API 契約テストとロジック単体テストと DB 結合テスト (D1) で検証、インフラは IaC 静的検証とデプロイ後の smoke 検証で確認する。
- 保守性制約: pixel 位置依存・DOM 構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm vitest run --reporter=dot` (既存テストが緑のままであることを基準線として確認する)
- Required evidence: test-plan.md の受入10件すべてに対応テストケースが存在すること
- Required evidence: P04 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: 受入10件を自動テストへ写像し、不正な構造化データが指摘として立ち妥当なものは立たないこと、採用した推奨が下書きにだけ書かれること、sitemap と RSS/Atom が公開記事を漏れなく列挙すること、拒否設定が robots.txt に反映されることを、実行可能なケース表として確定した状態を成立させる。
- Generic execution prompt: feat-seo-assessment-reflection の goal (公開・更新時と月次で article_seo_assessments が生成され、検証可能な指摘 (索引可能性・構造化データの妥当性・更新日の掲出・内部リンク・見出し構造) だけが提示され、採用した推奨は下書きへ書き戻されて既存の人間承認経路を必ず通る状態になっている) と本 task の 前提条件/成果物/write scope/スコープ外 を渡し、実装手段は固定せず P04 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件・カバレッジ目標 green・既存テストの回帰0件・Required evidence の証跡取得・write scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10 相当) へ渡し、finding を Generic execution prompt へ反映して再実行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P04 の成果物を write scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P04 の write scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入10件すべてに対応テストケースが割り当てられ、実装が着手できる

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/backend.md, system-spec/database.md, system-spec/frontend.md, system-spec/ui-ux.md
- Architecture: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Feature: feat-seo-assessment-reflection
- Phase doc: system-plan-phase-names.md#P04
- Dependencies: SYS-SEO-ASSESSMENT-REFLECTION-P03
