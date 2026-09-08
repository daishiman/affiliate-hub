---
graph_node_id: "SYS-BLOG-UI-BUILDER-P12"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-blog-ui-builder"
domain: "documentation"
tags: ["p12","feat-blog-ui-builder"]
priority: null
start_date: null
target_date: null
iteration: null
title: "UI規則・SEO/AI検索運用規則と運用手順の文書化"
owners: ["daishiman"]
created_at: "2026-08-28T13:02:37Z"
updated_at: "2026-08-30T10:25:24Z"
status: "closed"
depends_on: ["SYS-BLOG-UI-BUILDER-P10","SYS-BLOG-UI-BUILDER-P11"]
related_nodes: []
resource_scope: ["docs/spec/feat-blog-ui-builder/ui-rules.md","docs/spec/feat-blog-ui-builder/operations.md"]
purpose: "テンプレート/配色2層/固定ページ/表現ブロック/SEO/AI標準ブロックのUI規則、guideline_references更新の90日サイクル規則 (A14対応)、新規テンプレート追加・新規固定ページ種別追加・配置管理運用・IndexNow鍵のローテーション (A13対応)・guideline_references登録の手順が文書化された状態を成立させる。"
goal: "テンプレート/配色2層/固定ページ/表現ブロック/SEO/AI標準ブロックのUI規則、guideline_references更新の90日サイクル規則 (A14対応)、新規テンプレート追加・新規固定ページ種別追加・配置管理運用・IndexNow鍵のローテーション (A13対応)・guideline_references登録の手順が文書化された状態を成立させる。"
scope_in: ["Produced artifacts: docs/spec/feat-blog-ui-builder/ui-rules.md (テンプレート/配色2層/表現ブロック/SEO/AI標準ブロック/guideline_references 90日サイクルの規則); docs/spec/feat-blog-ui-builder/operations.md (新規ブログ/テンプレート/固定ページ追加・アフィリエイト配置更新・IndexNow鍵ローテーション・guideline_references登録の運用手順)","Consumed artifacts: docs/spec/feat-blog-ui-builder/final-review.md, docs/spec/feat-blog-ui-builder/evidence/","Write scope/touches: docs/spec/feat-blog-ui-builder/ui-rules.md, docs/spec/feat-blog-ui-builder/operations.md"]
scope_out: ["feat-blog-ui-builder の scope_out に該当する変更","実装コードの変更 (write_scope外)"]
acceptance: ["Automated commands: `pnpm run lint` (運用手順に記載したscaffoldスクリプト参照が既存ファイルと一致することを確認する)","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` (本 package の C12 決定論検証を世代非依存に再実行する)","Required evidence: P12 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-two-layer-platform"]
parent_feature: "feat-blog-ui-builder"
feature_package_id: "feature-package/feat-blog-ui-builder"
phase_ref: "P12"
file_path: "tasks/feat-blog-ui-builder/sys-blog-ui-builder-p12.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-blog-ui-builder/168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48/plan-findings.json"}
source_lineage: {"imported_at":"2026-08-28T13:02:37Z","origin_kind":"system-dev-planner","source_digest":"168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48","source_path":".dev-graph/published/generations/feature-package-feat-blog-ui-builder/168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48/task-specs/phase-12-documentation-operations.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1
classification_reason: "feat-blog-ui-builder の P12 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-blog-ui-builder/sys-blog-ui-builder-p12.md","confidence":1}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-45ba.12","github_mirror":null,"linked_at":"2026-08-28T13:02:37Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-28T00:00:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: UI規則・SEO/AI検索運用規則と運用手順の文書化

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-ui-builder
- owners: ["daishiman"]
- tags: ["p12", "feat-blog-ui-builder"]
- related_nodes: []
- parent_feature: feat-blog-ui-builder
- phase_ref: P12
- classification: confidence=1.0; reason=feat-blog-ui-builder の P12 lifecycle 責務への確定写像; candidate=tasks/feat-blog-ui-builder/sys-blog-ui-builder-p12.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

テンプレート/配色2層/固定ページ/表現ブロック/SEO/AI標準ブロックのUI規則、guideline_references更新の90日サイクル規則 (A14対応)、新規テンプレート追加・新規固定ページ種別追加・配置管理運用・IndexNow鍵のローテーション (A13対応)・guideline_references登録の手順が文書化された状態を成立させる。

## 背景

