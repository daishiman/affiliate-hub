---
graph_node_id: "SYS-BLOG-UI-BUILDER-P07"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-blog-ui-builder"
domain: "quality"
tags: ["p07","feat-blog-ui-builder"]
priority: null
start_date: null
target_date: null
iteration: null
title: "受入14件の受け入れ判定"
owners: ["daishiman"]
created_at: "2026-08-28T13:02:37Z"
updated_at: "2026-08-30T08:51:18Z"
status: "closed"
depends_on: ["SYS-BLOG-UI-BUILDER-P06"]
related_nodes: []
resource_scope: ["docs/spec/feat-blog-ui-builder/acceptance-report.md"]
purpose: "feat-blog-ui-builderの受入14件 (A1-A14) すべてについて実物 (pnpm run preview上のWorkersランタイム) での判定が完了し、判定結果と根拠が記録された状態を成立させる。A10-A14 (SEO/AI検索) については HTML ソースの確認・sitemap/robots/llms.txt の内容確認・IndexNow送信スキップログの確認・guideline_references管理画面の90日表示確認を含む。"
goal: "feat-blog-ui-builderの受入14件 (A1-A14) すべてについて実物 (pnpm run preview上のWorkersランタイム) での判定が完了し、判定結果と根拠が記録された状態を成立させる。A10-A14 (SEO/AI検索) については HTML ソースの確認・sitemap/robots/llms.txt の内容確認・IndexNow送信スキップログの確認・guideline_references管理画面の90日表示確認を含む。"
scope_in: ["Produced artifacts: docs/spec/feat-blog-ui-builder/acceptance-report.md (A1-A14の判定結果と根拠)","Consumed artifacts: docs/spec/feat-blog-ui-builder/test-run-report.md, docs/spec/feat-blog-ui-builder/requirements-baseline.md","Write scope/touches: docs/spec/feat-blog-ui-builder/acceptance-report.md"]
scope_out: ["feat-blog-ui-builder の scope_out に該当する変更","判定でFAILとなった場合の実装修正 (write_scope外であり、必要な場合はP05へ差し戻す)"]
acceptance: ["Automated commands: `pnpm run preview` (Workersランタイム, localhost:8787) 上でA1-A14を実物確認する","Automated commands: `pnpm run test:e2e` (E2E受入シナリオを実行する)","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` (本 package の C12 決定論検証を世代非依存に再実行する)","Required evidence: P07 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-two-layer-platform"]
parent_feature: "feat-blog-ui-builder"
feature_package_id: "feature-package/feat-blog-ui-builder"
phase_ref: "P07"
file_path: "tasks/feat-blog-ui-builder/sys-blog-ui-builder-p07.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-blog-ui-builder/168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48/plan-findings.json"}
source_lineage: {"imported_at":"2026-08-28T13:02:37Z","origin_kind":"system-dev-planner","source_digest":"168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48","source_path":".dev-graph/published/generations/feature-package-feat-blog-ui-builder/168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48/task-specs/phase-07-acceptance.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1
classification_reason: "feat-blog-ui-builder の P07 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-blog-ui-builder/sys-blog-ui-builder-p07.md","confidence":1}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-45ba.7","github_mirror":null,"linked_at":"2026-08-28T13:02:37Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-28T00:00:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: 受入14件の受け入れ判定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-ui-builder
- owners: ["daishiman"]
- tags: ["p07", "feat-blog-ui-builder"]
- related_nodes: []
- parent_feature: feat-blog-ui-builder
- phase_ref: P07
- classification: confidence=1.0; reason=feat-blog-ui-builder の P07 lifecycle 責務への確定写像; candidate=tasks/feat-blog-ui-builder/sys-blog-ui-builder-p07.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

feat-blog-ui-builderの受入14件 (A1-A14) すべてについて実物 (pnpm run preview上のWorkersランタイム) での判定が完了し、判定結果と根拠が記録された状態を成立させる。A10-A14 (SEO/AI検索) については HTML ソースの確認・sitemap/robots/llms.txt の内容確認・IndexNow送信スキップログの確認・guideline_references管理画面の90日表示確認を含む。

## 背景

