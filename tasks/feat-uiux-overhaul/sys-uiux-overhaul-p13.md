---
artifact_kind: "task"
artifact_subtypes: []
beads_linkage: "ah-qzk"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-uiux-overhaul/sys-uiux-overhaul-p13.md","confidence":1.0}]
classification_confidence: 1.0
classification_reason: "feat-uiux-overhaul の P13 lifecycle 責務への確定写像"
completion_evidence: {"completed_at":null,"evidence_refs":["docs/spec/feat-uiux-overhaul/release-report.md","docs/spec/feat-uiux-overhaul/spec-writeback-receipt.md","docs/spec/feat-uiux-overhaul/evidence/10-final-review-gates-20260823.txt"],"policy":"linked_pr_merged_all","reconciled_at":null,"source":"final-review-20260823","status":"pending_pr"}
confirmation_evidence: {"evaluated_digest":"3c9e340b6675b9d0b51c5a8b14331885611cb6e7f9129f16eb853231a3a7fbf0","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/feature-package-feat-uiux-overhaul/plan-findings.json"}
confirmation_status: "confirmed"
created_at: "2026-08-21T12:39:22Z"
depends_on: ["SYS-UIUX-OVERHAUL-P12"]
domain: "operations"
evaluation_status: "pass"
execution_contexts: []
feature_package_id: "feature-package/feat-uiux-overhaul"
file_path: "tasks/feat-uiux-overhaul/sys-uiux-overhaul-p13.md"
github_project_linkages: []
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
graph_node_id: "SYS-UIUX-OVERHAUL-P13"
implementation_readiness: {"checked_at":"2026-08-21T12:40:00Z","missing_sections":[],"status":"complete"}
issue_linkage: null
iteration: null
owners: ["daishiman"]
parent_feature: "feat-uiux-overhaul"
phase_ref: "P13"
priority: null
project_id: "feature-package-feat-uiux-overhaul"
pull_request_linkages: [{"number":23,"url":"https://github.com/daishiman/affiliate-hub/pull/23","base":"dev","head":"devgraph/feat-uiux-overhaul","draft":true}]
related_nodes: []
resource_scope: ["docs/spec/feat-uiux-overhaul/release-report.md","system-spec/ui-ux.md","system-spec/frontend.md"]
source_lineage: {"imported_at":"2026-08-21T12:39:22Z","origin_kind":"system-dev-planner","source_digest":"3c9e340b6675b9d0b51c5a8b14331885611cb6e7f9129f16eb853231a3a7fbf0","source_path":".dev-graph/published/feature-package-feat-uiux-overhaul/task-specs/phase-13-release-deploy.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
start_date: null
status: "active"
tags: ["p13","feat-uiux-overhaul"]
target_date: null
template_id: "task"
template_version: "1.0.0"
title: "リリースと仕様への書き戻し"
tracker_binding: "beads"
updated_at: "2026-08-23T12:00:00Z"
purpose: "本 feature の成果を開発環境へ反映し、実装で確定した UI 規則とコンポーネント契約をsystem-spec へ書き戻した状態を成立させる。"
goal: "本 feature の成果を開発環境へ反映し、実装で確定した UI 規則とコンポーネント契約をsystem-spec へ書き戻した状態を成立させる。"
scope_in: ["Produced artifacts: docs/spec/feat-uiux-overhaul/release-report.md (反映内容・確認結果), system-spec/ui-ux.md と system-spec/frontend.md (実装で確定した規則の書き戻し))","Consumed artifacts: docs/spec/feat-uiux-overhaul/ui-rules.md, docs/spec/feat-uiux-overhaul/operations.md","Write scope/touches: docs/spec/feat-uiux-overhaul/release-report.md, system-spec/ui-ux.md, system-spec/frontend.md"]
scope_out: ["feat-uiux-overhaul の scope_out (認証・Workspace基盤, 記事生成エンジン本体, SNS実配信の実行系, 文章品質規則そのもの, 読者向け公開面) に該当する変更","write_scope 外のパスへの変更"]
acceptance: ["Automated commands: `pnpm run preview` (Workers ランタイム, localhost:8787) 上で P13 に対応する検証コマンドを実行する","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-uiux-overhaul` (本 package の C12 決定論検証を世代非依存に再実行する)","Required evidence: P13 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-two-layer-platform"]
---

# System task overlay: リリースと仕様への書き戻し

## Machine-readable registration fields

- feature_package_id: feature-package/feat-uiux-overhaul
- owners: ["daishiman"]
- tags: ["p13", "feat-uiux-overhaul"]
- related_nodes: []
- parent_feature: feat-uiux-overhaul
- phase_ref: P13
- classification: confidence=1.0; reason=feat-uiux-overhaul の P13 lifecycle 責務への確定写像; candidate=tasks/feat-uiux-overhaul/sys-uiux-overhaul-p13.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

本 feature の成果を開発環境へ反映し、実装で確定した UI 規則とコンポーネント契約をsystem-spec へ書き戻した状態を成立させる。

## 背景

実装で確定した規則を仕様へ戻さないと、次の feature が古い仕様を根拠に作業して乖離が広がる。枝の順番の規約に従い、作業ブランチから dev へ出す。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-uiux-overhaul, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: N/A: intra-feature depends_on gate
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 反映後の画面が期待どおり動作することを確認する
- Backend: applicable; 反映後の API が期待どおり応答することを確認する
- API: applicable; 反映後の API 契約を確認する
- Data: applicable; 反映後のデータ参照を確認する
- Infrastructure: applicable; 既存 Cloudflare Workers/D1/R2 デプロイ単位へ反映する
- Security: applicable; 反映後の権限判定を確認する
- Quality: applicable; 反映後の回帰0件を確認する
- Documentation: applicable; system-spec への書き戻しを行う
- Operations: applicable; 反映手順の実行が本 phase の責務である

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存管理画面の共通部品への移行は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-uiux-overhaul/release-report.md (反映内容・確認結果), system-spec/ui-ux.md と system-spec/frontend.md (実装で確定した規則の書き戻し))
- Consumed artifacts: docs/spec/feat-uiux-overhaul/ui-rules.md, docs/spec/feat-uiux-overhaul/operations.md
- Write scope/touches: docs/spec/feat-uiux-overhaul/release-report.md, system-spec/ui-ux.md, system-spec/frontend.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-UIUX-OVERHAUL-P13; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-UIUX-OVERHAUL-P13; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-UIUX-OVERHAUL-P13 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on=['P12'] の完了 + resource_scope (feat-uiux-overhaul 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-uiux-overhaul の scope_out (認証・Workspace基盤, 記事生成エンジン本体, SNS実配信の実行系, 文章品質規則そのもの, 読者向け公開面) に該当する変更
- write_scope 外のパスへの変更

## テスト戦略

- テストレベル選定: 単体: 共通コンポーネントとユースケース関数の単体テストを緑化する。結合: 画面からAPI、APIからデータ参照までの結合テストを緑化する。境界値: サイドバー折りたたみ時の識別性・空一覧・権限なしロールの境界テストを緑化する。回帰: 既存テストスイートを0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/presentation/ui, src/app/api/admin, src/application) に適用する。
- 層別方針: フロントエンド: behavior ベースでサイドバー開閉・画面遷移・情報表示の振る舞いを検証する。バックエンド/API/データ: API 契約 + ロジック単体 + データ参照結合で CRUD と投稿状態反映を検証する。
- 保守性制約: pixel 位置依存・DOM 構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run preview` (Workers ランタイム, localhost:8787) 上で P13 に対応する検証コマンドを実行する
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-uiux-overhaul` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P13 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: 本 feature の成果を開発環境へ反映し、実装で確定した UI 規則とコンポーネント契約をsystem-spec へ書き戻した状態を成立させる。
- Generic execution prompt: feat-uiux-overhaul の goal (全画面が単一用途に分割され、管理対象に基本管理機能(一覧・新規作成・編集・削除)とそのAPIが揃い、カード間隔・文章量・サイドバーが最適化され、各サイト・SNSへの投稿状態が画面へ反映され、1商品から複数ブログへコンセプト別文章を作成でき、X/Facebook等の新SNSをプロバイダ追加のみで拡張できる構成になっている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P13 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止しP01から現phaseへ差し戻す
- P13 spec/architecture writeback: 実装で確定した UI 規則とコンポーネント契約を system-spec/ui-ux.md と system-spec/frontend.md へ書き戻す

## Rollout and rollback

- Rollout: P13 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P13 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入10件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-uiux-overhaul
- Phase doc: system-plan-phase-names.md#P13
- Dependencies: SYS-UIUX-OVERHAUL-P12

## 実行契約

- source spec: `.dev-graph/published/feature-package-feat-uiux-overhaul/task-specs/phase-13-release-deploy.md` (昇格済み generation 本文を byte-for-byte 引用)
- verification: 上記 task spec の Automated commands
- rerun: `python3 "${PLUGIN_ROOT}/scripts/validate-system-plan.py" --repo-root . --staging .dev-graph/published/feature-package-feat-uiux-overhaul` で世代非依存に C12 を再実行する
- promoted digest: 3c9e340b6675b9d0b51c5a8b14331885611cb6e7f9129f16eb853231a3a7fbf0
