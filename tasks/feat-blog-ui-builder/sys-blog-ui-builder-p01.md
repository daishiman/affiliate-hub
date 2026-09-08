---
graph_node_id: "SYS-BLOG-UI-BUILDER-P01"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-blog-ui-builder"
domain: "documentation"
tags: ["p01","feat-blog-ui-builder"]
priority: null
start_date: null
target_date: null
iteration: null
title: "ブログ UI ビルダーの要求ベースライン確定"
owners: ["daishiman"]
created_at: "2026-08-28T13:02:37Z"
updated_at: "2026-08-30T03:59:19Z"
status: "closed"
depends_on: []
related_nodes: []
resource_scope: ["docs/spec/feat-blog-ui-builder/requirements-baseline.md","docs/spec/feat-blog-ui-builder/screen-inventory.md","docs/spec/feat-blog-ui-builder/information-priority-map.json"]
purpose: "feat-blog-ui-builder の受入14件 (A1-A14) を実装着手前に一意で検証可能な要求ベースラインへ確定し、テンプレート6種・配色2層・sticky常時表示・固定ページ6種・記事表現ブロック5種・blog_affiliate_placement一覧/逆引き・SEO/AI検索最適化 (JSON-LD/sitemap/robots/llms.txt/IndexNow/guideline_references) の各要求を、既存 src/app/admin/sites 配下と src/app/s/[site] 配下の画面棚卸しに接地させた状態を成立させる。"
goal: "feat-blog-ui-builder の受入14件 (A1-A14) を実装着手前に一意で検証可能な要求ベースラインへ確定し、テンプレート6種・配色2層・sticky常時表示・固定ページ6種・記事表現ブロック5種・blog_affiliate_placement一覧/逆引き・SEO/AI検索最適化 (JSON-LD/sitemap/robots/llms.txt/IndexNow/guideline_references) の各要求を、既存 src/app/admin/sites 配下と src/app/s/[site] 配下の画面棚卸しに接地させた状態を成立させる。"
scope_in: ["Produced artifacts: docs/spec/feat-blog-ui-builder/requirements-baseline.md (A1-A14の検証可能化と参照仕様の対応表); docs/spec/feat-blog-ui-builder/screen-inventory.md (既存 src/app/admin/sites・src/app/s/[site] の棚卸しと新規画面差分); docs/spec/feat-blog-ui-builder/information-priority-map.json (画面別の残す/落とす/加工する情報の優先度束)","Consumed artifacts: features/feat-blog-ui-builder.md, features/feat-blog-ui-builder.context.json, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md","Write scope/touches: docs/spec/feat-blog-ui-builder/requirements-baseline.md, docs/spec/feat-blog-ui-builder/screen-inventory.md, docs/spec/feat-blog-ui-builder/information-priority-map.json"]
scope_out: ["feat-blog-ui-builder の scope_out (記事本文のAI生成本体・アフィリエイトURL登録/商品識別・クリック計測分析基盤・管理画面全体の単一用途画面再編・独自ドメイン運用) に該当する変更","makuring.jp の機械取得や文章・素材の複製"]
acceptance: ["Automated commands: `pnpm run typecheck` (要求文書中の information-priority-map.json が既存型契約と矛盾しないことを静的に確認する)","Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` (本 package の C12 決定論検証を世代非依存に再実行する)","Required evidence: P01 の 成果物 section に記載した produced artifacts のパス"]
architecture_refs: ["arch-two-layer-platform"]
parent_feature: "feat-blog-ui-builder"
feature_package_id: "feature-package/feat-blog-ui-builder"
phase_ref: "P01"
file_path: "tasks/feat-blog-ui-builder/sys-blog-ui-builder-p01.md"
template_id: "task"
template_version: "1.1.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-blog-ui-builder/168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48/plan-findings.json"}
source_lineage: {"imported_at":"2026-08-28T13:02:37Z","origin_kind":"system-dev-planner","source_digest":"168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48","source_path":".dev-graph/published/generations/feature-package-feat-blog-ui-builder/168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48/task-specs/phase-01-requirements.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1
classification_reason: "feat-blog-ui-builder の P01 lifecycle 責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-blog-ui-builder/sys-blog-ui-builder-p01.md","confidence":1}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-45ba.1","github_mirror":null,"linked_at":"2026-08-28T13:02:37Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-28T00:00:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: ブログ UI ビルダーの要求ベースライン確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-ui-builder
- owners: ["daishiman"]
- tags: ["p01", "feat-blog-ui-builder"]
- related_nodes: []
- parent_feature: feat-blog-ui-builder
- phase_ref: P01
- classification: confidence=1.0; reason=feat-blog-ui-builder の P01 lifecycle 責務への確定写像; candidate=tasks/feat-blog-ui-builder/sys-blog-ui-builder-p01.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

