# 実装要件定義書: feat-blog-ops-crud (ブログ運用 CRUD とサイト網ブループリント再現 (作成者面・閲覧者面))

> 本書は dev-graph `requirements` verb が確定仕様 (system-spec) と昇格済み feature execution package から導出した実装要件である。実装コードは含まない。実装は `task-graph` build へ handoff する。

## スナップショット

- graph snapshot digest: `sha256:486284b5bb0a37f5937ae45c1d08afb33c351dcc3c6165654076e5b70ab53997`
- graph revision: 268
- feature package: `feature-package/feat-blog-ops-crud`
- promoted generation digest: `sha256:aa09bccf2924ffc24a1126c1fdf25935bb41f4bdd1f869d2934519d2fcdff635`
- promoted generation path: `.dev-graph/published/generations/feature-package-feat-blog-ops-crud/aa09bccf2924ffc24a1126c1fdf25935bb41f4bdd1f869d2934519d2fcdff635`
- handoff target: `task-graph`
- emitted_at: 2026-08-25T14:10:00Z

## 目的と到達状態

- 目的: 発信者がサイト網 (ハブ + サブサイト + ミニサイト) と記事・固定ページ・タグ・配信部品を一つの管理面で作成・一覧・編集・削除・評価でき、閲覧者には抽象ブループリント review-media-classic v1.1 の構成 (ヘッダー・ヒーロー・2 カラム記事・追従サイドバー・3 層フッター・記事型 T1-T4) で再現された公開面を届ける
- 到達状態: 管理画面からサイト網とそのトップ構成・レイアウト・記事 (T1-T4)・固定ページ 8 種・ブランドタグ・配信部品を CRUD でき、一覧で各記事/サイトのブループリント適合・配信健全性・鮮度・閲覧者評価を確認でき、公開面が docs/spec/13 §8 のブループリント・パラメータどおりに描画・配信され、参考サイト固有の文章・素材・固有名・色値を一切含まない状態になっている

## スコープ

スコープ内:

- サイト網 (site_network) の CRUD: ハブ 1 + サブサイト n (path_prefix / 独自カテゴリ木 / 独自 feed / 独自サイドバー / 運営者情報) + ミニサイト (dictionary / navigator / shop) の作成・一覧・編集・論理削除・復元・複製 (sites 拡張 network_id / network_role / path_prefix / mini_kind)
- ハブトップの構成編集 (blog_hero_config): hero-banner / latest-posts-band / sister-sites-band (max_items) / category-hub-grid / navigator-band
- レイアウト編集 (blog_layout_config): header 3 部品、sidebar 通常 8 + 追従 2 (sticky-promo-slot / sticky-toc)、footer 4 部品のスロット配列と custom-html-slot ×2 (サニタイズ済み HTML)
- 記事 CRUD: 記事型 T1 まとめ / T2 単品レビュー / T3 ガイド / T4 ハブ の article_template と題名規則、本文部品列 (breadcrumb → article-title → article-meta → featured-image → disclosure-notice → intro-box → hierarchical-toc → editor-credential-box → body-blocks → comment-form → prev-next)、product-card の 3 箇所再掲、emphasis-box、下書き→公開→論理削除の状態遷移
- 固定ページ 8 種 (profile / sitemap / site-policy / privacy-policy / commercial-transaction / contact / review-guidelines / company) の CRUD と legal-nav / footer への自動反映 (legal_pages.kind)
- タグをブランド軸として扱う (tags.kind=brand): タグ CRUD、タグ一覧ページ、サイドバー brand-tag-cloud
- 配信部品の必須出力と記録 (delivery_snapshots): canonical / og-twitter-meta / jsonld-website・article・collection / rss-feeds (網 + 各サイト) / sitemap-index + parts / llms-txt / robots
- 運用評価 (evaluate): 一覧画面の評価列 = ブループリント適合 (BP-01..06 / AT-01..05)・配信健全性 (delivery 欠落 0)・鮮度と、閲覧者の記事評価 (役に立った / コメント) の受付・管理側一覧・非表示
- 閲覧者面: T1-T4 の公開レンダリング、パンくず、前後記事、追従サイドバー、狭幅折りたたみ、サブサイト別 feed / sitemap parts
- 運用イベントの監査記録と公開面 edge cache (TTL 10 分) の失効
- 転用禁止ゲート: 参考サイト固有の文章・画像・固有名・色値・テーマ名がコード / seed / docs / spec に 0 件であることを CI で検査

スコープ外:

- ブログ既定テーマ・ページ単位配色・テンプレート 6 種の選択 UI と SEO/AI 検索土台の初期実装 (feat-blog-ui-builder)
- Blueprint の複製規則・article_template の検証規則そのものの定義 (feat-site-blueprint)
- ブログ作成ウィザードの入口 (feat-site-builder)
- 記事本文の AI 生成 (feat-ai-content-studio)
- アフィリエイト URL 登録・商品識別・配置逆引き (feat-affiliate-inbox / feat-affiliate-hub / feat-blog-ui-builder)
- クリック計測・成果突合 (feat-analytics-insight)
- 参考サイトの文章・画像・固有名・色値・テーマ/プラグイン名の転用
- 独自ドメイン・DNS 運用

## 受入条件と実装要件の namespace

- canonical acceptance registry: `features/feat-blog-ops-crud.md#frontmatter.acceptance`
- planner projection: `features/feat-blog-ops-crud.context.json#/acceptance`
- canonical IDs: `A1`–`A14` (配列の 1 始まり順番)
- acceptance source digest: `sha256:7d03855a6d54fdd216e92734e92d4ff5e6baf89dd094c6a4fcd9904c515603e5`
- derived implementation requirements: `docs/spec/feat-blog-ops-crud/requirements-baseline.md` の `REQ-BOPS01`–`REQ-BOPS14`

