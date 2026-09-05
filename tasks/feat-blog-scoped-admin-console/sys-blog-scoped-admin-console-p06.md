---
graph_node_id: "SYS-BLOG-SCOPED-ADMIN-CONSOLE-P06"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-blog-scoped-admin-console"
domain: "quality"
tags: ["p06","feat-blog-scoped-admin-console"]
priority: null
start_date: null
target_date: null
iteration: null
title: "管理画面のテスト実行と緑化"
owners: ["daishiman"]
created_at: "2026-09-03T23:49:34Z"
updated_at: "2026-09-04T02:49:43.129974Z"
status: "active"
depends_on: ["SYS-BLOG-SCOPED-ADMIN-CONSOLE-P05"]
related_nodes: []
resource_scope: ["tests/","docs/spec/feat-blog-scoped-admin-console/test-run-report.md"]
purpose: "P04 で設計した全テストケースを実行し、失敗0件かつ新規実装コードのカバレッジが80%以上である状態を成立させる。"
goal: "P04 で設計した全テストケースを実行し、失敗0件かつ新規実装コードのカバレッジが80%以上である状態を成立させる。"
scope_in: ["Produced artifacts: docs/spec/feat-blog-scoped-admin-console/test-run-report.md (実行結果とカバレッジ); tests/ 配下の管理画面テスト実装","Consumed artifacts: features/feat-blog-scoped-admin-console.md; features/feat-blog-scoped-admin-console.context.json; system-spec/ui-ux.md; system-spec/frontend.md; docs/spec/feat-uiux-overhaul/ui-rules.md","Write scope/touches: tests/, docs/spec/feat-blog-scoped-admin-console/test-run-report.md"]
scope_out: ["指標の集計処理そのもの (feat-blog-metrics-rollup が所有する)","読者行動の計測と記録 (feat-reader-behavior-analytics が所有する)","SEO/AEO の診断ロジックと配信 (各 feature が所有する)","ドメイン取得と証明書の発行処理 (feat-blog-custom-domain が所有する)","P06 以外の phase が所有する成果物への変更"]
acceptance: ["Automated commands: `pnpm vitest run --coverage` (全テストの緑化とカバレッジ80%以上を確認する)","Automated commands: `pnpm run typecheck` (テスト実装を含めた型整合を確認する)","Required evidence: P06 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform","arch-blog-operations-console"]
parent_feature: "feat-blog-scoped-admin-console"
feature_package_id: "feature-package/feat-blog-scoped-admin-console"
phase_ref: "P06"
file_path: "tasks/feat-blog-scoped-admin-console/sys-blog-scoped-admin-console-p06.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"853e62dd85ae447de546d96eaf3e412e863d1b488e14a378074ff490e46edb32","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-blog-scoped-admin-console/853e62dd85ae447de546d96eaf3e412e863d1b488e14a378074ff490e46edb32/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-03T23:49:34Z","origin_kind":"system-dev-planner","source_digest":"853e62dd85ae447de546d96eaf3e412e863d1b488e14a378074ff490e46edb32","source_path":".dev-graph/published/generations/feature-package-feat-blog-scoped-admin-console/853e62dd85ae447de546d96eaf3e412e863d1b488e14a378074ff490e46edb32/task-specs/phase-06-test-run.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-blog-scoped-admin-console の P06 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-blog-scoped-admin-console/sys-blog-scoped-admin-console-p06.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-wois.6","github_mirror":null,"linked_at":"2026-09-04T02:10:24Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T00:00:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: 管理画面のテスト実行と緑化

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-scoped-admin-console
- owners: ["daishiman"]
- tags: ["p06", "feat-blog-scoped-admin-console"]
- related_nodes: []
- parent_feature: feat-blog-scoped-admin-console
- phase_ref: P06
- classification: confidence=1.0; reason=feat-blog-scoped-admin-console の P06 lifecycle 責務への確定写像; candidate=tasks/feat-blog-scoped-admin-console/sys-blog-scoped-admin-console-p06.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04 で設計した全テストケースを実行し、失敗0件かつ新規実装コードのカバレッジが80%以上である状態を成立させる。

## 背景

