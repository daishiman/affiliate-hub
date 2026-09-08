---
graph_node_id: "SYS-SEO-AEO-GAP-CLOSURE-P04"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-seo-aeo-gap-closure"
domain: "quality"
tags: ["p04","feat-seo-aeo-gap-closure"]
priority: null
start_date: null
target_date: null
iteration: null
title: "受入6件に対応するテスト設計"
owners: ["daishiman"]
created_at: "2026-09-04T02:37:00Z"
updated_at: "2026-09-04T04:24:35.318379Z"
status: "active"
depends_on: ["SYS-SEO-AEO-GAP-CLOSURE-P03"]
related_nodes: []
resource_scope: ["docs/spec/feat-seo-aeo-gap-closure/test-design.md"]
purpose: "A1-A6 を、実装より先に落とせるテストとして設計する。とくに A6 (既存の挙動が変わらない) は回帰の形でしか確かめられないため、既存 tests/ のどのスイートを不変の証拠として使うかをここで固定する。"
goal: "A1-A6 を、実装より先に落とせるテストとして設計する。とくに A6 (既存の挙動が変わらない) は回帰の形でしか確かめられないため、既存 tests/ のどのスイートを不変の証拠として使うかをここで固定する。"
scope_in: ["Produced artifacts: docs/spec/feat-seo-aeo-gap-closure/test-design.md (A1-A6 とテストケースの対応表・層別割り当て・回帰スイートの指定)","Consumed artifacts: docs/spec/feat-seo-aeo-gap-closure/design-review.md, docs/spec/feat-seo-aeo-gap-closure/architecture.md, docs/spec/feat-seo-aeo-gap-closure/data-model.md, tests/application, tests/domain, tests/integration","Write scope/touches: docs/spec/feat-seo-aeo-gap-closure/test-design.md"]
scope_out: ["feat-seo-aeo-gap-closure の scope_out (実装済みの JSON-LD 導出本体・llms.txt・IndexNow・sitemap・RSS・ガイドライン出典レジストリ・公開時点検の判定ロジック・記事本文の AI 生成・クリック成果のアトリビューション・管理画面の単一用途画面再編・参考ブログ水準の読者導線) に該当する変更","参考ブログの文章・素材・デザインの複製"]
acceptance: ["Automated commands: `pnpm vitest run --reporter=dot` (既存スイートが現時点で緑であることを回帰の基準線として記録する)","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-seo-aeo-gap-closure` (本 package の C12 決定論検証を世代非依存に再実行する)","Required evidence: P04 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: "feat-seo-aeo-gap-closure"
feature_package_id: "feature-package/feat-seo-aeo-gap-closure"
phase_ref: "P04"
file_path: "tasks/feat-seo-aeo-gap-closure/sys-seo-aeo-gap-closure-p04.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"2689733e08bc4e992eabe2e406ecea05433ae3d5312cc7e8e60876b0a3798298","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-seo-aeo-gap-closure/2689733e08bc4e992eabe2e406ecea05433ae3d5312cc7e8e60876b0a3798298/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-04T02:37:00Z","origin_kind":"system-dev-planner","source_digest":"2689733e08bc4e992eabe2e406ecea05433ae3d5312cc7e8e60876b0a3798298","source_path":".dev-graph/published/generations/feature-package-feat-seo-aeo-gap-closure/2689733e08bc4e992eabe2e406ecea05433ae3d5312cc7e8e60876b0a3798298/task-specs/phase-04-test-design.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-seo-aeo-gap-closure の P04 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-seo-aeo-gap-closure/sys-seo-aeo-gap-closure-p04.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-f60p.4","github_mirror":null,"linked_at":"2026-09-04T04:00:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T02:17:16Z","missing_sections":[],"status":"complete"}
---

# System task overlay: 受入6件に対応するテスト設計

## Machine-readable registration fields

- feature_package_id: feature-package/feat-seo-aeo-gap-closure
- owners: ["daishiman"]
- tags: ["p04", "feat-seo-aeo-gap-closure"]
- related_nodes: []
- parent_feature: feat-seo-aeo-gap-closure
- phase_ref: P04
- classification: confidence=1.0; reason=feat-seo-aeo-gap-closure の P04 lifecycle 責務への確定写像; candidate=tasks/feat-seo-aeo-gap-closure/sys-seo-aeo-gap-closure-p04.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

A1-A6 を、実装より先に落とせるテストとして設計する。とくに A6 (既存の挙動が変わらない) は回帰の形でしか確かめられないため、既存 tests/ のどのスイートを不変の証拠として使うかをここで固定する。

## 背景

auditArticleForAiSearch は純関数で、structured-data.ts の builder 群も入力から出力を作るだけである。この形は単体で境界を突きやすい。逆に履歴の保持窓と scheduled の再点検は永続化と時刻に依存するため、結合の層で確かめる必要がある。層の割り当てを設計で決めておく。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-seo-aeo-gap-closure, system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/backend.md, system-spec/frontend.md, system-spec/ui-ux.md, system-spec/database.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 管理画面一覧の振る舞い検証の観点を決める
- Backend: applicable; usecase と repository の結合テストの境界を決める
- API: N/A: API 契約設計は P02 が所有する
- Data: N/A: 永続化スキーマは P02 が設計し P05 が実装する
- Infrastructure: N/A: 既存 cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2) のデプロイ単位を変更しない
- Security: N/A: 権限要求は既存 admin RBAC の範囲を超えない
- Quality: applicable; テスト設計そのものが本 phase の成果物である
- Documentation: applicable; 本 phase の成果物は write_scope 内の文書である
- Operations: N/A: 運用手順は P12 が所有する