P10で確定した実装は、今後のブログ追加・テンプレート追加・固定ページ追加の運用が繰り返し発生する前提であり、SEO/AI検索のガイドライン更新も90日ごとに再確認が必要である。その都度設計判断を再発明しないために規則と手順を確定文書として残す。source_feature_digest: sha256:8953a167a43f5fc55998ebfcaa83f437d59f0d567cde6e7c15e8b568ab470d7b

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-ui-builder, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P12 upstream entry gate: SYS-BLOG-UI-BUILDER-P10, SYS-BLOG-UI-BUILDER-P11 の implementation_readiness=complete
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 個別実装はP05/P08で完了済みであり本phaseは規則の文書化のみ行う
- Backend: N/A: 個別実装はP05で完了済みであり本phaseは運用手順の文書化のみ行う
- API: N/A: 個別実装はP05で完了済みであり本phaseは運用手順の文書化のみ行う
- Data: N/A: 個別実装はP05で完了済みであり本phaseは運用手順の文書化のみ行う
- Infrastructure: N/A: デプロイ単位への影響なし
- Security: N/A: 権限運用は既存admin RBAC運用手順を継承し新規文書化は行わない。IndexNow鍵のローテーション手順はoperations.mdに記述する
- Quality: N/A: 品質検査はP09/P10で完了済みである
- Documentation: applicable; ui-rules.md/operations.mdそのものが本 phase の成果物である
- Operations: applicable; 新規ブログ/テンプレート/固定ページ追加・IndexNow鍵ローテーション・guideline_references登録の運用手順を確定する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存 src/app/admin/sites 配下画面の新エンティティへの移行はP08が所有する

## 成果物

- Produced artifacts: docs/spec/feat-blog-ui-builder/ui-rules.md (テンプレート/配色2層/表現ブロック/SEO/AI標準ブロック/guideline_references 90日サイクルの規則); docs/spec/feat-blog-ui-builder/operations.md (新規ブログ/テンプレート/固定ページ追加・アフィリエイト配置更新・IndexNow鍵ローテーション・guideline_references登録の運用手順)
- Consumed artifacts: docs/spec/feat-blog-ui-builder/final-review.md, docs/spec/feat-blog-ui-builder/evidence/
- Write scope/touches: docs/spec/feat-blog-ui-builder/ui-rules.md, docs/spec/feat-blog-ui-builder/operations.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-BLOG-UI-BUILDER-P12; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-BLOG-UI-BUILDER-P12; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-BLOG-UI-BUILDER-P12 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-blog-ui-builder 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-blog-ui-builder の scope_out に該当する変更
- 実装コードの変更 (write_scope外)

## テスト戦略

- テストレベル選定: 単体: ユースケース関数・データモデル変換ロジック・JSON-LD生成純関数・IndexNow送信スキップロジック・guideline_references 90日判定ロジックの単体テストを緑化する。結合: 画面からAPI、APIからD1永続化までの結合テストを緑化する。境界値: サイドバー折りたたみ境界・配色上書き解除時のフォールバック・固定ページ未作成時の空状態・axe-core重大違反0件境界・IndexNow鍵未設定時のスキップ境界・guideline_references 90日超境界を緑化する。回帰: 既存 tests/ 配下の全テストスイートを0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/presentation/ui, src/app/api/admin, src/application, src/infrastructure/persistence/d1, src/application/seo) に適用する。
- 層別方針: 本 task は Workstream applicability 上で frontend/backend/infrastructure のいずれも applicable ではないため、対象層別方針は N/A: 個別実装検証は別 phase が所有する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## 完了条件

- ui-rules.md に テンプレート6種の選定基準・配色2層の運用規則・SEO/AI標準ブロックの挿入規則・guideline_references 90日サイクル規則が記述されている
- operations.md に IndexNow鍵のローテーション手順・guideline_references登録手順が記述されている

## 判定項目

- [ ] ui-rules.md が存在し SEO/AI標準ブロック規則・guideline_references 90日サイクル規則を含む
- [ ] operations.md が存在し IndexNow鍵ローテーション手順・guideline_references登録手順を含む
- [ ] `pnpm run lint` が合格する

## Verification and evidence

- Automated commands: `pnpm run lint` (運用手順に記載したscaffoldスクリプト参照が既存ファイルと一致することを確認する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P12 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: テンプレート/配色2層/固定ページ/表現ブロック/SEO/AI標準ブロックのUI規則・guideline_references 90日サイクル規則と、新規テンプレート追加・新規固定ページ種別追加・配置管理運用・IndexNow鍵ローテーション・guideline_references登録の手順が文書化された状態を成立させる。
- Generic execution prompt: feat-blog-ui-builder の goal と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P12 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P12 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P12 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入14件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-blog-ui-builder
- Phase doc: system-plan-phase-names.md#P12
- Dependencies: SYS-BLOG-UI-BUILDER-P10, SYS-BLOG-UI-BUILDER-P11
- source_feature_digest: sha256:8953a167a43f5fc55998ebfcaa83f437d59f0d567cde6e7c15e8b568ab470d7b

## 実行契約

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: current pointer から現行世代を解決する `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` で published task spec と package 全体を再検証する。
