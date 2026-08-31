---
graph_node_id: "feat-blog-ui-builder"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["blog","ui-ux","template","theme","affiliate-placement","reader-surface"]
priority: "high"
start_date: "2026-08-24"
target_date: null
iteration: null
title: "ブログ UI ビルダー (テンプレート・配色・アフィリエイト配置管理)"
owners: ["daishiman"]
created_at: "2026-08-24T02:20:00Z"
updated_at: "2026-08-29T23:07:00.498916Z"
status: "active"
depends_on: ["feat-ui-foundation","feat-site-builder","feat-affiliate-hub"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "ブログごとにテンプレートと配色を選び、公開面・作成・保存・管理一覧のどの面でも「どのブログにどのアフィリエイトが載っているか」を迷わず把握できるブログ UI を提供する"
goal: "テンプレートから新規ブログを作成でき、配色をブログ既定とページ単位で選べ、ヘッダー・サイドバー・フッターが常時表示され、運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせの固定ページと図解・比較などの表現ブロックを構築でき、公開面/作成/保存/管理一覧の各面でブログ×アフィリエイトの配置が一覧・逆引きできる状態になっている"
scope_in: ["ブログテンプレート (レビュー特化/比較特化/ハウツー/ニュース/ミニマル/ガジェット寄り の 6 種) からのブログ作成と差し替え (system-spec ui-ux §テンプレート)","配色の 2 層選択: ブログ既定テーマ (blog_theme) とページ単位上書き (page_theme_override)。decision-ui-theme-implementation (CSS light-dark()+data 属性) に従う","常時表示レイアウト: sticky ヘッダー・サイドバー・フッターと、狭幅でのサイドバー折りたたみ","固定ページ 6 種の構築 UI: 運営者情報 / 全カテゴリー / サイトポリシー / プライバシーポリシー / 特定商取引法に基づく表記 / お問い合わせ (legal_page)","記事表現ブロック: figure (図解) / comparison (比較表) / cta / summary / spec-table と、ガジェット依存部分の差し替え可能なスロット","ブログ×アフィリエイト配置 (blog_affiliate_placement) の管理一覧・逆引き (アフィリエイト→掲載ブログ/ページ) と、公開面・作成・保存の各面での表示","参考ブログ (makuring.jp) の構成・配置・表記法の参照を反映した情報設計 (丸パクリはしない。利用者説明を一次根拠とする)","SEO/AI 検索 (AI Overviews・AI Mode・ChatGPT search・Perplexity 等) への最適化: SSR で本文を HTML に含める semantic HTML、robots.txt で AI クローラ許可を既定、ページ種別ごとの JSON-LD (BlogPosting/Person/Organization/BreadcrumbList/FAQPage/HowTo/Product/Review) をブロック木から自動生成、generateMetadata、sitemap.xml/RSS/llms.txt の自動生成、IndexNow 送信、dateModified の可視化 (仕様章 frontend §SEO/AI 検索)","AI 引用されやすい記事構造の標準ブロック: 結論 (answer) / 要点 (key-points) / FAQ / 出典 (sources) / 最終更新 (freshness) と著者プロフィール固定ページ、管理画面の SEO/AI チェックパネル (仕様章 ui-ux §SEO/AI 検索)","最新 SEO/AI 検索ガイドラインの参照レジストリ (guideline_references): 海外・日本の出典 URL・発行元・確認日を登録し 90 日で再確認を促す。fetched-references.json の公式 4 出典 (Google AI 最適化ガイド / AI features / llms.txt / IndexNow) を初期データにする"]
scope_out: ["記事本文の AI 生成そのもの (feat-ai-content-studio)","アフィリエイト URL の登録・商品識別 (feat-affiliate-inbox / feat-affiliate-hub)","クリック計測・成果突合の分析基盤 (feat-analytics-insight)","管理画面全体の単一用途画面再編 (feat-uiux-overhaul)","独自ドメイン・DNS 運用、テーマの外部販売"]
acceptance: ["テンプレート 6 種のいずれかを選んで新規ブログを作成でき、作成後もテンプレートを差し替えても既存記事が壊れない","ブログ既定の配色を選べ、任意のページで配色を上書きでき、上書きを外すとブログ既定に戻る","公開面でヘッダー・サイドバー・フッターがスクロール中も常時表示され、狭幅ではサイドバーが折りたたまれる","運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせの 6 ページを管理画面から作成・編集・公開できる","記事内で図解・比較表・CTA・要約・スペック表のブロックを挿入でき、ガジェット依存部分はスロット差し替えで別カテゴリでも再利用できる","管理一覧でブログごとの掲載アフィリエイトが一覧でき、アフィリエイトから掲載ブログ/ページへ逆引きできる","作成・保存・公開面の各面で当該ページに反映されているアフィリエイトが表示され、保存前後で表示が一致する","配色・テンプレート・固定ページの設定は D1 (Drizzle) に永続化され、再読み込み後も保持される","公開面のレイアウト・配色は axe-core の重大違反 0 件で、light/dark 両方で本文コントラストが基準を満たす","記事ページの HTML に本文・タイトル・description・canonical・OGP・JSON-LD (BlogPosting+BreadcrumbList、FAQ ブロックがあれば FAQPage) がサーバー側で含まれ、pure 関数の単体テストで検証できる","/s/{site}/sitemap.xml・/s/{site}/robots.txt・/s/{site}/feed.xml・/s/{site}/llms.txt が公開記事から自動生成され、robots.txt が GPTBot/ClaudeBot/PerplexityBot/Google-Extended を遮断しない","記事に結論・要点・FAQ・出典・最終更新ブロックを挿入でき、公開面で最終更新日 (dateModified) が可視化される","IndexNow 送信は鍵をサーバー環境変数からのみ読み、鍵未設定時は送信をスキップして記録に残す (鍵をリポジトリや管理画面に保存しない)","管理画面の参照レジストリで SEO/AI 検索ガイドラインの出典 (URL・発行元・確認日) を登録・一覧でき、確認日から 90 日超は再確認対象として表示される"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-blog-ui-builder.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-blog-ui-builder/168ac050680f91d58ce05948b6b0d3618f062ec304dfdb901713e98bdaa84c48/plan-findings.json"}
source_lineage: {"imported_at":"2026-08-29T23:02:28Z","origin_kind":"generated","source_digest":"2a4248717f4ad9540be1bf2cb17b4a24e1fdc97a5baf4664ad6a023f8e8d77bd","source_path":"system-spec/ui-ux.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "利用者要望 (ブログ UI 更新: テンプレート/配色/常時表示/固定ページ/表現ブロック/アフィリエイト配置管理) を C14 macro 分解で 1 feature 化。細分は system-dev-planner の P01..P13 に委譲"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-blog-ui-builder.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-6lf","github_mirror":null,"linked_at":"2026-08-24T12:00:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: [{"base_branch":"dev","closing_reference_verified":false,"head_branch":"devgraph/feat-blog-ui-builder","linked_at":"2026-08-24T12:00:00Z","merge_commit_sha":"7fd2b3b1e5323b4699fae74fa945845cda336b51","merged_at":"2026-08-24T14:09:41Z","pr_number":28,"repo":"daishiman/affiliate-hub","state":"merged","url":"https://github.com/daishiman/affiliate-hub/pull/28"}]
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":["docs/spec/feat-blog-ui-builder/final-review.md","docs/spec/feat-blog-ui-builder/spec-writeback-receipt.md"],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-28T00:00:00Z","missing_sections":[],"status":"complete"}
---

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
  - SEO/AI 検索 (AI Overviews・AI Mode・ChatGPT search・Perplexity 等) への最適化: SSR で本文を HTML に含める semantic HTML、robots.txt で AI クローラ許可を既定、ページ種別ごとの JSON-LD (BlogPosting/Person/Organization/BreadcrumbList/FAQPage/HowTo/Product/Review) をブロック木から自動生成、generateMetadata、sitemap.xml/RSS/llms.txt の自動生成、IndexNow 送信、dateModified の可視化 (仕様章 frontend §SEO/AI 検索)
  - AI 引用されやすい記事構造の標準ブロック: 結論 (answer) / 要点 (key-points) / FAQ / 出典 (sources) / 最終更新 (freshness) と著者プロフィール固定ページ、管理画面の SEO/AI チェックパネル (仕様章 ui-ux §SEO/AI 検索)
  - 最新 SEO/AI 検索ガイドラインの参照レジストリ (guideline_references): 海外・日本の出典 URL・発行元・確認日を登録し 90 日で再確認を促す。fetched-references.json の公式 4 出典 (Google AI 最適化ガイド / AI features / llms.txt / IndexNow) を初期データにする
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
- promoted package: `.dev-graph/state/current/feature-package-feat-blog-ui-builder.json` が指す `feature-package.json#/source_feature_digest` は上記 feature context digest と一致

A1–A14 の文言は frontmatter にのみ保持する。実装要件・タスク仕様書・証跡は canonical ID と
上記 digest を参照し、同じ ID に別の文言を与えない。2026-08-24 の初回計画時点では canonical ID が A9 までしか
無く、SEO / AI 検索の A10–A14 は context にしか無い状態で分裂していた（`ah-6lf.1`）。
数を文章へ書き写さないのは、その再発を止めるためである。
一致は `tests/architecture/blog-ui-spec-governance.test.ts` が機械で見る。

## MVP スライス（2026-08-24）

2026-08-24 の PR #28 で届けたのは SEO / AI 検索の土台だけ。受入全件は未充足のまま。到達したもの:

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
