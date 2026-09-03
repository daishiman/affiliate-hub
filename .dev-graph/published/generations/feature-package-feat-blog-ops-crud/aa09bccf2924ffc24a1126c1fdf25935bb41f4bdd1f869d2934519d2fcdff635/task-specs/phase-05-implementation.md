# System task overlay: サイト網・記事CRUD・固定ページ・配信部品・評価機能の実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-ops-crud
- owners: ["daishiman"]
- tags: ["p05", "feat-blog-ops-crud"]
- related_nodes: []
- parent_feature: feat-blog-ops-crud
- phase_ref: P05
- classification: confidence=1.0; reason=feat-blog-ops-crud の P05 lifecycle 責務への確定写像; candidate=tasks/feat-blog-ops-crud/sys-blog-ops-crud-p05.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

受入14件 (A1-A14) に対応する実装 (site-network CRUD、ハブトップ構成、レイアウトスロット、T1-T4記事CRUD、固定ページ8種、ブランドタグ、配信部品9種、評価列+閲覧者評価、監査+edge cache、転用禁止grepゲート) を完了し、P04のテストを緑化した状態を成立させる。

## 背景

既存 src/app/admin/sites は基本CRUDを持つが、サイト網 (site_network)・ハブトップ構成・レイアウトスロット・記事型T1-T4・固定ページ8種・ブランドタグ・配信部品9種・評価機能は未実装である。既存 src/db/schema.ts の articles/legal_pages/tags テーブル、既存 src/presentation/ui/templates・patterns、feat-blog-ui-builderが実装したblog_template/blog_theme/page_theme_override/legal_page(6種)/blog_affiliate_placement を土台に、P02の契約に沿って拡張・新規追加する。参考サイトは docs/spec/13 (抽象ブループリント review-media-classic v1.1) の構成・配置・部品id・件数・順序の参照のみに用い、文章・素材・固有名・色値・テーマ/プラグイン名をそのまま複製しない。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-ops-crud, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md, system-spec/backend.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P05 upstream entry gate: SYS-BLOG-OPS-CRUD-P04 の implementation_readiness=complete
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; サイト網一覧・ハブトップ構成・レイアウト編集・記事CRUD・固定ページ・タグ・評価一覧の管理画面と、T1-T4公開面レンダリングを実装する
- Backend: applicable; site-network CRUD・記事CRUD・固定ページCRUD・配信部品生成・評価集計・監査記録のユースケースを実装する
- API: applicable; src/app/api/admin/site-network, src/app/api/admin/blog 配下に管理APIを実装する
- Data: applicable; src/db/schema.tsへのmigration 0023以降 (site_network拡張・blog_hero_config・blog_layout_config拡張・layout_custom_html・articles拡張・author_profiles・article_block拡張・tags拡張・legal_pages拡張・delivery_snapshots) を実装する
- Infrastructure: N/A: 既存 cloudflare-workers-opennext-app デプロイ単位を変更しない
- Security: applicable; custom-html-slotのサニタイズと既存admin RBAC契約の範囲での権限チェックを実装へ組み込む
- Quality: applicable; P04のテストが緑化することを完了条件とする
- Documentation: N/A: 文書更新はP12/P13が所有する
- Operations: N/A: 運用手順はP12が所有する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md, system-spec/backend.md, docs/spec/13-参考サイト全体構成解析-抽象ブループリント.md, docs/spec/06-サイトブループリント-記事構成テンプレート.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存 articles.status enum との後方互換migrationはP08が所有する

## 成果物

