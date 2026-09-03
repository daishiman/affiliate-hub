---
graph_node_id: "SYS-BLOG-UI-BUILDER-P02"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-blog-ui-builder"
domain: "documentation"
tags: ["p02","feat-blog-ui-builder"]
priority: null
start_date: null
target_date: null
iteration: null
title: "データモデル・テーマ契約・コンポーネント契約・管理API契約・SEO/AI検索契約の設計"
owners: ["daishiman"]
created_at: "2026-08-28T13:02:37Z"
updated_at: "2026-08-30T04:07:37Z"
status: "closed"
depends_on: ["SYS-BLOG-UI-BUILDER-P01"]
related_nodes: []
resource_scope: ["docs/spec/feat-blog-ui-builder/data-model.md","docs/spec/feat-blog-ui-builder/theme-contract.md","docs/spec/feat-blog-ui-builder/component-contract.md","docs/spec/feat-blog-ui-builder/admin-api-contract.md","docs/spec/feat-blog-ui-builder/seo-ai-search-contract.md"]
purpose: "blog_template/blog_theme/page_theme_override/legal_page/blog_affiliate_placement/guideline_references のデータモデル、decision-ui-theme-implementation (CSS light-dark()+data属性) に従う配色2層のテーマ実装契約、sticky header/sidebar/footer と記事表現ブロック5種+スロット+SEO/AI引用用標準ブロック (answer/key-points/FAQ/sources/freshness) のコンポーネント契約、ブログ作成・配色設定・固定ページ・アフィリエイト配置の管理API契約、JSON-LD自動生成/sitemap/robots.txt/llms.txt/IndexNow/guideline_references のSEO/AI検索実装契約を確定する。受入A10-A14 (SEO/AI検索) の設計を含む。"
goal: "blog_template/blog_theme/page_theme_override/legal_page/blog_affiliate_placement/guideline_references のデータモデル、decision-ui-theme-implementation (CSS light-dark()+data属性) に従う配色2層のテーマ実装契約、sticky header/sidebar/footer と記事表現ブロック5種+スロット+SEO/AI引用用標準ブロック (answer/key-points/FAQ/sources/freshness) のコンポーネント契約、ブログ作成・配色設定・固定ページ・アフィリエイト配置の管理API契約、JSON-LD自動生成/sitemap/robots.txt/llms.txt/IndexNow/guideline_references のSEO/AI検索実装契約を確定する。受入A10-A14 (SEO/AI検索) の設計を含む。"
scope_in: ["Produced artifacts: docs/spec/feat-blog-ui-builder/data-model.md (6エンティティのカラム/関連/D1永続化契約); docs/spec/feat-blog-ui-builder/theme-contract.md (blog_theme既定+page_theme_override上書きのlight-dark()契約); docs/spec/feat-blog-ui-builder/component-contract.md (sticky layout・記事ブロック5種・スロット差替・SEO/AI標準ブロック契約); docs/spec/feat-blog-ui-builder/admin-api-contract.md (テンプレート/配色/固定ページ/配置のCRUD+逆引きAPI契約); docs/spec/feat-blog-ui-builder/seo-ai-search-contract.md (JSON-LD自動生成/sitemap/robots/llms.txt/IndexNow/guideline_references の実装契約)","Consumed artifacts: docs/spec/feat-blog-ui-builder/requirements-baseline.md, docs/spec/feat-blog-ui-builder/screen-inventory.md, system-spec/database.md, system-spec/frontend.md, src/db/schema.ts","Write scope/touches: docs/spec/feat-blog-ui-builder/data-model.md, docs/spec/feat-blog-ui-builder/theme-contract.md, docs/spec/feat-blog-ui-builder/component-contract.md, docs/spec/feat-blog-ui-builder/admin-api-contract.md, docs/spec/feat-blog-ui-builder/seo-ai-search-contract.md"]
scope_out: ["feat-blog-ui-builder の scope_out に該当する変更","既存 feat-uiux-overhaul が所有する管理画面全体の単一用途画面再編"]
acceptance: ["Automated commands: `pnpm run typecheck` (契約文書に対応する型定義の追加箇所が既存 tsconfig と矛盾しないことを確認する)","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` (本 package の C12 決定論検証を世代非依存に再実行する)","Required evidence: P02 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-two-layer-platform"]
parent_feature: "feat-blog-ui-builder"
feature_package_id: "feature-package/feat-blog-ui-builder"
phase_ref: "P02"
file_path: "tasks/feat-blog-ui-builder/sys-blog-ui-builder-p02.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-blog-ui-builder/168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48/plan-findings.json"}
source_lineage: {"imported_at":"2026-08-28T13:02:37Z","origin_kind":"system-dev-planner","source_digest":"168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48","source_path":".dev-graph/published/generations/feature-package-feat-blog-ui-builder/168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48/task-specs/phase-02-architecture.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1
classification_reason: "feat-blog-ui-builder の P02 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-blog-ui-builder/sys-blog-ui-builder-p02.md","confidence":1}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-45ba.2","github_mirror":null,"linked_at":"2026-08-28T13:02:37Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-28T00:00:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: データモデル・テーマ契約・コンポーネント契約・管理API契約・SEO/AI検索契約の設計

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-ui-builder
- owners: ["daishiman"]
- tags: ["p02", "feat-blog-ui-builder"]
- related_nodes: []
- parent_feature: feat-blog-ui-builder
- phase_ref: P02
- classification: confidence=1.0; reason=feat-blog-ui-builder の P02 lifecycle 責務への確定写像; candidate=tasks/feat-blog-ui-builder/sys-blog-ui-builder-p02.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

