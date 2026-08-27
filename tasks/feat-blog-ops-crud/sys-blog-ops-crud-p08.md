---
artifact_kind: "task"
artifact_subtypes: []
beads_linkage: null
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-blog-ops-crud/sys-blog-ops-crud-p08.md","confidence":1.0}]
classification_confidence: 1.0
classification_reason: "feat-blog-ops-crud の P08 lifecycle 責務への確定写像"
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"linked_pr_merged_all","reconciled_at":null,"source":null,"status":"in_progress"}
confirmation_evidence: {"evaluated_digest":"aa09bccf2924ffc24a1126c1fdf25935bb41f4bdd1f869d2934519d2fcdff635","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-blog-ops-crud/aa09bccf2924ffc24a1126c1fdf25935bb41f4bdd1f869d2934519d2fcdff635/plan-findings.json"}
confirmation_status: "confirmed"
created_at: "2026-08-25T14:00:26Z"
depends_on: ["SYS-BLOG-OPS-CRUD-P05"]
domain: "backend"
evaluation_status: "pass"
execution_contexts: []
feature_package_id: "feature-package/feat-blog-ops-crud"
file_path: "tasks/feat-blog-ops-crud/sys-blog-ops-crud-p08.md"
github_project_linkages: []
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
graph_node_id: "SYS-BLOG-OPS-CRUD-P08"
implementation_readiness: {"checked_at":"2026-08-25T13:19:00Z","missing_sections":[],"status":"complete"}
issue_linkage: null
iteration: null
owners: ["daishiman"]
parent_feature: "feat-blog-ops-crud"
phase_ref: "P08"
priority: null
project_id: "feature-package-feat-blog-ops-crud"
pull_request_linkages: []
related_nodes: []
resource_scope: ["src/db/schema.ts","drizzle/","src/app/admin/content/","src/app/admin/blog/articles/","docs/spec/feat-blog-ops-crud/migration-report.md"]
source_lineage: {"imported_at":"2026-08-25T14:00:26Z","origin_kind":"system-dev-planner","source_digest":"aa09bccf2924ffc24a1126c1fdf25935bb41f4bdd1f869d2934519d2fcdff635","source_path":".dev-graph/published/generations/feature-package-feat-blog-ops-crud/aa09bccf2924ffc24a1126c1fdf25935bb41f4bdd1f869d2934519d2fcdff635/task-specs/phase-08-refactoring-migration.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
start_date: null
status: "active"
tags: ["p08","feat-blog-ops-crud"]
target_date: null
template_id: "task"
template_version: "1.1.0"
title: "既存 articles スキーマ・admin/content 系画面との重複解消と移行"
tracker_binding: "beads"
updated_at: "2026-08-25T14:00:26Z"
purpose: "既存 articles テーブル (type enum ranking/review/comparison/guide/tool、status enum draft/review/published/archived、AIコンテンツ生成パイプライン (content_variants/publications) が参照) と、本 feature が追加するblog CRUD用フィールド (article_template・status拡張 draft/scheduled/published/unpublished/archived・category_id→blog_category・author_profile_id 等) が後方互換migrationで単一テーブルへ統合され、既存 src/app/admin/content 配下 (AIコンテンツ生成の管理画面) と新規 src/app/admin/blog/articles 配下 (本featureのブログ記事CRUD画面) の間で記事一覧・編集ロジックの重複実装が0件であることが確認された状態を成立させる。"
goal: "既存 articles テーブル (type enum ranking/review/comparison/guide/tool、status enum draft/review/published/archived、AIコンテンツ生成パイプライン (content_variants/publications) が参照) と、本 feature が追加するblog CRUD用フィールド (article_template・status拡張 draft/scheduled/published/unpublished/archived・category_id→blog_category・author_profile_id 等) が後方互換migrationで単一テーブルへ統合され、既存 src/app/admin/content 配下 (AIコンテンツ生成の管理画面) と新規 src/app/admin/blog/articles 配下 (本featureのブログ記事CRUD画面) の間で記事一覧・編集ロジックの重複実装が0件であることが確認された状態を成立させる。"
scope_in: ["Produced artifacts: src/db/schema.ts への articles.status enum 後方互換拡張; drizzle/配下の追加migration; src/app/admin/content 配下の重複ロジック整理; docs/spec/feat-blog-ops-crud/migration-report.md (移行前後の対応表と重複解消の証跡)","Consumed artifacts: docs/spec/feat-blog-ops-crud/migration-plan.md, src/app/admin/content/, src/db/schema.ts","Write scope/touches: src/db/schema.ts, drizzle/, src/app/admin/content/, src/app/admin/blog/articles/, docs/spec/feat-blog-ops-crud/migration-report.md"]
scope_out: ["feat-blog-ops-crud の scope_out に該当する変更","src/app/admin/content配下のAIコンテンツ生成機能そのものの再設計 (別featureが所有する)"]
acceptance: ["Automated commands: `pnpm run lint` (重複コンポーネントの静的検出)","Automated commands: `pnpm run typecheck` (移行後の型整合性を確認する)","Automated commands: `pnpm run db:generate` (status enum後方互換migrationの生成を確認する)","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ops-crud` (本 package の C12 決定論検証を世代非依存に再実行する)","Required evidence: P08 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
---

# System task overlay: 既存 articles スキーマ・admin/content 系画面との重複解消と移行

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-ops-crud
- owners: ["daishiman"]
- tags: ["p08", "feat-blog-ops-crud"]
- related_nodes: []
- parent_feature: feat-blog-ops-crud
- phase_ref: P08
- classification: confidence=1.0; reason=feat-blog-ops-crud の P08 lifecycle 責務への確定写像; candidate=tasks/feat-blog-ops-crud/sys-blog-ops-crud-p08.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

既存 articles テーブル (type enum ranking/review/comparison/guide/tool、status enum draft/review/published/archived、AIコンテンツ生成パイプライン (content_variants/publications) が参照) と、本 feature が追加するblog CRUD用フィールド (article_template・status拡張 draft/scheduled/published/unpublished/archived・category_id→blog_category・author_profile_id 等) が後方互換migrationで単一テーブルへ統合され、既存 src/app/admin/content 配下 (AIコンテンツ生成の管理画面) と新規 src/app/admin/blog/articles 配下 (本featureのブログ記事CRUD画面) の間で記事一覧・編集ロジックの重複実装が0件であることが確認された状態を成立させる。

## 背景

P05はarticlesテーブルへblog CRUD用フィールドを追加するが、既存 src/app/admin/content配下 (ContentVariant編集画面・content matrix・progress画面) が同じarticlesテーブルの一部フィールド (status, categoryId) を参照しているため、既存画面との重複・不整合が生じる場合がある。本 phase で既存画面と新規画面の責務境界 (AIコンテンツ生成 vs ブログ記事CRUD) を一本化する。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-ops-crud, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md, system-spec/backend.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P08 upstream entry gate: SYS-BLOG-OPS-CRUD-P05 の implementation_readiness=complete
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 既存 src/app/admin/content 配下の記事一覧・編集ロジックが新規 src/app/admin/blog/articles と重複しないことを確認し、必要な導線整理を行う
- Backend: applicable; 既存articles参照ユースケースが拡張後のstatus enum・article_templateと整合することを確認する
- API: N/A: 管理APIの追加自体はP05で完了済みであり本phaseは重複解消のみ行う
- Data: applicable; articles.status enum拡張のための後方互換migrationを実装する
- Infrastructure: N/A: デプロイ単位への影響なし
- Security: N/A: 権限モデルの変更を伴わない
- Quality: applicable; 重複実装0件の機械検査が本 phase の完了条件である
- Documentation: applicable; migration-report.mdが移行の証跡文書である
- Operations: N/A: 運用手順はP12が所有する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md, system-spec/backend.md, docs/spec/13-参考サイト全体構成解析-抽象ブループリント.md, docs/spec/06-サイトブループリント-記事構成テンプレート.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存 articles.status enum との後方互換migrationはP08が所有する

## 成果物

- Produced artifacts: src/db/schema.ts への articles.status enum 後方互換拡張; drizzle/配下の追加migration; src/app/admin/content 配下の重複ロジック整理; docs/spec/feat-blog-ops-crud/migration-report.md (移行前後の対応表と重複解消の証跡)
- Consumed artifacts: docs/spec/feat-blog-ops-crud/migration-plan.md, src/app/admin/content/, src/db/schema.ts
- Write scope/touches: src/db/schema.ts, drizzle/, src/app/admin/content/, src/app/admin/blog/articles/, docs/spec/feat-blog-ops-crud/migration-report.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-BLOG-OPS-CRUD-P08; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-BLOG-OPS-CRUD-P08; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-BLOG-OPS-CRUD-P08 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-blog-ops-crud 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-blog-ops-crud の scope_out に該当する変更
- src/app/admin/content配下のAIコンテンツ生成機能そのものの再設計 (別featureが所有する)

## テスト戦略

- テストレベル選定: 単体: ユースケース関数・データモデル変換ロジック・BP/AT検証ロジックの単体テストを緑化する。結合: 画面からAPI、APIからD1永続化までの結合テストを緑化する。境界値: sister-sites-band の max_items 境界・サイドバー折りたたみ境界・custom-html-slot サニタイズ境界・固定ページ未作成時の空状態・delivery_snapshots 欠落0件境界・axe-core重大違反0件境界を緑化する。回帰: 既存 tests/ 配下の全テストスイートを0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/presentation/ui, src/app/api/admin, src/application, src/infrastructure/persistence/d1) に適用する。
- 層別方針: フロントエンド: behavior ベースで既存admin/content画面と新規admin/blog/articles画面の重複無しを検証する。バックエンド/API/データ: API 契約 + ロジック単体 + DB 結合でstatus enum後方互換migrationを検証する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run lint` (重複コンポーネントの静的検出)
- Automated commands: `pnpm run typecheck` (移行後の型整合性を確認する)
- Automated commands: `pnpm run db:generate` (status enum後方互換migrationの生成を確認する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ops-crud` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P08 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: 既存articlesスキーマとadmin/content画面が新規blog CRUDと後方互換で統合され、重複実装が0件である状態を成立させる。
- Generic execution prompt: feat-blog-ops-crud の goal (管理画面からサイト網とそのトップ構成・レイアウト・記事 (T1-T4)・固定ページ 8 種・ブランドタグ・配信部品を CRUD でき、一覧で各記事/サイトのブループリント適合・配信健全性・鮮度・閲覧者評価を確認でき、公開面が docs/spec/13 §8 のブループリント・パラメータどおりに描画・配信され、参考サイト固有の文章・素材・固有名・色値を一切含まない状態になっている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P08 の目的を満たす成果物を作らせる。既存 content_variants/publications からの参照を壊さないことを migration-report.md で確認する。
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P08 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P08 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入14件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md, system-spec/backend.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Blueprint: docs/spec/13-参考サイト全体構成解析-抽象ブループリント.md, docs/spec/06-サイトブループリント-記事構成テンプレート.md
- Feature: feat-blog-ops-crud
- Phase doc: system-plan-phase-names.md#P08
- Dependencies: SYS-BLOG-OPS-CRUD-P05