feat-blog-ui-builder の受入14件 (A1-A14) を実装着手前に一意で検証可能な要求ベースラインへ確定し、テンプレート6種・配色2層・sticky常時表示・固定ページ6種・記事表現ブロック5種・blog_affiliate_placement一覧/逆引き・SEO/AI検索最適化 (JSON-LD/sitemap/robots/llms.txt/IndexNow/guideline_references) の各要求を、既存 src/app/admin/sites 配下と src/app/s/[site] 配下の画面棚卸しに接地させた状態を成立させる。

## 背景

system-spec/ui-ux.md の qa-uiux-web-blog-builder は、ブログごとのテンプレート作成・配色2層・sticky常時表示・固定ページ6種・表現ブロック・アフィリエイト配置管理・SEO/AI検索チェックパネルを利用者本人の回答として確定している。system-spec/frontend.md の qa-frontend-web-seo-ai-search-v2 は、SSRによるJSON-LD自動生成・sitemap/robots/llms.txt・IndexNow・guideline_references を確定している。既存 src/app/admin/sites は単一サイト単位の管理はあるが、ブログ単位のテンプレート/配色/固定ページ/表現ブロック/SEO/AI検索スキーマと画面が存在しないため、本 phase で要求を検証可能な形へ書き下ろし、後続設計の判断根拠にする。参考ブログ (実名は docs/spec/feat-reference-blog-admin-ux/evidence/reference-site-profile.json) は構成・配置・表記法の参照のみに用い、文章・素材・デザインをそのまま複製しない。一次根拠は system-spec/ui-ux.md・frontend.md の qa-* に記録された利用者本人の説明であり、参考ブログ自体の機械取得は行わない (取得拒否済み)。source_feature_digest: sha256:8953a167a43f5fc55998ebfcaa83f437d59f0d567cde6e7c15e8b568ab470d7b

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-ui-builder, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: parent_feature.depends_on all done|closed (P01 claim 時に canonical dev-graph の parent feature が持つ depends_on 全件を都度読み、done|closed のときだけ通す派生 gate。upstream ID を task DAG へ複製しない)
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 既存 src/app/admin/sites・src/app/s/[site] の画面を単一用途の観点で棚卸しし、テンプレート/配色/固定ページ/表現ブロック/SEO-AI検索パネルの画面差分を要求として確定する
- Backend: N/A: API契約設計はP02が所有する
- API: N/A: API契約設計はP02が所有する
- Data: applicable; blog_template/blog_theme/page_theme_override/legal_page/blog_affiliate_placement/guideline_references の参照モデル要求を確定する
- Infrastructure: N/A: 既存 cloudflare-workers-opennext-app デプロイ単位を変更しない
- Security: N/A: 権限要求は既存 admin RBAC の範囲を超えないためP01では扱わない
- Quality: applicable; 受入14件を検証可能な形へ書き下すことを完了条件とする
- Documentation: applicable; 要求ベースライン文書そのものが本 phase の成果物である
- Operations: N/A: 運用手順はP12が所有する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存 src/app/admin/sites 配下画面の新エンティティへの移行はP08が所有する

## 成果物

