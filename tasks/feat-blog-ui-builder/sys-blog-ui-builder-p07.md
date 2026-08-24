---
artifact_kind: "task"
artifact_subtypes: []
beads_linkage: null
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-blog-ui-builder/sys-blog-ui-builder-p07.md","confidence":1.0}]
classification_confidence: 1.0
classification_reason: "feat-blog-ui-builder の P07 lifecycle 責務への確定写像"
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"linked_pr_merged_all","reconciled_at":null,"source":null,"status":"in_progress"}
confirmation_evidence: {"evaluated_digest":"9a2832f2d6f8656f3495435827399bed84d70c893a027d828694b07b46506fe1","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/feature-package-feat-blog-ui-builder/plan-findings.json"}
confirmation_status: "confirmed"
created_at: "2026-08-24T03:56:57Z"
depends_on: ["SYS-BLOG-UI-BUILDER-P06"]
domain: "quality"
evaluation_status: "pass"
execution_contexts: []
feature_package_id: "feature-package/feat-blog-ui-builder"
file_path: "tasks/feat-blog-ui-builder/sys-blog-ui-builder-p07.md"
github_project_linkages: []
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
graph_node_id: "SYS-BLOG-UI-BUILDER-P07"
implementation_readiness: {"checked_at":"2026-08-24T02:35:00Z","missing_sections":[],"status":"complete"}
issue_linkage: null
iteration: null
owners: ["daishiman"]
parent_feature: "feat-blog-ui-builder"
phase_ref: "P07"
priority: null
project_id: "feature-package-feat-blog-ui-builder"
pull_request_linkages: []
related_nodes: []
resource_scope: ["docs/spec/feat-blog-ui-builder/acceptance-report.md"]
source_lineage: {"imported_at":"2026-08-24T03:56:57Z","origin_kind":"system-dev-planner","source_digest":"9a2832f2d6f8656f3495435827399bed84d70c893a027d828694b07b46506fe1","source_path":".dev-graph/published/feature-package-feat-blog-ui-builder/task-specs/phase-07-acceptance.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
start_date: null
status: "active"
tags: ["p07","feat-blog-ui-builder"]
target_date: null
template_id: "task"
template_version: "1.0.0"
title: "受入9件の受け入れ判定"
tracker_binding: "beads"
updated_at: "2026-08-24T03:56:57Z"
purpose: "feat-blog-ui-builderの受入9件 (A1-A9) すべてについて実物 (pnpm run preview上のWorkersランタイム) での判定が完了し、判定結果と根拠が記録された状態を成立させる。"
goal: "feat-blog-ui-builderの受入9件 (A1-A9) すべてについて実物 (pnpm run preview上のWorkersランタイム) での判定が完了し、判定結果と根拠が記録された状態を成立させる。"
scope_in: ["Produced artifacts: docs/spec/feat-blog-ui-builder/acceptance-report.md (A1-A9の判定結果と根拠)","Consumed artifacts: docs/spec/feat-blog-ui-builder/test-run-report.md, docs/spec/feat-blog-ui-builder/requirements-baseline.md","Write scope/touches: docs/spec/feat-blog-ui-builder/acceptance-report.md"]
scope_out: ["feat-blog-ui-builder の scope_out に該当する変更","判定でFAILとなった場合の実装修正 (write_scope外であり、必要な場合はP05へ差し戻す)"]
acceptance: ["Automated commands: `pnpm run preview` (Workersランタイム, localhost:8787) 上でA1-A9を実物確認する","Automated commands: `pnpm run test:e2e` (E2E受入シナリオを実行する)","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` (本 package の C12 決定論検証を世代非依存に再実行する)","Required evidence: P07 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-two-layer-platform"]
---

# System task overlay: 受入9件の受け入れ判定

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

feat-blog-ui-builderの受入9件 (A1-A9) すべてについて実物 (pnpm run preview上のWorkersランタイム) での判定が完了し、判定結果と根拠が記録された状態を成立させる。

## 背景

P06のテスト緑化はコード上の振る舞いを保証するが、受入条件はブログ作成体験・配色切替の視認性・axe-core検査など実機/実行環境での確認を要するものを含むため、独立した受入判定を行う。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-ui-builder, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P07 upstream entry gate: SYS-BLOG-UI-BUILDER-P06 の implementation_readiness=complete
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; テンプレート差替・配色上書き・stickyレイアウト・表現ブロックの実物判定を行う
- Backend: N/A: 受入判定はUI/UX観点が中心でありAPI単体判定はP06で完了済み
- API: N/A: 受入判定はUI/UX観点が中心でありAPI単体判定はP06で完了済み
- Data: applicable; D1再読み込み後の保持 (A8) を実機で確認する
- Infrastructure: N/A: デプロイ単位への影響なし
- Security: N/A: 権限判定は既存admin RBAC範囲でありP07では扱わない
- Quality: applicable; A1-A9全件の判定完了が本 phase の完了条件である
- Documentation: applicable; acceptance-report.mdが判定結果の証跡文書である
- Operations: N/A: 運用手順はP12が所有する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存 src/app/admin/sites 配下画面の新エンティティへの移行はP08が所有する

## 成果物

- Produced artifacts: docs/spec/feat-blog-ui-builder/acceptance-report.md (A1-A9の判定結果と根拠)
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

- テストレベル選定: 単体: ユースケース関数・データモデル変換ロジックの単体テストを緑化する。結合: 画面からAPI、APIからD1永続化までの結合テストを緑化する。境界値: サイドバー折りたたみ境界・配色上書き解除時のフォールバック・固定ページ未作成時の空状態・axe-core重大違反0件境界を緑化する。回帰: 既存 tests/ 配下の全テストスイートを0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/presentation/ui, src/app/api/admin, src/application, src/infrastructure/persistence/d1) に適用する。
- 層別方針: フロントエンド: behavior ベースでテンプレート選択・配色上書き・sticky折りたたみ・表現ブロック差替の振る舞いを検証する。バックエンド/API/データ: API 契約 + ロジック単体 + DB 結合でCRUDと配置反映を検証する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run preview` (Workersランタイム, localhost:8787) 上でA1-A9を実物確認する
- Automated commands: `pnpm run test:e2e` (E2E受入シナリオを実行する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P07 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: feat-blog-ui-builderの受入9件 (A1-A9) すべてについて実物 (pnpm run preview上のWorkersランタイム) での判定が完了し、判定結果と根拠が記録された状態を成立させる。
- Generic execution prompt: feat-blog-ui-builder の goal (テンプレートから新規ブログを作成でき、配色をブログ既定とページ単位で選べ、ヘッダー・サイドバー・フッターが常時表示され、運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせの固定ページと図解・比較などの表現ブロックを構築でき、公開面/作成/保存/管理一覧の各面でブログ×アフィリエイトの配置が一覧・逆引きできる状態になっている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P07 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P07 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P07 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入9件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-blog-ui-builder
- Phase doc: system-plan-phase-names.md#P07
- Dependencies: SYS-BLOG-UI-BUILDER-P06