- Produced artifacts: src/app/admin/site-network/ 配下のサイト網CRUD画面; src/app/admin/blog/articles/ 配下のT1-T4記事CRUD画面; src/app/admin/blog/pages/ 配下の固定ページ8種CRUD画面; src/app/admin/blog/tags/ 配下のブランドタグCRUD画面; src/app/admin/blog/evaluate/ 配下の評価一覧画面; src/app/api/admin/site-network・src/app/api/admin/blog 配下の管理API; src/app/s/[site]/ 配下のT1-T4公開面レンダリング・サブサイト別feed/sitemap parts; src/application/usecases・read-models 配下のサイト網/記事/固定ページ/配信部品/評価ユースケース; src/infrastructure/persistence/d1 配下のsite_network/blog_hero_config/blog_layout_config/article_block/legal_pages/delivery_snapshotsリポジトリ; src/db/schema.tsへの拡張とdrizzle/配下のmigration 0023以降; scripts/check-reference-site-reuse.mjs (転用禁止grepゲート)
- Consumed artifacts: docs/spec/feat-blog-ops-crud/data-model.md, docs/spec/feat-blog-ops-crud/api-contract.md, docs/spec/feat-blog-ops-crud/component-contract.md, docs/spec/feat-blog-ops-crud/migration-plan.md, docs/spec/feat-blog-ops-crud/test-design.md
- Write scope/touches: src/app/admin/site-network/, src/app/admin/site-network/[site]/, src/app/admin/site-network/new/, src/app/admin/blog/articles/, src/app/admin/blog/articles/[article]/, src/app/admin/blog/articles/new/, src/app/admin/blog/pages/, src/app/admin/blog/tags/, src/app/admin/blog/evaluate/, src/app/api/admin/site-network/, src/app/api/admin/blog/, src/app/s/[site]/, src/app/s/[site]/best/, src/app/s/[site]/reviews/, src/app/s/[site]/guides/, src/app/s/[site]/feed.xml, src/app/s/[site]/sitemap.xml, src/app/s/[site]/llms.txt, src/presentation/ui/templates/, src/presentation/ui/patterns/, src/application/usecases/, src/application/read-models/, src/infrastructure/persistence/d1/, src/db/schema.ts, drizzle/, scripts/check-reference-site-reuse.mjs

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-BLOG-OPS-CRUD-P05; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-BLOG-OPS-CRUD-P05; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-BLOG-OPS-CRUD-P05 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-blog-ops-crud 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-blog-ops-crud の scope_out に該当する変更
- feat-blog-ui-builder が所有するブログ既定テーマ・ページ単位配色・テンプレート6種選択UIの変更
- feat-site-blueprint が所有するBlueprint複製規則・article_template検証規則そのものの定義変更
- feat-site-builder が所有するブログ作成ウィザードの入口変更
- アフィリエイトURL登録・商品識別・配置逆引き (feat-affiliate-inbox / feat-affiliate-hub)
- write_scope外のパスへの変更

## テスト戦略

- テストレベル選定: 単体: ユースケース関数・データモデル変換ロジック・BP/AT検証ロジックの単体テストを緑化する。結合: 画面からAPI、APIからD1永続化までの結合テストを緑化する。境界値: sister-sites-band の max_items 境界・サイドバー折りたたみ境界・custom-html-slot サニタイズ境界・固定ページ未作成時の空状態・delivery_snapshots 欠落0件境界・axe-core重大違反0件境界を緑化する。回帰: 既存 tests/ 配下の全テストスイートを0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/presentation/ui, src/app/api/admin, src/application, src/infrastructure/persistence/d1) に適用する。
- 層別方針: フロントエンド: behavior ベースでサイト網CRUD・レイアウト編集・記事編集・固定ページ・評価一覧の振る舞いを検証する。バックエンド/API/データ: API 契約 + ロジック単体 + DB 結合でCRUDと配信部品生成を検証する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm test` (P04で設計したテストの緑化を確認する)
- Automated commands: `pnpm run typecheck` (型検査)
- Automated commands: `pnpm run db:generate` (drizzleスキーマ変更からのmigration 0023以降の生成を確認する)
- Automated commands: `node scripts/check-reference-site-reuse.mjs` (転用禁止grepゲートを実行する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ops-crud` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P05 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: 受入14件に対応する実装 (site-network CRUD、ハブトップ構成、レイアウトスロット、T1-T4記事CRUD、固定ページ8種、ブランドタグ、配信部品9種、評価列+閲覧者評価、監査+edge cache、転用禁止grepゲート) を完了し、P04のテストを緑化した状態を成立させる。
- Generic execution prompt: feat-blog-ops-crud の goal (管理画面からサイト網とそのトップ構成・レイアウト・記事 (T1-T4)・固定ページ 8 種・ブランドタグ・配信部品を CRUD でき、一覧で各記事/サイトのブループリント適合・配信健全性・鮮度・閲覧者評価を確認でき、公開面が docs/spec/13 §8 のブループリント・パラメータどおりに描画・配信され、参考サイト固有の文章・素材・固有名・色値を一切含まない状態になっている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P05 の目的を満たす成果物を作らせる。依存順序 (site_network→hub-top layout→layout slots→T1-T4 article CRUD→固定ページ8種→ブランドタグ→配信部品9種→評価列+閲覧者評価→監査+edge cache→転用禁止grepゲート) を守り、既存 src/db/schema.ts の articles/legal_pages/tags テーブルへ後方互換で拡張列を追加する。
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

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md, system-spec/backend.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Blueprint: docs/spec/13-参考サイト全体構成解析-抽象ブループリント.md, docs/spec/06-サイトブループリント-記事構成テンプレート.md
- Feature: feat-blog-ops-crud
- Phase doc: system-plan-phase-names.md#P05
- Dependencies: SYS-BLOG-OPS-CRUD-P04