- Produced artifacts: docs/spec/feat-blog-ui-builder/requirements-baseline.md (A1-A14の検証可能化と参照仕様の対応表); docs/spec/feat-blog-ui-builder/screen-inventory.md (既存 src/app/admin/sites・src/app/s/[site] の棚卸しと新規画面差分); docs/spec/feat-blog-ui-builder/information-priority-map.json (画面別の残す/落とす/加工する情報の優先度束)
- Consumed artifacts: features/feat-blog-ui-builder.md, features/feat-blog-ui-builder.context.json, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Write scope/touches: docs/spec/feat-blog-ui-builder/requirements-baseline.md, docs/spec/feat-blog-ui-builder/screen-inventory.md, docs/spec/feat-blog-ui-builder/information-priority-map.json

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-BLOG-UI-BUILDER-P01; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-BLOG-UI-BUILDER-P01; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-BLOG-UI-BUILDER-P01 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-blog-ui-builder 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-blog-ui-builder の scope_out (記事本文のAI生成本体・アフィリエイトURL登録/商品識別・クリック計測分析基盤・管理画面全体の単一用途画面再編・独自ドメイン運用) に該当する変更
- 参考ブログの機械取得や文章・素材の複製

## テスト戦略

- テストレベル選定: 単体: ユースケース関数・データモデル変換ロジックの単体テストを緑化する。結合: 画面からAPI、APIからD1永続化までの結合テストを緑化する。境界値: サイドバー折りたたみ境界・配色上書き解除時のフォールバック・固定ページ未作成時の空状態・axe-core重大違反0件境界・guideline_references 90日超境界を緑化する。回帰: 既存 tests/ 配下の全テストスイートを0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/presentation/ui, src/app/api/admin, src/application, src/infrastructure/persistence/d1, src/application/seo) に適用する。
- 層別方針: フロントエンド: behavior ベースでテンプレート選択・配色上書き・sticky折りたたみ・表現ブロック差替・SEO/AI標準ブロック挿入の振る舞いを検証する。バックエンド/API/データ: API 契約 + ロジック単体 + DB 結合でCRUDと配置反映・JSON-LD生成・IndexNow送信スキップを検証する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## 完了条件

- docs/spec/feat-blog-ui-builder/requirements-baseline.md に A1-A14 の14件が1対1対応表として記述されている
- docs/spec/feat-blog-ui-builder/screen-inventory.md に既存画面棚卸しと新規差分が記述されている
- docs/spec/feat-blog-ui-builder/information-priority-map.json が機械可読で存在する

## 判定項目

- [ ] requirements-baseline.md に A1-A14 の14件が1対1で記述されている
- [ ] screen-inventory.md が存在しSEO/AI検索パネルの差分を含む
- [ ] information-priority-map.json が valid JSON である
- [ ] `pnpm run typecheck` が合格する

## Verification and evidence

- Automated commands: `pnpm run typecheck` (要求文書中の information-priority-map.json が既存型契約と矛盾しないことを静的に確認する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P01 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: feat-blog-ui-builder の受入14件 (A1-A14) を実装着手前に一意で検証可能な要求ベースラインへ確定し、テンプレート6種・配色2層・sticky常時表示・固定ページ6種・記事表現ブロック5種・blog_affiliate_placement一覧/逆引き・SEO/AI検索最適化の各要求を、既存 src/app/admin/sites 配下と src/app/s/[site] 配下の画面棚卸しに接地させた状態を成立させる。
- Generic execution prompt: feat-blog-ui-builder の goal と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P01 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P01 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P01 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入14件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-blog-ui-builder
- Phase doc: system-plan-phase-names.md#P01
- Dependencies: N/A: P01 は intra-feature 依存を持たない起点 task である
- source_feature_digest: sha256:8953a167a43f5fc55998ebfcaa83f437d59f0d567cde6e7c15e8b568ab470d7b

## 実行契約

- verification: published task spec の Automated commands と Required evidence を全件実行・保存する。
- rerun: current pointer から現行世代を解決する `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` で published task spec と package 全体を再検証する。
