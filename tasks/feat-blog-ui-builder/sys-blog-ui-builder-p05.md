---
graph_node_id: "SYS-BLOG-UI-BUILDER-P05"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-blog-ui-builder"
domain: "frontend"
tags: ["p05","feat-blog-ui-builder"]
priority: null
start_date: null
target_date: null
iteration: null
title: "テンプレート・配色2層・sticky常時表示・固定ページ・表現ブロック・配置管理・SEO/AI検索の実装"
owners: ["daishiman"]
created_at: "2026-08-28T13:02:37Z"
updated_at: "2026-08-28T13:02:37Z"
status: "active"
depends_on: ["SYS-BLOG-UI-BUILDER-P04"]
related_nodes: []
resource_scope: ["src/app/admin/sites/","src/app/admin/sites/new/","src/app/admin/settings/seo/","src/app/api/admin/","src/presentation/ui/templates/","src/presentation/ui/patterns/","src/presentation/ui/tokens.css","src/app/s/[site]/","src/application/usecases/","src/application/read-models/","src/application/seo/","src/application/ports/","src/infrastructure/persistence/d1/","src/db/schema.ts","drizzle/"]
purpose: "受入14件 (A1-A14) に対応する実装 (テンプレート6種からのブログ作成・差替、配色2層のlight-dark()実装、sticky header/sidebar/footerと狭幅折りたたみ、固定ページ6種の構築UI、記事表現ブロック5種+スロット差替+SEO/AI標準ブロック、blog_affiliate_placementの管理一覧・逆引きと公開/作成/保存各面での表示、D1永続化、記事ページSSRへのJSON-LD/canonical/OGP埋め込み、sitemap/robots.txt/feed.xml/llms.txtの自動生成、IndexNow送信の鍵環境変数分離、guideline_references管理画面と90日再確認) を完了し、P04のテストを緑化した状態を成立させる。"
goal: "受入14件 (A1-A14) に対応する実装 (テンプレート6種からのブログ作成・差替、配色2層のlight-dark()実装、sticky header/sidebar/footerと狭幅折りたたみ、固定ページ6種の構築UI、記事表現ブロック5種+スロット差替+SEO/AI標準ブロック、blog_affiliate_placementの管理一覧・逆引きと公開/作成/保存各面での表示、D1永続化、記事ページSSRへのJSON-LD/canonical/OGP埋め込み、sitemap/robots.txt/feed.xml/llms.txtの自動生成、IndexNow送信の鍵環境変数分離、guideline_references管理画面と90日再確認) を完了し、P04のテストを緑化した状態を成立させる。"
scope_in: ["Produced artifacts: src/app/admin/sites/ 配下のブログテンプレート選択・配色設定・固定ページ編集・アフィリエイト配置一覧画面; src/app/admin/settings/seo/ 配下のguideline_references管理画面; src/app/api/admin/ 配下のテンプレート/配色/固定ページ/配置/guideline_references のCRUD+逆引きAPI; src/presentation/ui/templates・patterns 配下のsticky layout・記事表現ブロック5種・スロット差替・SEO/AI標準ブロックコンポーネント; src/app/s/[site]/ 配下の固定ページ6種の公開面ルートと配色反映・sitemap/robots/feed/llms.txt生成; src/application/usecases・read-models 配下のブログ作成/配色設定/配置管理/guideline_references ユースケース; src/application/seo/ 配下のJSON-LD生成・IndexNow送信・structured-data 純関数; src/application/ports/ 配下のguideline-reference ポート契約; src/infrastructure/persistence/d1 配下の6エンティティリポジトリ; src/db/schema.ts への6エンティティ追加とdrizzle/配下のマイグレーション","Consumed artifacts: docs/spec/feat-blog-ui-builder/data-model.md, docs/spec/feat-blog-ui-builder/theme-contract.md, docs/spec/feat-blog-ui-builder/component-contract.md, docs/spec/feat-blog-ui-builder/admin-api-contract.md, docs/spec/feat-blog-ui-builder/seo-ai-search-contract.md, docs/spec/feat-blog-ui-builder/test-design.md","Write scope/touches: src/app/admin/sites/, src/app/admin/sites/new/, src/app/admin/settings/seo/, src/app/api/admin/, src/presentation/ui/templates/, src/presentation/ui/patterns/, src/presentation/ui/tokens.css, src/app/s/[site]/, src/application/usecases/, src/application/read-models/, src/application/seo/, src/application/ports/, src/infrastructure/persistence/d1/, src/db/schema.ts, drizzle/"]
scope_out: ["feat-blog-ui-builder の scope_out に該当する変更","write_scope外のパスへの変更","既存 feat-uiux-overhaul が所有する管理画面全体の単一用途画面再編"]
acceptance: ["Automated commands: `pnpm test` (P04で設計したテストの緑化を確認する)","Automated commands: `pnpm run typecheck` (型検査)","Automated commands: `pnpm run db:generate` (drizzleスキーマ変更からのマイグレーション生成を確認する)","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` (本 package の C12 決定論検証を世代非依存に再実行する)","Required evidence: P05 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-two-layer-platform"]
parent_feature: "feat-blog-ui-builder"
feature_package_id: "feature-package/feat-blog-ui-builder"
phase_ref: "P05"
file_path: "tasks/feat-blog-ui-builder/sys-blog-ui-builder-p05.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-blog-ui-builder/168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48/plan-findings.json"}
source_lineage: {"imported_at":"2026-08-28T13:02:37Z","origin_kind":"system-dev-planner","source_digest":"168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48","source_path":".dev-graph/published/generations/feature-package-feat-blog-ui-builder/168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48/task-specs/phase-05-implementation.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1
classification_reason: "feat-blog-ui-builder の P05 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-blog-ui-builder/sys-blog-ui-builder-p05.md","confidence":1}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-28T00:00:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: テンプレート・配色2層・sticky常時表示・固定ページ・表現ブロック・配置管理・SEO/AI検索の実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-ui-builder
- owners: ["daishiman"]
- tags: ["p05", "feat-blog-ui-builder"]
- related_nodes: []
- parent_feature: feat-blog-ui-builder
- phase_ref: P05
- classification: confidence=1.0; reason=feat-blog-ui-builder の P05 lifecycle 責務への確定写像; candidate=tasks/feat-blog-ui-builder/sys-blog-ui-builder-p05.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