## Architecture and deploy unit

- Architecture decisions: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/backend.md, system-spec/frontend.md, system-spec/ui-ux.md, system-spec/database.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存 SEO 実装と追加マイグレーションの互換確認は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-seo-aeo-gap-closure/test-design.md (A1-A6 とテストケースの対応表・層別割り当て・回帰スイートの指定)
- Consumed artifacts: docs/spec/feat-seo-aeo-gap-closure/design-review.md, docs/spec/feat-seo-aeo-gap-closure/architecture.md, docs/spec/feat-seo-aeo-gap-closure/data-model.md, tests/application, tests/domain, tests/integration
- Write scope/touches: docs/spec/feat-seo-aeo-gap-closure/test-design.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-SEO-AEO-GAP-CLOSURE-P04; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-SEO-AEO-GAP-CLOSURE-P04; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-SEO-AEO-GAP-CLOSURE-P04 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (src, drizzle, tests, worker-entry.js, docs/spec, system-spec) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-seo-aeo-gap-closure の scope_out (実装済みの JSON-LD 導出本体・llms.txt・IndexNow・sitemap・RSS・ガイドライン出典レジストリ・公開時点検の判定ロジック・記事本文の AI 生成・クリック成果のアトリビューション・管理画面の単一用途画面再編・参考ブログ水準の読者導線) に該当する変更
- 参考ブログの文章・素材・デザインの複製

## テスト戦略

- テストレベル選定: 単体: JSON-LD 導出関数と点検判定の純関数を入力から出力で検証する。結合: 公開処理から点検履歴の永続化まで、および定期再点検から履歴追記までを検証する。境界値: 手順ブロック 0 件・保持窓ちょうど・保持窓超過・履歴が空の公開済み記事・再点検で新たに落ちた記事を検証する。回帰: 既存 tests/ 配下の全スイートを 0 件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/application/seo, src/application/usecases, src/infrastructure/persistence/d1, src/app/admin) に適用する。
- 層別方針: フロントエンド: 管理画面一覧の behavior を可視ラベルとアクセシブル名で検証するケースを設計する。バックエンド: API 契約 の単体と DB 結合 の結合で、履歴の追記・保持窓ちょうど・保持窓超過の各境界を検証するケースを設計する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm vitest run --reporter=dot` (既存スイートが現時点で緑であることを回帰の基準線として記録する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-seo-aeo-gap-closure` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P04 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: A1-A6 を、実装より先に落とせるテストとして設計する。とくに A6 (既存の挙動が変わらない) は回帰の形でしか確かめられないため、既存 tests/ のどのスイートを不変の証拠として使うかをここで固定する。
- Generic execution prompt: feat-seo-aeo-gap-closure の goal (手順記事と読み上げ向けの構造化データが記事から導出され、公開時点検の結果が履歴として残り、公開後の記事も定期に再点検されて陳腐化に気づける状態になっている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P04 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P04 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P04 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入6件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/backend.md, system-spec/frontend.md, system-spec/ui-ux.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-seo-aeo-gap-closure
- Phase doc: system-plan-phase-names.md#P04
- Dependencies: SYS-SEO-AEO-GAP-CLOSURE-P03