blog_template/blog_theme/page_theme_override/legal_page/blog_affiliate_placement/guideline_references のデータモデル、decision-ui-theme-implementation (CSS light-dark()+data属性) に従う配色2層のテーマ実装契約、sticky header/sidebar/footer と記事表現ブロック5種+スロット+SEO/AI引用用標準ブロック (answer/key-points/FAQ/sources/freshness) のコンポーネント契約、ブログ作成・配色設定・固定ページ・アフィリエイト配置の管理API契約、JSON-LD自動生成/sitemap/robots.txt/llms.txt/IndexNow/guideline_references のSEO/AI検索実装契約を確定する。受入A10-A14 (SEO/AI検索) の設計を含む。

## 背景

system-spec/database.md はblog_template/blog_theme/page_theme_override/legal_page/blog_affiliate_placement/guideline_references を追加エンティティとして確定し、system-spec/frontend.md はdecision-ui-theme-implementation (opt-css-light-dark) と qa-frontend-web-seo-ai-search-v2 (JSON-LD/sitemap/IndexNow契約) を確定している。既存 src/db/schema.ts・src/infrastructure/persistence/d1 配下のリポジトリ実装、src/presentation/ui/templates・src/presentation/ui/patterns の既存コンポーネント資産を土台に、P01の要求ベースラインを満たす設計へ変換する。参考ブログ (実名は docs/spec/feat-reference-blog-admin-ux/evidence/reference-site-profile.json) は構成・配置・表記法の参照のみに用い、文章・素材・デザインをそのまま複製しない。source_feature_digest: sha256:8953a167a43f5fc55998ebfcaa83f437d59f0d567cde6e7c15e8b568ab470d7b

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-ui-builder, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P02 upstream entry gate: SYS-BLOG-UI-BUILDER-P01 の implementation_readiness=complete
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; sticky header/sidebar/footer・記事表現ブロック5種・スロット差替・SEO/AI引用用標準ブロックのコンポーネント契約を確定する
- Backend: applicable; ブログ作成・テーマ設定・固定ページ・アフィリエイト配置・SEO/AI検索送信のユースケース境界を確定する
- API: applicable; 管理API契約 (一覧/作成/更新/削除+逆引き+IndexNow送信) を確定する
- Data: applicable; blog_template/blog_theme/page_theme_override/legal_page/blog_affiliate_placement/guideline_references のデータモデルとD1永続化契約を確定する
- Infrastructure: N/A: 既存 Cloudflare Workers/D1/R2 デプロイ単位を変更しない
- Security: applicable; 管理操作の権限要求を既存 admin RBAC 契約の範囲で確定する。IndexNow鍵はサーバー環境変数からのみ読む契約を含む
- Quality: applicable; 設計がP04のテスト設計で検証可能な粒度であることを完了条件とする
- Documentation: applicable; 本 phase の5契約文書そのものが成果物である
- Operations: N/A: 運用手順はP12が所有する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存 src/app/admin/sites 配下画面の新エンティティへの移行はP08が所有する

## 成果物

