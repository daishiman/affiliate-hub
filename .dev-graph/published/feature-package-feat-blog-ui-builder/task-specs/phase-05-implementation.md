# System task overlay: テンプレート・配色2層・sticky常時表示・固定ページ・表現ブロック・配置管理の実装

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

受入9件 (A1-A9) に対応する実装 (テンプレート6種からのブログ作成・差替、配色2層のlight-dark()実装、sticky header/sidebar/footerと狭幅折りたたみ、固定ページ6種の構築UI、記事表現ブロック5種+スロット差替、blog_affiliate_placementの管理一覧・逆引きと公開/作成/保存各面での表示、D1永続化) を完了し、P04のテストを緑化した状態を成立させる。

## 背景

既存 src/app/admin/sites はサイト単位の基本CRUDを持つが、ブログ単位のテンプレート/配色2層/固定ページ/表現ブロック/アフィリエイト配置は未実装である。既存 src/presentation/ui/templates (app-shell.tsx, site-shell.tsx等)、src/presentation/ui/patterns (appearance-picker.tsx, comparison-table.tsx等) を土台に、P02の契約に沿って拡張・新規追加する。既存 scripts/scaffold-blog-components.ts を配色/テンプレートのscaffold用途で再利用または拡張する。参考ブログ (makuring.jp) は構成・配置・表記法の参照のみに用い、文章・素材・デザインをそのまま複製しない。一次根拠は system-spec/ui-ux.md の qa-uiux-web-blog-builder に記録された利用者本人の説明であり、makuring.jp 自体の機械取得は行わない (取得拒否済み)。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-ui-builder, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P05 upstream entry gate: SYS-BLOG-UI-BUILDER-P04 の implementation_readiness=complete
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; sticky header/sidebar/footer・テンプレート選択UI・記事表現ブロック5種・スロット差替を実装する
- Backend: applicable; ブログ作成・配色設定・固定ページ・配置管理のユースケースを実装する
- API: applicable; src/app/api/admin配下に管理APIを実装する
- Data: applicable; src/db/schema.tsへの5エンティティ追加とdrizzle-kit generateによるマイグレーションを実装する
- Infrastructure: N/A: 既存 cloudflare-workers-opennext-app デプロイ単位を変更しない
- Security: applicable; 既存 admin RBAC 契約の範囲で権限チェックを実装へ組み込む
- Quality: applicable; P04のテストが緑化することを完了条件とする
- Documentation: N/A: 文書更新はP12/P13が所有する
- Operations: N/A: 運用手順はP12が所有する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存 src/app/admin/sites 配下画面の新エンティティへの移行はP08が所有する

## 成果物

- Produced artifacts: src/app/admin/sites/ 配下のブログテンプレート選択・配色設定・固定ページ編集・アフィリエイト配置一覧画面; src/app/api/admin/ 配下のテンプレート/配色/固定ページ/配置のCRUD+逆引きAPI; src/presentation/ui/templates・patterns 配下のsticky layout・記事表現ブロック5種・スロット差替コンポーネント; src/app/s/[site]/ 配下の固定ページ6種の公開面ルートと配色反映; src/application/usecases・read-models 配下のブログ作成/配色設定/配置管理ユースケース; src/infrastructure/persistence/d1 配下のblog_template/blog_theme/page_theme_override/legal_page/blog_affiliate_placementリポジトリ; src/db/schema.ts への5エンティティ追加とdrizzle/配下のマイグレーション
- Consumed artifacts: docs/spec/feat-blog-ui-builder/data-model.md, docs/spec/feat-blog-ui-builder/theme-contract.md, docs/spec/feat-blog-ui-builder/component-contract.md, docs/spec/feat-blog-ui-builder/admin-api-contract.md, docs/spec/feat-blog-ui-builder/test-design.md
- Write scope/touches: src/app/admin/sites/, src/app/admin/sites/new/, src/app/api/admin/, src/presentation/ui/templates/, src/presentation/ui/patterns/, src/presentation/ui/tokens.css, src/app/s/[site]/, src/application/usecases/, src/application/read-models/, src/infrastructure/persistence/d1/, src/db/schema.ts, drizzle/

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

- テストレベル選定: 単体: ユースケース関数・データモデル変換ロジックの単体テストを緑化する。結合: 画面からAPI、APIからD1永続化までの結合テストを緑化する。境界値: サイドバー折りたたみ境界・配色上書き解除時のフォールバック・固定ページ未作成時の空状態・axe-core重大違反0件境界を緑化する。回帰: 既存 tests/ 配下の全テストスイートを0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/presentation/ui, src/app/api/admin, src/application, src/infrastructure/persistence/d1) に適用する。
- 層別方針: フロントエンド: behavior ベースでテンプレート選択・配色上書き・sticky折りたたみ・表現ブロック差替の振る舞いを検証する。バックエンド/API/データ: API 契約 + ロジック単体 + DB 結合でCRUDと配置反映を検証する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm test` (P04で設計したテストの緑化を確認する)
- Automated commands: `pnpm run typecheck` (型検査)
- Automated commands: `pnpm run db:generate` (drizzleスキーマ変更からのマイグレーション生成を確認する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P05 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: 受入9件 (A1-A9) に対応する実装 (テンプレート6種からのブログ作成・差替、配色2層のlight-dark()実装、sticky header/sidebar/footerと狭幅折りたたみ、固定ページ6種の構築UI、記事表現ブロック5種+スロット差替、blog_affiliate_placementの管理一覧・逆引きと公開/作成/保存各面での表示、D1永続化) を完了し、P04のテストを緑化した状態を成立させる。
- Generic execution prompt: feat-blog-ui-builder の goal (テンプレートから新規ブログを作成でき、配色をブログ既定とページ単位で選べ、ヘッダー・サイドバー・フッターが常時表示され、運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせの固定ページと図解・比較などの表現ブロックを構築でき、公開面/作成/保存/管理一覧の各面でブログ×アフィリエイトの配置が一覧・逆引きできる状態になっている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P05 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P05 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P05 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入9件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-blog-ui-builder
- Phase doc: system-plan-phase-names.md#P05
- Dependencies: SYS-BLOG-UI-BUILDER-P04