P06のテスト緑化はコード上の振る舞いを保証するが、受入条件はブログ作成体験・配色切替の視認性・axe-core検査・HTML/JSON-LD出力など実機/実行環境での確認を要するものを含むため、独立した受入判定を行う。A10 (JSON-LD/canonical/OGP SSR) はViewSourceで本文がサーバー側に含まれることを確認する。A11 (sitemap/robots/feed/llms.txt) はURLへの直接アクセスで内容を確認する。A13 (IndexNow鍵) は鍵未設定時のスキップログを確認する。A14 (guideline_references 90日) は管理画面で90日超の行が再確認対象として表示されることを確認する。source_feature_digest: sha256:8953a167a43f5fc55998ebfcaa83f437d59f0d567cde6e7c15e8b568ab470d7b

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-ui-builder, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P07 upstream entry gate: SYS-BLOG-UI-BUILDER-P06 の implementation_readiness=complete
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; テンプレート差替・配色上書き・stickyレイアウト・表現ブロック・SEO/AI標準ブロック・JSON-LD/OGP出力の実物判定を行う
- Backend: N/A: 受入判定はUI/UX観点が中心でありAPI単体判定はP06で完了済み
- API: N/A: 受入判定はUI/UX観点が中心でありAPI単体判定はP06で完了済み
- Data: applicable; D1再読み込み後の保持 (A8) と guideline_references 90日再確認表示 (A14) を実機で確認する
- Infrastructure: N/A: デプロイ単位への影響なし
- Security: applicable; IndexNow鍵の環境変数分離 (A13) をスキップログで確認する
- Quality: applicable; A1-A14全14件の判定完了が本 phase の完了条件である
- Documentation: applicable; acceptance-report.mdが判定結果の証跡文書である
- Operations: N/A: 運用手順はP12が所有する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存 src/app/admin/sites 配下画面の新エンティティへの移行はP08が所有する

## 成果物

- Produced artifacts: docs/spec/feat-blog-ui-builder/acceptance-report.md (A1-A14の判定結果と根拠)
- Consumed artifacts: docs/spec/feat-blog-ui-builder/test-run-report.md, docs/spec/feat-blog-ui-builder/requirements-baseline.md
- Write scope/touches: docs/spec/feat-blog-ui-builder/acceptance-report.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-BLOG-UI-BUILDER-P07; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-BLOG-UI-BUILDER-P07; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-BLOG-UI-BUILDER-P07 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-blog-ui-builder 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-blog-ui-builder の scope_out に該当する変更
- 判定でFAILとなった場合の実装修正 (write_scope外であり、必要な場合はP05へ差し戻す)

## テスト戦略

- テストレベル選定: 単体: ユースケース関数・データモデル変換ロジック・JSON-LD生成純関数の単体テストを緑化する。結合: 画面からAPI、APIからD1永続化までの結合テストを緑化する。境界値: サイドバー折りたたみ境界・配色上書き解除時のフォールバック・固定ページ未作成時の空状態・axe-core重大違反0件境界・IndexNow鍵未設定時のスキップ境界・guideline_references 90日超境界を緑化する。回帰: 既存 tests/ 配下の全テストスイートを0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/presentation/ui, src/app/api/admin, src/application, src/infrastructure/persistence/d1, src/application/seo) に適用する。
- 層別方針: フロントエンド: behavior ベースでテンプレート選択・配色上書き・sticky折りたたみ・表現ブロック差替・SEO/AI標準ブロック挿入の振る舞いを検証する。バックエンド/API/データ: API 契約 + ロジック単体 + DB 結合でCRUDと配置反映・JSON-LD生成・IndexNow送信スキップ・guideline_references 90日境界を検証する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## 完了条件

- acceptance-report.md に A1-A14 の14件の PASS/FAIL 判定と根拠が記録されている

## 判定項目

- [ ] A1-A9 (UI/UX) の実物判定が PASS である
- [ ] A10 (JSON-LD/canonical/OGP SSR) の HTML ソース確認が PASS である
- [ ] A11 (sitemap/robots/feed/llms.txt) の URL アクセス確認が PASS である (robots.txt が AI クローラを遮断しない)
- [ ] A12 (SEO/AI標準ブロック・dateModified) の実物確認が PASS である
- [ ] A13 (IndexNow 鍵スキップ) のログ確認が PASS である
- [ ] A14 (guideline_references 90日表示) の管理画面確認が PASS である
- [ ] acceptance-report.md が存在する

## Verification and evidence

- Automated commands: `pnpm run preview` (Workersランタイム, localhost:8787) 上でA1-A14を実物確認する
- Automated commands: `pnpm run test:e2e` (E2E受入シナリオを実行する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P07 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: feat-blog-ui-builderの受入14件 (A1-A14) すべてについて実物 (pnpm run preview上のWorkersランタイム) での判定が完了し、判定結果と根拠が記録された状態を成立させる。
- Generic execution prompt: feat-blog-ui-builder の goal と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P07 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P07 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P07 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入14件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-blog-ui-builder
- Phase doc: system-plan-phase-names.md#P07
- Dependencies: SYS-BLOG-UI-BUILDER-P06
- source_feature_digest: sha256:8953a167a43f5fc55998ebfcaa83f437d59f0d567cde6e7c15e8b568ab470d7b

## 実行契約

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: current pointer から現行世代を解決する `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` で published task spec と package 全体を再検証する。
