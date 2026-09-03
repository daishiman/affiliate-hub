# 実装要件定義書: feat-blog-ui-builder (ブログ UI ビルダー (テンプレート・配色・アフィリエイト配置管理))

> 本書は dev-graph `requirements` verb が確定仕様 (system-spec) と昇格済み feature execution package から導出した実装要件である。実装コードは含まない。実装は `task-graph` build へ handoff する。

## スナップショット

- graph snapshot digest: `sha256:6603c7a9867f573bd27c980e047a15a0858f7e4bf6e07136e2fde8b9208f5231`
- graph revision: 303
- feature package: `feature-package/feat-blog-ui-builder`
- promoted generation digest: `sha256:168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48`
- promoted generation path: `.dev-graph/published/generations/feature-package-feat-blog-ui-builder/168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48`
- handoff target: `task-graph`
- emitted_at: 2026-08-28T13:52:39Z

## 目的と到達状態

- 目的: ブログごとにテンプレートと配色を選び、公開面・作成・保存・管理一覧のどの面でも「どのブログにどのアフィリエイトが載っているか」を迷わず把握できるブログ UI を提供する
- 到達状態: テンプレートから新規ブログを作成でき、配色をブログ既定とページ単位で選べ、ヘッダー・サイドバー・フッターが常時表示され、運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせの固定ページと図解・比較などの表現ブロックを構築でき、公開面/作成/保存/管理一覧の各面でブログ×アフィリエイトの配置が一覧・逆引きできる状態になっている

## スコープ

スコープ内:

- ブログテンプレート (レビュー特化/比較特化/ハウツー/ニュース/ミニマル/ガジェット寄り の 6 種) からのブログ作成と差し替え (system-spec ui-ux §テンプレート)
- 配色の 2 層選択: ブログ既定テーマ (blog_theme) とページ単位上書き (page_theme_override)。decision-ui-theme-implementation (CSS light-dark()+data 属性) に従う
- 常時表示レイアウト: sticky ヘッダー・サイドバー・フッターと、狭幅でのサイドバー折りたたみ
- 固定ページ 6 種の構築 UI: 運営者情報 / 全カテゴリー / サイトポリシー / プライバシーポリシー / 特定商取引法に基づく表記 / お問い合わせ (legal_page)
- 記事表現ブロック: figure (図解) / comparison (比較表) / cta / summary / spec-table と、ガジェット依存部分の差し替え可能なスロット
- ブログ×アフィリエイト配置 (blog_affiliate_placement) の管理一覧・逆引き (アフィリエイト→掲載ブログ/ページ) と、公開面・作成・保存の各面での表示
- 参考ブログ (実名は docs/spec/feat-reference-blog-admin-ux/evidence/reference-site-profile.json) の構成・配置・表記法の参照を反映した情報設計 (丸パクリはしない。利用者説明を一次根拠とする)
- SEO/AI 検索 (AI Overviews・AI Mode・ChatGPT search・Perplexity 等) への最適化: SSR で本文を HTML に含める semantic HTML、robots.txt で AI クローラ許可を既定、ページ種別ごとの JSON-LD (BlogPosting/Person/Organization/BreadcrumbList/FAQPage/HowTo/Product/Review) をブロック木から自動生成、generateMetadata、sitemap.xml/RSS/llms.txt の自動生成、IndexNow 送信、dateModified の可視化 (仕様章 frontend §SEO/AI 検索)
- AI 引用されやすい記事構造の標準ブロック: 結論 (answer) / 要点 (key-points) / FAQ / 出典 (sources) / 最終更新 (freshness) と著者プロフィール固定ページ、管理画面の SEO/AI チェックパネル (仕様章 ui-ux §SEO/AI 検索)
- 最新 SEO/AI 検索ガイドラインの参照レジストリ (guideline_references): 海外・日本の出典 URL・発行元・確認日を登録し 90 日で再確認を促す。fetched-references.json の公式 4 出典 (Google AI 最適化ガイド / AI features / llms.txt / IndexNow) を初期データにする

スコープ外:

- 記事本文の AI 生成そのもの (feat-ai-content-studio)
- アフィリエイト URL の登録・商品識別 (feat-affiliate-inbox / feat-affiliate-hub)
- クリック計測・成果突合の分析基盤 (feat-analytics-insight)
- 管理画面全体の単一用途画面再編 (feat-uiux-overhaul)
- 独自ドメイン・DNS 運用、テーマの外部販売

## 受入条件と実装要件の namespace