画面は分岐が多く、空状態と異常状態のケースが抜けやすい。全ケース実行で抜けを見つける。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-scoped-admin-console, system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/security.md, architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: parent_feature.depends_on all done|closed (P01 claim 時に canonical dev-graph の parent feature が持つ depends_on 全件を都度読み、done|closed のときだけ通す派生 gate。upstream ID を task DAG へ複製しない)
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; ブログ階層の画面構成と情報の並べ方を扱う
- Backend: applicable; 画面が必要とする読み取り経路の集約を扱う
- API: applicable; 管理画面向け読み取り API の整理を扱う
- Data: N/A: 本 feature は新規テーブルを持たず既存の集計結果を読むだけである
- Infrastructure: N/A: 既存 Workers デプロイ単位を変更しない
- Security: applicable; ブログ横断画面での閲覧範囲の限定を扱う
- Quality: applicable; 導線の欠落と情報の重複配置を検証する
- Documentation: applicable; 画面の役割分担と読み方の説明を扱う
- Operations: applicable; 既存導線からの移行手順を扱う

## Architecture and deploy unit

- Architecture decisions: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存資産との重複解消と移行は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-blog-scoped-admin-console/test-run-report.md (実行結果とカバレッジ); tests/ 配下の管理画面テスト実装
- Consumed artifacts: features/feat-blog-scoped-admin-console.md; features/feat-blog-scoped-admin-console.context.json; system-spec/ui-ux.md; system-spec/frontend.md; docs/spec/feat-uiux-overhaul/ui-rules.md
- Write scope/touches: tests/, docs/spec/feat-blog-scoped-admin-console/test-run-report.md

## Tracker publication and completion

> 本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-BLOG-SCOPED-ADMIN-CONSOLE-P06; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-BLOG-SCOPED-ADMIN-CONSOLE-P06; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-BLOG-SCOPED-ADMIN-CONSOLE-P06 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-blog-scoped-admin-console 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- 指標の集計処理そのもの (feat-blog-metrics-rollup が所有する)
- 読者行動の計測と記録 (feat-reader-behavior-analytics が所有する)
- SEO/AEO の診断ロジックと配信 (各 feature が所有する)
- ドメイン取得と証明書の発行処理 (feat-blog-custom-domain が所有する)
- P06 以外の phase が所有する成果物への変更

## テスト戦略

- テストレベル選定: P04 のケース表を全件実行し、失敗したケースは実装 phase へ差し戻す。カバレッジ不足は追加ケースで埋める。 N/A: 単体・結合・境界値・回帰 の各テストレベルは、本 task の成果物が文書と判定であり実行可能なコードを含まないため適用しない。
- カバレッジ目標: 既定 80% を新規実装コード (src/app/admin, src/components/admin) に適用する。
- 層別方針: フロントエンドは可視ラベルとアクセシブル名による behavior 検証、バックエンド/API/データは API 契約テストとロジック単体テストと DB 結合テスト (D1) で検証、インフラは IaC 静的検証とデプロイ後の smoke 検証で確認する。
- 保守性制約: pixel 位置依存・DOM 構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm vitest run --coverage` (全テストの緑化とカバレッジ80%以上を確認する)
- Automated commands: `pnpm run typecheck` (テスト実装を含めた型整合を確認する)
- Required evidence: P06 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: P04 で設計した全テストケースを実行し、失敗0件かつ新規実装コードのカバレッジが80%以上である状態を成立させる。
- Generic execution prompt: feat-blog-scoped-admin-console の goal (管理画面が記事単位ではなくブログ単位の階層で構成され、ブログごとの収益・PV・転換・住所の生死が一枚で読め、記事ごとの改善指示と横断比較が役割どおりに分かれ、既存 /admin/blog/* からの導線が失われていない状態になっている) と本 task の 前提条件/成果物/write scope/スコープ外 を渡し、実装手段は固定せず P06 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件・カバレッジ目標 green・既存テストの回帰0件・Required evidence の証跡取得・write scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10 相当) へ渡し、finding を Generic execution prompt へ反映して再実行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P06 の成果物を write scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P06 の write scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 全テストが緑でカバレッジ目標を満たし、受入判定へ進める

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/security.md
- Architecture: architecture/arch-system-spec-overview.md, architecture/arch-two-layer-platform.md, architecture/arch-blog-operations-console.md
- Feature: feat-blog-scoped-admin-console
- Phase doc: system-plan-phase-names.md#P06
- Dependencies: SYS-BLOG-SCOPED-ADMIN-CONSOLE-P05