受入14件 (A1-A14) に対応する実装 (テンプレート6種からのブログ作成・差替、配色2層のlight-dark()実装、sticky header/sidebar/footerと狭幅折りたたみ、固定ページ6種の構築UI、記事表現ブロック5種+スロット差替+SEO/AI標準ブロック、blog_affiliate_placementの管理一覧・逆引きと公開/作成/保存各面での表示、D1永続化、記事ページSSRへのJSON-LD/canonical/OGP埋め込み、sitemap/robots.txt/feed.xml/llms.txtの自動生成、IndexNow送信の鍵環境変数分離、guideline_references管理画面と90日再確認) を完了し、P04のテストを緑化した状態を成立させる。

## 背景

既存 src/app/admin/sites はサイト単位の基本CRUDを持つが、ブログ単位のテンプレート/配色2層/固定ページ/表現ブロック/SEO/AI検索/アフィリエイト配置は未実装である。既存 src/presentation/ui/templates (app-shell.tsx, site-shell.tsx等)、src/presentation/ui/patterns (appearance-picker.tsx, comparison-table.tsx等) を土台に、P02の契約に沿って拡張・新規追加する。src/application/seo/ 配下にJSON-LD生成・IndexNow送信・structured-data純関数を実装する。src/application/ports/guideline-reference.ts のポート契約に従い guideline-reference-repository を実装する。参考ブログ (実名は docs/spec/feat-reference-blog-admin-ux/evidence/reference-site-profile.json) は構成・配置・表記法の参照のみに用い、文章・素材・デザインをそのまま複製しない。source_feature_digest: sha256:8953a167a43f5fc55998ebfcaa83f437d59f0d567cde6e7c15e8b568ab470d7b

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-ui-builder, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P05 upstream entry gate: SYS-BLOG-UI-BUILDER-P04 の implementation_readiness=complete
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; sticky header/sidebar/footer・テンプレート選択UI・記事表現ブロック5種・スロット差替・SEO/AI標準ブロック・guideline_references管理画面を実装する
- Backend: applicable; ブログ作成・配色設定・固定ページ・配置管理・JSON-LD生成・IndexNow送信スキップ・guideline_references のユースケースを実装する
- API: applicable; src/app/api/admin配下に管理APIを実装する
- Data: applicable; src/db/schema.tsへの6エンティティ追加とdrizzle-kit generateによるマイグレーションを実装する
- Infrastructure: N/A: 既存 cloudflare-workers-opennext-app デプロイ単位を変更しない
- Security: applicable; 既存 admin RBAC 契約の範囲で権限チェックを実装へ組み込む。IndexNow鍵はサーバー環境変数からのみ読み、リポジトリ・管理画面・DBに保存しない
- Quality: applicable; P04のテストが緑化することを完了条件とする
- Documentation: N/A: 文書更新はP12/P13が所有する
- Operations: N/A: 運用手順はP12が所有する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存 src/app/admin/sites 配下画面の新エンティティへの移行はP08が所有する

## 成果物

