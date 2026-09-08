---
graph_node_id: "SYS-SEO-ASSESSMENT-REFLECTION-P13"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-seo-assessment-reflection"
domain: "operations"
tags: ["p13","feat-seo-assessment-reflection"]
priority: null
start_date: null
target_date: null
iteration: null
title: "SEO 診断のリリースと仕様書への書き戻し"
owners: ["daishiman"]
created_at: "2026-09-03T23:47:29Z"
updated_at: "2026-09-04T03:04:00.182009Z"
status: "active"
depends_on: ["SYS-SEO-ASSESSMENT-REFLECTION-P12"]
related_nodes: []
resource_scope: ["system-spec/backend.md","system-spec/database.md","docs/spec/feat-seo-assessment-reflection/release-notes.md"]
purpose: "SEO 診断と推奨書き戻しを dev 経由で本番へ反映し、確定した指摘カタログと配信経路を system-spec の該当章へ書き戻した状態を成立させる。"
goal: "SEO 診断と推奨書き戻しを dev 経由で本番へ反映し、確定した指摘カタログと配信経路を system-spec の該当章へ書き戻した状態を成立させる。"
scope_in: ["Produced artifacts: system-spec/backend.md への診断ユースケースの書き戻し; system-spec/database.md への article_seo_assessments の書き戻し; docs/spec/feat-seo-assessment-reflection/release-notes.md (反映手順と切り戻し手順)","Consumed artifacts: features/feat-seo-assessment-reflection.md; features/feat-seo-assessment-reflection.context.json; system-spec/backend.md; system-spec/database.md; system-spec/frontend.md","Write scope/touches: system-spec/backend.md, system-spec/database.md, docs/spec/feat-seo-assessment-reflection/release-notes.md"]
scope_out: ["検索順位そのものの保証や、ベンダー推定の数値目標 (作らない)","公開面を直接書き換える経路 (必ず下書き経由とする)","AI 検索・回答エンジン向けの回答単位と llms.txt (feat-aeo-answer-optimization が所有する)","診断結果の残数表示と提示順序 (feat-blog-scoped-admin-console が所有する)","P13 以外の phase が所有する成果物への変更"]
acceptance: ["Automated commands: `pnpm run build` (本番相当ビルドが通ることを確認する)","Automated commands: `pnpm vitest run` (反映前の全テスト緑を確認する)","Required evidence: release-notes.md に切り戻し手順が記載されていること","Required evidence: P13 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform","arch-blog-operations-console"]
parent_feature: "feat-seo-assessment-reflection"
feature_package_id: "feature-package/feat-seo-assessment-reflection"
phase_ref: "P13"
file_path: "tasks/feat-seo-assessment-reflection/sys-seo-assessment-reflection-p13.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"7d8842a138d09aacfd5b87277165649d3c17a1ffa89019dfa4a6aa68b4480f49","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-seo-assessment-reflection/7d8842a138d09aacfd5b87277165649d3c17a1ffa89019dfa4a6aa68b4480f49/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-03T23:47:29Z","origin_kind":"system-dev-planner","source_digest":"7d8842a138d09aacfd5b87277165649d3c17a1ffa89019dfa4a6aa68b4480f49","source_path":".dev-graph/published/generations/feature-package-feat-seo-assessment-reflection/7d8842a138d09aacfd5b87277165649d3c17a1ffa89019dfa4a6aa68b4480f49/task-specs/phase-13-release-deploy.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-seo-assessment-reflection の P13 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-seo-assessment-reflection/sys-seo-assessment-reflection-p13.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-ji7d.13","github_mirror":null,"linked_at":"2026-09-04T02:08:54Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T00:00:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: SEO 診断のリリースと仕様書への書き戻し

## Machine-readable registration fields

- feature_package_id: feature-package/feat-seo-assessment-reflection
- owners: ["daishiman"]
- tags: ["p13", "feat-seo-assessment-reflection"]
- related_nodes: []
- parent_feature: feat-seo-assessment-reflection
- phase_ref: P13
- classification: confidence=1.0; reason=feat-seo-assessment-reflection の P13 lifecycle 責務への確定写像; candidate=tasks/feat-seo-assessment-reflection/sys-seo-assessment-reflection-p13.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

