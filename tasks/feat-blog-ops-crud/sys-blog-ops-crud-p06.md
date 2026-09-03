---
artifact_kind: "task"
artifact_subtypes: []
beads_linkage: null
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-blog-ops-crud/sys-blog-ops-crud-p06.md","confidence":1.0}]
classification_confidence: 1.0
classification_reason: "feat-blog-ops-crud の P06 lifecycle 責務への確定写像"
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"linked_pr_merged_all","reconciled_at":null,"source":null,"status":"in_progress"}
confirmation_evidence: {"evaluated_digest":"aa09bccf2924ffc24a1126c1fdf25935bb41f4bdd1f869d2934519d2fcdff635","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-blog-ops-crud/aa09bccf2924ffc24a1126c1fdf25935bb41f4bdd1f869d2934519d2fcdff635/plan-findings.json"}
confirmation_status: "confirmed"
created_at: "2026-08-25T14:00:26Z"
depends_on: ["SYS-BLOG-OPS-CRUD-P05"]
domain: "quality"
evaluation_status: "pass"
execution_contexts: []
feature_package_id: "feature-package/feat-blog-ops-crud"
file_path: "tasks/feat-blog-ops-crud/sys-blog-ops-crud-p06.md"
github_project_linkages: []
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
graph_node_id: "SYS-BLOG-OPS-CRUD-P06"
implementation_readiness: {"checked_at":"2026-08-25T13:19:00Z","missing_sections":[],"status":"complete"}
issue_linkage: null
iteration: null
owners: ["daishiman"]
parent_feature: "feat-blog-ops-crud"
phase_ref: "P06"
priority: null
project_id: "feature-package-feat-blog-ops-crud"
pull_request_linkages: []
related_nodes: []
resource_scope: ["docs/spec/feat-blog-ops-crud/test-run-report.md"]
source_lineage: {"imported_at":"2026-08-25T14:00:26Z","origin_kind":"system-dev-planner","source_digest":"aa09bccf2924ffc24a1126c1fdf25935bb41f4bdd1f869d2934519d2fcdff635","source_path":".dev-graph/published/generations/feature-package-feat-blog-ops-crud/aa09bccf2924ffc24a1126c1fdf25935bb41f4bdd1f869d2934519d2fcdff635/task-specs/phase-06-test-run.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
start_date: null
status: "active"
tags: ["p06","feat-blog-ops-crud"]
target_date: null
template_id: "task"
template_version: "1.1.0"
title: "実装のテスト実行と緑化"
tracker_binding: "beads"
updated_at: "2026-08-25T14:00:26Z"
purpose: "P04で設計した単体/結合/境界値/回帰テストと転用禁止grepゲートが全件緑化し、失敗0件の実行結果がtest-run-report.mdに記録された状態を成立させる。"
goal: "P04で設計した単体/結合/境界値/回帰テストと転用禁止grepゲートが全件緑化し、失敗0件の実行結果がtest-run-report.mdに記録された状態を成立させる。"
scope_in: ["Produced artifacts: docs/spec/feat-blog-ops-crud/test-run-report.md (単体/結合/境界値/回帰テストと転用禁止grepゲートの実行結果)","Consumed artifacts: docs/spec/feat-blog-ops-crud/test-design.md, src/","Write scope/touches: docs/spec/feat-blog-ops-crud/test-run-report.md"]
scope_out: ["feat-blog-ops-crud の scope_out に該当する変更","テスト設計の変更 (P04が所有する)、実装の変更 (P05が所有する)"]
acceptance: ["Automated commands: `pnpm test` (単体/結合/境界値テストを実行する)","Automated commands: `pnpm run test:coverage` (カバレッジ目標80%の充足を確認する)","Automated commands: `node scripts/check-reference-site-reuse.mjs` (転用禁止grepゲートを実行する)","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ops-crud` (本 package の C12 決定論検証を世代非依存に再実行する)","Required evidence: docs/spec/feat-blog-ops-crud/test-run-report.md のパス"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
---

# System task overlay: 実装のテスト実行と緑化

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-ops-crud
- owners: ["daishiman"]
- tags: ["p06", "feat-blog-ops-crud"]
- related_nodes: []
- parent_feature: feat-blog-ops-crud
- phase_ref: P06
- classification: confidence=1.0; reason=feat-blog-ops-crud の P06 lifecycle 責務への確定写像; candidate=tasks/feat-blog-ops-crud/sys-blog-ops-crud-p06.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04で設計した単体/結合/境界値/回帰テストと転用禁止grepゲートが全件緑化し、失敗0件の実行結果がtest-run-report.mdに記録された状態を成立させる。

## 背景

P05実装後、P04のtest-design.mdに対応する実際のテストコードを実行し、緑化状況を証跡として残す。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-ops-crud, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md, system-spec/backend.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P06 upstream entry gate: SYS-BLOG-OPS-CRUD-P05 の implementation_readiness=complete
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 画面の behavior テストを実行する
- Backend: applicable; ユースケース・API・DB結合テストを実行する
- API: applicable; 管理APIの契約テストを実行する
- Data: N/A: スキーマ変更自体はP05で完了済みであり本phaseはテスト実行のみ行う
- Infrastructure: N/A: デプロイ単位への影響なし
- Security: N/A: 権限モデルの変更を伴わない
- Quality: applicable; 全テスト緑化と回帰0件が本 phase の完了条件である
- Documentation: N/A: 文書更新はP12/P13が所有する
- Operations: N/A: 運用手順はP12が所有する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md, system-spec/backend.md, docs/spec/13-参考サイト全体構成解析-抽象ブループリント.md, docs/spec/06-サイトブループリント-記事構成テンプレート.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存 articles.status enum との後方互換migrationはP08が所有する

## 成果物

- Produced artifacts: docs/spec/feat-blog-ops-crud/test-run-report.md (単体/結合/境界値/回帰テストと転用禁止grepゲートの実行結果)
- Consumed artifacts: docs/spec/feat-blog-ops-crud/test-design.md, src/
- Write scope/touches: docs/spec/feat-blog-ops-crud/test-run-report.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-BLOG-OPS-CRUD-P06; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-BLOG-OPS-CRUD-P06; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-BLOG-OPS-CRUD-P06 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-blog-ops-crud 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-blog-ops-crud の scope_out に該当する変更
- テスト設計の変更 (P04が所有する)、実装の変更 (P05が所有する)

## テスト戦略

- テストレベル選定: 単体: ユースケース関数・データモデル変換ロジック・BP/AT検証ロジックの単体テストを緑化する。結合: 画面からAPI、APIからD1永続化までの結合テストを緑化する。境界値: sister-sites-band の max_items 境界・サイドバー折りたたみ境界・custom-html-slot サニタイズ境界・固定ページ未作成時の空状態・delivery_snapshots 欠落0件境界・axe-core重大違反0件境界を緑化する。回帰: 既存 tests/ 配下の全テストスイートを0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/presentation/ui, src/app/api/admin, src/application, src/infrastructure/persistence/d1) に適用する。
- 層別方針: フロントエンド: behavior ベースでP05実装の振る舞いを検証する。バックエンド/API/データ: API 契約 + ロジック単体 + DB 結合でP05実装を検証する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm test` (単体/結合/境界値テストを実行する)
- Automated commands: `pnpm run test:coverage` (カバレッジ目標80%の充足を確認する)
- Automated commands: `node scripts/check-reference-site-reuse.mjs` (転用禁止grepゲートを実行する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ops-crud` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: docs/spec/feat-blog-ops-crud/test-run-report.md のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: P04で設計した全テストと転用禁止grepゲートが緑化し、失敗0件の結果がtest-run-report.mdに記録されている状態を成立させる。
- Generic execution prompt: feat-blog-ops-crud の goal (管理画面からサイト網とそのトップ構成・レイアウト・記事 (T1-T4)・固定ページ 8 種・ブランドタグ・配信部品を CRUD でき、一覧で各記事/サイトのブループリント適合・配信健全性・鮮度・閲覧者評価を確認でき、公開面が docs/spec/13 §8 のブループリント・パラメータどおりに描画・配信され、参考サイト固有の文章・素材・固有名・色値を一切含まない状態になっている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P06 の目的を満たす成果物を作らせる。失敗が残る場合はP05へfeedbackを返し、本phase単体では実装を変更しない。
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P06 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P06 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入14件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md, system-spec/backend.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Blueprint: docs/spec/13-参考サイト全体構成解析-抽象ブループリント.md, docs/spec/06-サイトブループリント-記事構成テンプレート.md
- Feature: feat-blog-ops-crud
- Phase doc: system-plan-phase-names.md#P06
- Dependencies: SYS-BLOG-OPS-CRUD-P05