本書は A1–A14 の文言を複製しない。受入の意味を確認するときは canonical ID と digest を一組で参照し、設計・実装上の分解条件は `REQ-BOPSxx` で識別する。

## アーキテクチャ参照

- `arch-system-spec-overview` (architecture/system-spec-overview.md)
- `arch-two-layer-platform` (architecture/arch-two-layer-platform.md)
- 仕様正本 (複製せず lineage 参照): `system-spec/ui-ux.md`, `system-spec/frontend.md`, `system-spec/database.md`, `system-spec/backend.md`, `docs/spec/13-参考サイト全体構成解析-抽象ブループリント.md` (抽象ブループリント review-media-classic v1.1)

## 依存 feature (graph depends_on)

- `feat-blog-ui-builder` (confirmed / pass): テーマ・テンプレート選択 UI と SEO 土台を所有。共有インフラ層 (schema / migrations) は本 feature の P08 で重複解消
- `feat-site-blueprint` (confirmed / pass): 複製規則・検証規則の定義を所有
- `feat-site-builder` (confirmed / pass): ブログ作成ウィザード入口を所有

## 実行パッケージ (P01-P13)

昇格済み package `feature-package/feat-blog-ops-crud` の 13 task を graph 登録し task-graph build が実行する。現行 DAG: P01→P02→P03→P04→P05→{P06→P07, P08→P09}、P07+P09→{P10,P11}、P10+P11→P12→P13。published generation は監査履歴として保持し、現行 graph の P10 edge を正本とする。

| phase | graph_node_id | 内容 |
|---|---|---|
| P01 | SYS-BLOG-OPS-CRUD-P01 | サイト網ブログ運用 CRUD の要求ベースライン確定 |
| P02 | SYS-BLOG-OPS-CRUD-P02 | データモデルと API 契約の設計 |
| P03 | SYS-BLOG-OPS-CRUD-P03 | 設計レビューと BP/AT 整合確認 |
| P04 | SYS-BLOG-OPS-CRUD-P04 | テスト設計 |
| P05 | SYS-BLOG-OPS-CRUD-P05 | サイト網・記事 CRUD・固定ページ・配信部品・評価機能の実装 |
| P06 | SYS-BLOG-OPS-CRUD-P06 | テスト実行と緑化 |
| P07 | SYS-BLOG-OPS-CRUD-P07 | 受入 14 件 (A1-A14) の受入検証 |
| P08 | SYS-BLOG-OPS-CRUD-P08 | 既存 articles スキーマ・admin/content 系画面との重複解消と移行 |
| P09 | SYS-BLOG-OPS-CRUD-P09 | 品質保証 (アクセシビリティ・回帰・転用禁止ゲート独立検査) |
| P10 | SYS-BLOG-OPS-CRUD-P10 | 最終レビューと promotion 可否判定 |
| P11 | SYS-BLOG-OPS-CRUD-P11 | 受入・QA 証跡の集約 |
| P12 | SYS-BLOG-OPS-CRUD-P12 | 運用文書・API/コンポーネント文書の確定 |
| P13 | SYS-BLOG-OPS-CRUD-P13 | 開発環境へのリリースと system-spec への書き戻し |

## readiness matrix

| node | specification confirmation | plan evaluation | implementation readiness | execution completion |
|---|---|---|---|---|
| feat-blog-ops-crud | confirmed | pass | complete | **in_progress** |
| arch-system-spec-overview | confirmed | pass | complete | N/A |
| arch-two-layer-platform | confirmed | pass | complete | N/A |
| feat-blog-ui-builder (依存) | confirmed | pass | complete | graph正本を参照 |
| feat-site-blueprint (依存) | confirmed | pass | complete | graph正本を参照 |
| feat-site-builder (依存) | confirmed | pass | complete | graph正本を参照 |
| SYS-BLOG-OPS-CRUD-P01..P13 | confirmed | pass | complete | **in_progress** |

`implementation_readiness=complete` は「実行できる仕様が揃った」を表し、実装・検証・promotion の完了を表さない。完了判定は graph の `completion_evidence.status` だけを使う。

## 検証ゲート (三 gate 同一時点)

- C11 `validate-graph-schema.py --graph .dev-graph/state/graph.json --repo-root .`: valid=true, violations=0
- C02 saved state: feat-blog-ops-crud = confirmed / pass / readiness complete, source_digest `7b029152ed5130b0c3e331bb390f3f344811fc97f9cb92b9f0b3557d9a9b54c1`
- `validate-system-plan.py --repo-root . --staging <promoted generation>`: status=pass, validated_digest `sha256:aa09bccf2924ffc24a1126c1fdf25935bb41f4bdd1f869d2934519d2fcdff635`, violations=0
- 独立評価 (system-dev-plan-evaluator fork): C1-C4 すべて PASS (`.dev-graph/cache/plan-findings-feat-blog-ops-crud.json`)

## 制約・注意 (task-graph build への引き継ぎ)

- 参考サイトの文章・画像・固有名・色値・テーマ/プラグイン名は転用禁止。仕様・コード・seed のどこにも書かない (「参考サイト」または `review-media-classic` の抽象名で参照する)。
- 新規テーブル migration は 0023 以降を使用し、P08 で feat-blog-ui-builder 側 migration との番号衝突がないことを確認する (評価 fork の low finding)。
- 実装は Next.js App Router + Cloudflare Workers/OpenNext + D1/Drizzle + Better Auth の既存スタックに従う。`node_modules/next/dist/docs` を実装前に参照する。
- 本書自体は実装コードを含まない。実装成果は各 task spec の Verification and evidence 節に従って記録する。