SEO 診断と推奨書き戻しを dev 経由で本番へ反映し、確定した指摘カタログと配信経路を system-spec の該当章へ書き戻した状態を成立させる。

## 背景

配信経路の変更は公開面に直接現れる。dev で sitemap と robots の実出力を確認してから本番へ進める。指摘カタログは AEO feature が共有するため仕様書へ書き戻す。

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
- Documentation: applicable; system-spec 該当章への書き戻しを扱う
- Operations: applicable; 月次再診断の定期実行を扱う

## Architecture and deploy unit

- Architecture decisions: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: system-spec への書き戻しは compile-spec-doc.py の正規経路を通し、章を直接編集しない

## 成果物

- Produced artifacts: system-spec/backend.md への診断ユースケースの書き戻し; system-spec/database.md への article_seo_assessments の書き戻し; docs/spec/feat-seo-assessment-reflection/release-notes.md (反映手順と切り戻し手順)
- Consumed artifacts: features/feat-seo-assessment-reflection.md; features/feat-seo-assessment-reflection.context.json; system-spec/backend.md; system-spec/database.md; system-spec/frontend.md
- Write scope/touches: system-spec/backend.md, system-spec/database.md, docs/spec/feat-seo-assessment-reflection/release-notes.md

## Tracker publication and completion

> 本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-SEO-ASSESSMENT-REFLECTION-P13; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-SEO-ASSESSMENT-REFLECTION-P13; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-SEO-ASSESSMENT-REFLECTION-P13 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-seo-assessment-reflection 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- 検索順位そのものの保証や、ベンダー推定の数値目標 (作らない)
- 公開面を直接書き換える経路 (必ず下書き経由とする)
- AI 検索・回答エンジン向けの回答単位と llms.txt (feat-aeo-answer-optimization が所有する)
- 診断結果の残数表示と提示順序 (feat-blog-scoped-admin-console が所有する)
- P13 以外の phase が所有する成果物への変更

## テスト戦略

- テストレベル選定: 回帰: 反映前に全テストが緑であることを前提とし、反映後は dev で sitemap.xml と robots.txt の実出力を確認する。 N/A: 単体・結合・境界値 の各テストレベルは、本 task の成果物が文書と判定であり実行可能なコードを含まないため適用しない。
- カバレッジ目標: 既定 80% を新規実装コード (src/domain/seo, src/application/seo, src/app/admin/sites) に適用する。
- 層別方針: フロントエンドは可視ラベルとアクセシブル名による behavior 検証、バックエンド/API/データは API 契約テストとロジック単体テストと DB 結合テスト (D1) で検証、インフラは IaC 静的検証とデプロイ後の smoke 検証で確認する。
- 保守性制約: pixel 位置依存・DOM 構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run build` (本番相当ビルドが通ることを確認する)
- Automated commands: `pnpm vitest run` (反映前の全テスト緑を確認する)
- Required evidence: release-notes.md に切り戻し手順が記載されていること
- Required evidence: P13 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: SEO 診断と推奨書き戻しを dev 経由で本番へ反映し、確定した指摘カタログと配信経路を system-spec の該当章へ書き戻した状態を成立させる。
- Generic execution prompt: feat-seo-assessment-reflection の goal (公開・更新時と月次で article_seo_assessments が生成され、検証可能な指摘 (索引可能性・構造化データの妥当性・更新日の掲出・内部リンク・見出し構造) だけが提示され、採用した推奨は下書きへ書き戻されて既存の人間承認経路を必ず通る状態になっている) と本 task の 前提条件/成果物/write scope/スコープ外 を渡し、実装手段は固定せず P13 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件・カバレッジ目標 green・既存テストの回帰0件・Required evidence の証跡取得・write scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10 相当) へ渡し、finding を Generic execution prompt へ反映して再実行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: required — 本 phase が実行結果・決定・改善 finding の system-spec / architecture への書き戻しを所有する

## Rollout and rollback

- Rollout: P13 の成果物を write scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P13 の write scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: dev での確認が済み、本番反映と仕様書書き戻しの準備が整っている

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/backend.md, system-spec/database.md, system-spec/frontend.md, system-spec/ui-ux.md
- Architecture: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Feature: feat-seo-assessment-reflection
- Phase doc: system-plan-phase-names.md#P13
- Dependencies: SYS-SEO-ASSESSMENT-REFLECTION-P12