- canonical acceptance registry: `features/feat-blog-ui-builder.md#frontmatter.acceptance`
- planner projection: `features/feat-blog-ui-builder.context.json#/acceptance`
- canonical IDs: `A1`–`A14` (配列の 1 始まり順番)
- acceptance source digest: `sha256:fff6f8476b685441d5651c8b2a0952893e91e690e6a66b64dc4e75e001135a2e`
- feature context digest (現行 bytes): `sha256:8953a167a43f5fc55998ebfcaa83f437d59f0d567cde6e7c15e8b568ab470d7b`
- promoted package source feature digest: `sha256:8953a167a43f5fc55998ebfcaa83f437d59f0d567cde6e7c15e8b568ab470d7b` (現行 feature context digest と一致)
- derived implementation requirements: `docs/spec/feat-blog-ui-builder/requirements-baseline.md` (P01 未実施のため未作成)

本書は A1–A14 の文言を複製しない。受入の意味を確認するときは canonical ID と digest を一組で参照する。

## アーキテクチャ参照

- `arch-system-spec-overview` (architecture/system-spec-overview.md)
- `arch-two-layer-platform` (architecture/arch-two-layer-platform.md)

- 仕様正本 (複製せず lineage 参照): `system-spec/ui-ux.md`, `system-spec/frontend.md`, `system-spec/database.md`

## readiness matrix

| node | kind | confirmation | evaluation | readiness | missing sections |
|---|---|---|---|---|---|
| `arch-system-spec-overview` | architecture | confirmed | pass | complete | なし |
| `arch-two-layer-platform` | architecture | confirmed | pass | complete | なし |
| `feat-blog-ui-builder` | feature | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P01` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P02` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P03` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P04` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P05` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P06` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P07` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P08` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P09` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P10` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P11` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P12` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P13` | task | confirmed | pass | complete | なし |

## 実行タスク (exact 13)

| phase | node | title | file | resource_scope |
|---|---|---|---|---|
| P01 | `SYS-BLOG-UI-BUILDER-P01` | ブログ UI ビルダーの要求ベースライン確定 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p01.md` | docs/spec/feat-blog-ui-builder/requirements-baseline.md, docs/spec/feat-blog-ui-builder/screen-inventory.md, docs/spec/feat-blog-ui-builder/information-priority-map.json |
| P02 | `SYS-BLOG-UI-BUILDER-P02` | データモデル・テーマ契約・コンポーネント契約・管理API契約・SEO/AI検索契約の設計 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p02.md` | docs/spec/feat-blog-ui-builder/data-model.md, docs/spec/feat-blog-ui-builder/theme-contract.md, docs/spec/feat-blog-ui-builder/component-contract.md, docs/spec/feat-blog-ui-builder/admin-api-contract.md, docs/spec/feat-blog-ui-builder/seo-ai-search-contract.md |
| P03 | `SYS-BLOG-UI-BUILDER-P03` | 設計レビューと参照妥当性・テーマ一貫性・SEO/AI検索設計の独立検証 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p03.md` | docs/spec/feat-blog-ui-builder/design-review.md |
| P04 | `SYS-BLOG-UI-BUILDER-P04` | 受入14件に対応するテスト設計 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p04.md` | docs/spec/feat-blog-ui-builder/test-design.md, tests/ui/, tests/application/, tests/infrastructure/ |
| P05 | `SYS-BLOG-UI-BUILDER-P05` | テンプレート・配色2層・sticky常時表示・固定ページ・表現ブロック・配置管理・SEO/AI検索の実装 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p05.md` | src/app/admin/sites/, src/app/admin/sites/new/, src/app/admin/settings/seo/, src/app/api/admin/, src/presentation/ui/templates/, src/presentation/ui/patterns/, src/presentation/ui/tokens.css, src/app/s/[site]/, src/application/usecases/, src/application/read-models/, src/application/seo/, src/application/ports/, src/infrastructure/persistence/d1/, src/db/schema.ts, drizzle/ |
| P06 | `SYS-BLOG-UI-BUILDER-P06` | テスト全量実行と回帰0件の確認 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p06.md` | docs/spec/feat-blog-ui-builder/test-run-report.md |
| P07 | `SYS-BLOG-UI-BUILDER-P07` | 受入14件の受け入れ判定 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p07.md` | docs/spec/feat-blog-ui-builder/acceptance-report.md |
| P08 | `SYS-BLOG-UI-BUILDER-P08` | 既存サイト管理画面の新エンティティへの移行と重複実装の解消 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p08.md` | src/app/admin/sites/, src/app/admin/sites/[site]/, src/presentation/ui/templates/, docs/spec/feat-blog-ui-builder/migration-report.md |
| P09 | `SYS-BLOG-UI-BUILDER-P09` | 品質保証とアクセシビリティ・非機能検査 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p09.md` | docs/spec/feat-blog-ui-builder/quality-report.md |
| P10 | `SYS-BLOG-UI-BUILDER-P10` | 最終レビューと残課題の確定 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p10.md` | docs/spec/feat-blog-ui-builder/final-review.md |
| P11 | `SYS-BLOG-UI-BUILDER-P11` | 受入・品質証跡の集約と検証可能性の確保 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p11.md` | docs/spec/feat-blog-ui-builder/evidence/ |
| P12 | `SYS-BLOG-UI-BUILDER-P12` | UI規則・SEO/AI検索運用規則と運用手順の文書化 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p12.md` | docs/spec/feat-blog-ui-builder/ui-rules.md, docs/spec/feat-blog-ui-builder/operations.md |
| P13 | `SYS-BLOG-UI-BUILDER-P13` | 開発環境へのリリースとsystem-specへの書き戻し | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p13.md` | docs/spec/feat-blog-ui-builder/release-report.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md |