- Produced artifacts: src/app/admin/sites/ 配下のブログテンプレート選択・配色設定・固定ページ編集・アフィリエイト配置一覧画面; src/app/admin/settings/seo/ 配下のguideline_references管理画面; src/app/api/admin/ 配下のテンプレート/配色/固定ページ/配置/guideline_references のCRUD+逆引きAPI; src/presentation/ui/templates・patterns 配下のsticky layout・記事表現ブロック5種・スロット差替・SEO/AI標準ブロックコンポーネント; src/app/s/[site]/ 配下の固定ページ6種の公開面ルートと配色反映・sitemap/robots/feed/llms.txt生成; src/application/usecases・read-models 配下のブログ作成/配色設定/配置管理/guideline_references ユースケース; src/application/seo/ 配下のJSON-LD生成・IndexNow送信・structured-data 純関数; src/application/ports/ 配下のguideline-reference ポート契約; src/infrastructure/persistence/d1 配下の6エンティティリポジトリ; src/db/schema.ts への6エンティティ追加とdrizzle/配下のマイグレーション
- Consumed artifacts: docs/spec/feat-blog-ui-builder/data-model.md, docs/spec/feat-blog-ui-builder/theme-contract.md, docs/spec/feat-blog-ui-builder/component-contract.md, docs/spec/feat-blog-ui-builder/admin-api-contract.md, docs/spec/feat-blog-ui-builder/seo-ai-search-contract.md, docs/spec/feat-blog-ui-builder/test-design.md
- Write scope/touches: src/app/admin/sites/, src/app/admin/sites/new/, src/app/admin/settings/seo/, src/app/api/admin/, src/presentation/ui/templates/, src/presentation/ui/patterns/, src/presentation/ui/tokens.css, src/app/s/[site]/, src/application/usecases/, src/application/read-models/, src/application/seo/, src/application/ports/, src/infrastructure/persistence/d1/, src/db/schema.ts, drizzle/

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-BLOG-UI-BUILDER-P05; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-BLOG-UI-BUILDER-P05; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-BLOG-UI-BUILDER-P05 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-blog-ui-builder 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-blog-ui-builder の scope_out に該当する変更
- write_scope外のパスへの変更
- 既存 feat-uiux-overhaul が所有する管理画面全体の単一用途画面再編

## テスト戦略

- テストレベル選定: 単体: ユースケース関数・データモデル変換ロジック・JSON-LD生成純関数・IndexNow送信スキップロジック・guideline_references 90日判定ロジックの単体テストを緑化する。結合: 画面からAPI、APIからD1永続化までの結合テストを緑化する。境界値: サイドバー折りたたみ境界・配色上書き解除時のフォールバック・固定ページ未作成時の空状態・axe-core重大違反0件境界・IndexNow鍵未設定時のスキップ境界・guideline_references 90日超境界を緑化する。回帰: 既存 tests/ 配下の全テストスイートを0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/presentation/ui, src/app/api/admin, src/application, src/infrastructure/persistence/d1, src/application/seo) に適用する。
- 層別方針: フロントエンド: behavior ベースでテンプレート選択・配色上書き・sticky折りたたみ・表現ブロック差替・SEO/AI標準ブロック挿入の振る舞いを検証する。バックエンド/API/データ: API 契約 + ロジック単体 + DB 結合でCRUDと配置反映・JSON-LD生成・IndexNow送信スキップ・guideline_references 90日境界を検証する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## 完了条件

- A1-A14 に対応する P04 のテストが全件緑化している
- IndexNow鍵がリポジトリ・管理画面・DBのいずれにも保存されていない
- guideline_references の90日再確認ロジックが実装されている

## 判定項目

- [ ] A1-A9 (UI/UX) の P04 テストが緑化している
- [ ] A10 (JSON-LD SSR) のテストが緑化している
- [ ] A11 (sitemap/robots/feed/llms.txt) のテストが緑化している
- [ ] A12 (SEO/AI標準ブロック・dateModified) のテストが緑化している
- [ ] A13 (IndexNow鍵環境変数分離) のテストが緑化している
- [ ] A14 (guideline_references 90日) のテストが緑化している
- [ ] `pnpm run typecheck` が合格する
- [ ] `pnpm run db:generate` が成功する

## Verification and evidence

- Automated commands: `pnpm test` (P04で設計したテストの緑化を確認する)
- Automated commands: `pnpm run typecheck` (型検査)
- Automated commands: `pnpm run db:generate` (drizzleスキーマ変更からのマイグレーション生成を確認する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P05 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: 受入14件 (A1-A14) に対応する実装を完了し、P04のテストを緑化した状態を成立させる。
- Generic execution prompt: feat-blog-ui-builder の goal と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P05 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P05 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P05 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入14件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-blog-ui-builder
- Phase doc: system-plan-phase-names.md#P05
- Dependencies: SYS-BLOG-UI-BUILDER-P04
- source_feature_digest: sha256:8953a167a43f5fc55998ebfcaa83f437d59f0d567cde6e7c15e8b568ab470d7b

## 実行契約

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: current pointer から現行世代を解決する `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` で published task spec と package 全体を再検証する。