- Produced artifacts: docs/spec/feat-blog-ui-builder/data-model.md (6エンティティのカラム/関連/D1永続化契約); docs/spec/feat-blog-ui-builder/theme-contract.md (blog_theme既定+page_theme_override上書きのlight-dark()契約); docs/spec/feat-blog-ui-builder/component-contract.md (sticky layout・記事ブロック5種・スロット差替・SEO/AI標準ブロック契約); docs/spec/feat-blog-ui-builder/admin-api-contract.md (テンプレート/配色/固定ページ/配置のCRUD+逆引きAPI契約); docs/spec/feat-blog-ui-builder/seo-ai-search-contract.md (JSON-LD自動生成/sitemap/robots/llms.txt/IndexNow/guideline_references の実装契約)
- Consumed artifacts: docs/spec/feat-blog-ui-builder/requirements-baseline.md, docs/spec/feat-blog-ui-builder/screen-inventory.md, system-spec/database.md, system-spec/frontend.md, src/db/schema.ts
- Write scope/touches: docs/spec/feat-blog-ui-builder/data-model.md, docs/spec/feat-blog-ui-builder/theme-contract.md, docs/spec/feat-blog-ui-builder/component-contract.md, docs/spec/feat-blog-ui-builder/admin-api-contract.md, docs/spec/feat-blog-ui-builder/seo-ai-search-contract.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-BLOG-UI-BUILDER-P02; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-BLOG-UI-BUILDER-P02; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-BLOG-UI-BUILDER-P02 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-blog-ui-builder 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-blog-ui-builder の scope_out に該当する変更
- 既存 feat-uiux-overhaul が所有する管理画面全体の単一用途画面再編

## テスト戦略

- テストレベル選定: 単体: ユースケース関数・データモデル変換ロジック・JSON-LD生成純関数の単体テストを緑化する。結合: 画面からAPI、APIからD1永続化までの結合テストを緑化する。境界値: サイドバー折りたたみ境界・配色上書き解除時のフォールバック・固定ページ未作成時の空状態・axe-core重大違反0件境界・IndexNow鍵未設定時のスキップ境界・guideline_references 90日超境界を緑化する。回帰: 既存 tests/ 配下の全テストスイートを0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/presentation/ui, src/app/api/admin, src/application, src/infrastructure/persistence/d1, src/application/seo) に適用する。
- 層別方針: フロントエンド: behavior ベースでテンプレート選択・配色上書き・sticky折りたたみ・表現ブロック差替・SEO/AI標準ブロック挿入の振る舞いを検証する。バックエンド/API/データ: API 契約 + ロジック単体 + DB 結合でCRUDと配置反映・JSON-LD生成・IndexNow送信スキップを検証する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## 完了条件

- 5つの契約文書 (data-model/theme-contract/component-contract/admin-api-contract/seo-ai-search-contract) が存在する
- guideline_references エンティティのデータモデルが data-model.md に記述されている
- JSON-LD自動生成・IndexNow鍵のサーバー環境変数分離が seo-ai-search-contract.md に記述されている

## 判定項目

- [ ] data-model.md に6エンティティ (blog_template/blog_theme/page_theme_override/legal_page/blog_affiliate_placement/guideline_references) が記述されている
- [ ] seo-ai-search-contract.md が存在しJSON-LD/sitemap/robots/llms.txt/IndexNow/guideline_references の契約を含む (A10-A14対応)
- [ ] IndexNow鍵の環境変数分離ポリシーが seo-ai-search-contract.md に明記されている (A13対応)
- [ ] guideline_references の90日再確認ポリシーが seo-ai-search-contract.md に明記されている (A14対応)
- [ ] `pnpm run typecheck` が合格する

## Verification and evidence

- Automated commands: `pnpm run typecheck` (契約文書に対応する型定義の追加箇所が既存 tsconfig と矛盾しないことを確認する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P02 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: blog_template/blog_theme/page_theme_override/legal_page/blog_affiliate_placement/guideline_references のデータモデル、decision-ui-theme-implementation (CSS light-dark()+data属性) に従う配色2層のテーマ実装契約、sticky header/sidebar/footer と記事表現ブロック5種+スロット+SEO/AI引用用標準ブロックのコンポーネント契約、ブログ作成・配色設定・固定ページ・アフィリエイト配置の管理API契約、SEO/AI検索実装契約を確定する。
- Generic execution prompt: feat-blog-ui-builder の goal と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P02 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P02 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P02 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入14件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-blog-ui-builder
- Phase doc: system-plan-phase-names.md#P02
- Dependencies: SYS-BLOG-UI-BUILDER-P01
- source_feature_digest: sha256:8953a167a43f5fc55998ebfcaa83f437d59f0d567cde6e7c15e8b568ab470d7b

## 実行契約

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: current pointer から現行世代を解決する `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` で published task spec と package 全体を再検証する。