## 機能内依存 (前方 DAG)

- `SYS-BLOG-UI-BUILDER-P01` ← (entry)
- `SYS-BLOG-UI-BUILDER-P02` ← `SYS-BLOG-UI-BUILDER-P01`
- `SYS-BLOG-UI-BUILDER-P03` ← `SYS-BLOG-UI-BUILDER-P02`
- `SYS-BLOG-UI-BUILDER-P04` ← `SYS-BLOG-UI-BUILDER-P03`
- `SYS-BLOG-UI-BUILDER-P05` ← `SYS-BLOG-UI-BUILDER-P04`
- `SYS-BLOG-UI-BUILDER-P06` ← `SYS-BLOG-UI-BUILDER-P05`
- `SYS-BLOG-UI-BUILDER-P07` ← `SYS-BLOG-UI-BUILDER-P06`
- `SYS-BLOG-UI-BUILDER-P08` ← `SYS-BLOG-UI-BUILDER-P05`
- `SYS-BLOG-UI-BUILDER-P09` ← `SYS-BLOG-UI-BUILDER-P08`
- `SYS-BLOG-UI-BUILDER-P10` ← `SYS-BLOG-UI-BUILDER-P09`
- `SYS-BLOG-UI-BUILDER-P11` ← `SYS-BLOG-UI-BUILDER-P07`, `SYS-BLOG-UI-BUILDER-P09`
- `SYS-BLOG-UI-BUILDER-P12` ← `SYS-BLOG-UI-BUILDER-P10`, `SYS-BLOG-UI-BUILDER-P11`
- `SYS-BLOG-UI-BUILDER-P13` ← `SYS-BLOG-UI-BUILDER-P12`

## 機能間依存 (entry gate)

- `feat-blog-ui-builder` depends_on: `feat-ui-foundation`, `feat-site-builder`, `feat-affiliate-hub`
- `p01_entry_gate`: `parent_feature.depends_on` の全 node が `done|closed` であること。P01 着手時に dev-graph scheduler が派生判定し、機能間依存を task DAG へ複製しない

## SEO/AI 検索の要件範囲

受入 A10–A14 と scope_in の 3 項目 (SEO/AI 検索最適化・AI 引用構造・ガイドライン参照レジストリ) が本 feature の SEO/AI 検索要件を構成する。P02 で `seo-ai-search-contract.md` を設計し、P03 で独立検証、P05 で実装、P07/P09 で受入判定と品質検査、P12 で運用規則を文書化する流れになっている。

## 世代非依存 validator command

本 package の C12 決定論検証を再実行するコマンド:

```bash
python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py \
  --repo-root . --feature-package feature-package/feat-blog-ui-builder
```

## gate 実行結果

- C11_validate_graph_schema: `{"command": "validate-graph-schema.py --graph .dev-graph/state/graph.json --repo-root .", "exit": 0, "valid": true, "violations": 0}`
- C02_saved_state: `{"implementation_readiness": "complete", "evaluation_status": "pass", "confirmation_status": "confirmed", "scope": "closure 16 node"}`
- source_digest: `{"command": "validate-source-digest.py --repo-root . --registered <lineage closure 16 node>", "exit": 0, "checked": 16, "registered_mismatch": 0}`
- validate_system_plan: `{"command": "validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder", "exit": 0, "status": "pass", "violations": 0, "validated_digest": "sha256:168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48"}`

## handoff

- handoff file: `.dev-graph/handoff/task-graph/feat-blog-ui-builder.json`
- promoted generation: `.dev-graph/published/generations/feature-package-feat-blog-ui-builder/168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48`
- 実装コード生成: 0 件 (本 verb は要件導出まで)

## 実装着手時の不変条件

- 各 task は `tasks/feat-blog-ui-builder/*.md` の write scope 内でのみ変更し、`feat-uiux-overhaul` が所有する管理画面全体の再編には踏み込まない (evaluator medium finding C1-scope-boundary)
- 参考ブログ (実名は docs/spec/feat-reference-blog-admin-ux/evidence/reference-site-profile.json) は構成・配置・表記法の参考に留め、デザイン・文言の複製をしない
- worktree lease は `dev-graph worktree claim` 経由でのみ取得し、1 task 1 branch を守る
