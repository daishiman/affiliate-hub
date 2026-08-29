

# 目的

ブログごとにテンプレートと配色を選び、公開面・作成・保存・管理一覧のどの面でも「どのブログにどのアフィリエイトが載っているか」を迷わず把握できるブログ UI を提供する

## 到達状態

テンプレートから新規ブログを作成でき、配色をブログ既定とページ単位で選べ、ヘッダー・サイドバー・フッターが常時表示され、運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせの固定ページと図解・比較などの表現ブロックを構築でき、公開面/作成/保存/管理一覧の各面でブログ×アフィリエイトの配置が一覧・逆引きできる状態になっている

## スコープ

- スコープ内:
  - ブログテンプレート (レビュー特化/比較特化/ハウツー/ニュース/ミニマル/ガジェット寄り の 6 種) からのブログ作成と差し替え (system-spec ui-ux §テンプレート)
  - 配色の 2 層選択: ブログ既定テーマ (blog_theme) とページ単位上書き (page_theme_override)。decision-ui-theme-implementation (CSS light-dark()+data 属性) に従う
  - 常時表示レイアウト: sticky ヘッダー・サイドバー・フッターと、狭幅でのサイドバー折りたたみ
  - 固定ページ 6 種の構築 UI: 運営者情報 / 全カテゴリー / サイトポリシー / プライバシーポリシー / 特定商取引法に基づく表記 / お問い合わせ (legal_page)
  - 記事表現ブロック: figure (図解) / comparison (比較表) / cta / summary / spec-table と、ガジェット依存部分の差し替え可能なスロット
  - ブログ×アフィリエイト配置 (blog_affiliate_placement) の管理一覧・逆引き (アフィリエイト→掲載ブログ/ページ) と、公開面・作成・保存の各面での表示
  - 参考ブログ (makuring.jp) の構成・配置・表記法の参照を反映した情報設計 (丸パクリはしない。利用者説明を一次根拠とする)
- スコープ外:
  - 記事本文の AI 生成そのもの (feat-ai-content-studio)
  - アフィリエイト URL の登録・商品識別 (feat-affiliate-inbox / feat-affiliate-hub)
  - クリック計測・成果突合の分析基盤 (feat-analytics-insight)
  - 管理画面全体の単一用途画面再編 (feat-uiux-overhaul)
  - 独自ドメイン・DNS 運用、テーマの外部販売

## 受入正本レジストリ

- canonical source: `features/feat-blog-ui-builder.md#frontmatter.acceptance`
- planner projection: `features/feat-blog-ui-builder.context.json#/acceptance`
- ID mapping: 配列の 1 始まり順番を `A1` 〜 `A14` に対応させる
- acceptance source digest: `sha256:fff6f8476b685441d5651c8b2a0952893e91e690e6a66b64dc4e75e001135a2e`
- feature context digest (現行 bytes): `sha256:8953a167a43f5fc55998ebfcaa83f437d59f0d567cde6e7c15e8b568ab470d7b`
- 既知のずれ: `.dev-graph/published/feature-package-feat-blog-ui-builder/feature-package.json#/source_feature_digest` は `sha256:50ca9e4e…` のまま。これは A10–A14 を足す前の世代の指紋であり、その世代の中では自己整合している。published 世代は履歴なので書き換えない。整合は planner の再 promotion でのみ回復する。

A1–A14 の文言は frontmatter にのみ保持する。実装要件・タスク仕様書・証跡は canonical ID と
上記 digest を参照し、同じ ID に別の文言を与えない。2026-08-24 の初回計画時点では canonical ID が A9 までしか
無く、SEO / AI 検索の A10–A14 は context にしか無い状態で分裂していた（`ah-6lf.1`）。
数を文章へ書き写さないのは、その再発を止めるためである。
一致は `tests/architecture/blog-ui-spec-governance.test.ts` が機械で見る。

## MVP スライス（2026-08-24）

本 PR で届けるのは SEO / AI 検索の土台だけ。受入全件は未充足のまま。到達したもの:

- 公開ブログの sitemap / robots / RSS / llms.txt と IndexNow 鍵ファイル
- 記事ページの JSON-LD（BlogPosting / BreadcrumbList / 順位記事の ItemList）と generateMetadata
- 公開後の AI 検索点検（公開の条件ではない。`ah-6lf.6`）
- 指針レジストリ画面（`/admin/settings/seo`）と 90 日再確認
- ブログ UI 用 6 テーブルの migration。指針以外は usecase 未接続（`ah-6lf.4`）

詳細: `docs/spec/feat-blog-ui-builder/final-review.md`、受領: `docs/spec/feat-blog-ui-builder/spec-writeback-receipt.md`

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview, arch-two-layer-platform
- 参照理由: 読者面 (公開ブログ) と運営者面 (作成・保存・管理一覧) の二層境界に従い、本 feature は両面の UI と、その配置データ (blog_template / blog_theme / page_theme_override / legal_page / blog_affiliate_placement) を扱う。仕様本文は system-spec の確定章 (ui-ux / frontend / database、qa-*-web-blog-builder) を lineage 参照し複製しない

## 機能間依存

- `depends_on`: feat-ui-foundation, feat-site-builder, feat-affiliate-hub
- 依存理由: 共通レイアウト・状態表現 (feat-ui-foundation) の上に sticky レイアウトとテーマを載せる。ブログ作成ウィザードとページ/ポリシーページ生成 (feat-site-builder) を入口として、テンプレート選択と固定ページ構築を拡張する。アフィリエイト配置の管理・逆引きは、アフィリエイト実体と広告表示ルール (feat-affiliate-hub) のデータモデルに依存する

## Handoff

- per-feature planning: 依存が満たされた時点で system-dev-planner (`run-system-dev-plan --feature-id feat-blog-ui-builder --feature-context features/feat-blog-ui-builder.context.json`) へ渡し、P01..P13 exact 13 の実行タスク仕様書を得る
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature`/`feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入 A1–A14 を満たすときだけ done とする
