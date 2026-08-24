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
updated_at: "2026-08-24T12:00:00Z"
status: "active"
depends_on: ["feat-ui-foundation","feat-site-builder","feat-affiliate-hub"]
related_nodes: ["spec-system-spec-index"]
resource_scope: ["src","drizzle","docs/spec","system-spec"]
purpose: "ブログごとにテンプレートと配色を選び、公開面・作成・保存・管理一覧のどの面でも「どのブログにどのアフィリエイトが載っているか」を迷わず把握できるブログ UI を提供する"
goal: "テンプレートから新規ブログを作成でき、配色をブログ既定とページ単位で選べ、ヘッダー・サイドバー・フッターが常時表示され、運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせの固定ページと図解・比較などの表現ブロックを構築でき、公開面/作成/保存/管理一覧の各面でブログ×アフィリエイトの配置が一覧・逆引きできる状態になっている"
scope_in: ["ブログテンプレート (レビュー特化/比較特化/ハウツー/ニュース/ミニマル/ガジェット寄り の 6 種) からのブログ作成と差し替え (system-spec ui-ux §テンプレート)","配色の 2 層選択: ブログ既定テーマ (blog_theme) とページ単位上書き (page_theme_override)。decision-ui-theme-implementation (CSS light-dark()+data 属性) に従う","常時表示レイアウト: sticky ヘッダー・サイドバー・フッターと、狭幅でのサイドバー折りたたみ","固定ページ 6 種の構築 UI: 運営者情報 / 全カテゴリー / サイトポリシー / プライバシーポリシー / 特定商取引法に基づく表記 / お問い合わせ (legal_page)","記事表現ブロック: figure (図解) / comparison (比較表) / cta / summary / spec-table と、ガジェット依存部分の差し替え可能なスロット","ブログ×アフィリエイト配置 (blog_affiliate_placement) の管理一覧・逆引き (アフィリエイト→掲載ブログ/ページ) と、公開面・作成・保存の各面での表示","参考ブログ (makuring.jp) の構成・配置・表記法の参照を反映した情報設計 (丸パクリはしない。利用者説明を一次根拠とする)"]
scope_out: ["記事本文の AI 生成そのもの (feat-ai-content-studio)","アフィリエイト URL の登録・商品識別 (feat-affiliate-inbox / feat-affiliate-hub)","クリック計測・成果突合の分析基盤 (feat-analytics-insight)","管理画面全体の単一用途画面再編 (feat-uiux-overhaul)","独自ドメイン・DNS 運用、テーマの外部販売"]
acceptance: ["テンプレート 6 種のいずれかを選んで新規ブログを作成でき、作成後もテンプレートを差し替えても既存記事が壊れない","ブログ既定の配色を選べ、任意のページで配色を上書きでき、上書きを外すとブログ既定に戻る","公開面でヘッダー・サイドバー・フッターがスクロール中も常時表示され、狭幅ではサイドバーが折りたたまれる","運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせの 6 ページを管理画面から作成・編集・公開できる","記事内で図解・比較表・CTA・要約・スペック表のブロックを挿入でき、ガジェット依存部分はスロット差し替えで別カテゴリでも再利用できる","管理一覧でブログごとの掲載アフィリエイトが一覧でき、アフィリエイトから掲載ブログ/ページへ逆引きできる","作成・保存・公開面の各面で当該ページに反映されているアフィリエイトが表示され、保存前後で表示が一致する","配色・テンプレート・固定ページの設定は D1 (Drizzle) に永続化され、再読み込み後も保持される","公開面のレイアウト・配色は axe-core の重大違反 0 件で、light/dark 両方で本文コントラストが基準を満たす"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: "feature-package/feat-blog-ui-builder"
phase_ref: null
file_path: "features/feat-blog-ui-builder.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"7c28f632dc2de006d755a4c28a4948d1d76b06797ba43c105dc006f80c2a9464","evaluator":"system-spec-harness/assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-report.json"}
source_lineage: {"imported_at":"2026-08-24T02:20:00Z","origin_kind":"generated","source_digest":"1e0995ba4c805e9fe4826b6e03081c8372a3eacb91591c73b163f6651e952559","source_path":"system-spec/ui-ux.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "利用者要望 (ブログ UI 更新: テンプレート/配色/常時表示/固定ページ/表現ブロック/アフィリエイト配置管理) を C14 macro 分解で 1 feature 化。細分は system-dev-planner の P01..P13 に委譲"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-blog-ui-builder.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-6lf","github_mirror":null,"linked_at":"2026-08-24T12:00:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":["docs/spec/feat-blog-ui-builder/final-review.md","docs/spec/feat-blog-ui-builder/spec-writeback-receipt.md"],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-24T02:20:00Z","missing_sections":[],"status":"complete"}
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
- スコープ外:
  - 記事本文の AI 生成そのもの (feat-ai-content-studio)
  - アフィリエイト URL の登録・商品識別 (feat-affiliate-inbox / feat-affiliate-hub)
  - クリック計測・成果突合の分析基盤 (feat-analytics-insight)
  - 管理画面全体の単一用途画面再編 (feat-uiux-overhaul)
  - 独自ドメイン・DNS 運用、テーマの外部販売

## 受入

- [ ] A1 — テンプレート 6 種のいずれかを選んで新規ブログを作成でき、作成後もテンプレートを差し替えても既存記事が壊れない
- [ ] A2 — ブログ既定の配色を選べ、任意のページで配色を上書きでき、上書きを外すとブログ既定に戻る
- [ ] A3 — 公開面でヘッダー・サイドバー・フッターがスクロール中も常時表示され、狭幅ではサイドバーが折りたたまれる
- [ ] A4 — 運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせの 6 ページを管理画面から作成・編集・公開できる
- [ ] A5 — 記事内で図解・比較表・CTA・要約・スペック表のブロックを挿入でき、ガジェット依存部分はスロット差し替えで別カテゴリでも再利用できる
- [ ] A6 — 管理一覧でブログごとの掲載アフィリエイトが一覧でき、アフィリエイトから掲載ブログ/ページへ逆引きできる
- [ ] A7 — 作成・保存・公開面の各面で当該ページに反映されているアフィリエイトが表示され、保存前後で表示が一致する
- [ ] A8 — 配色・テンプレート・固定ページの設定は D1 (Drizzle) に永続化され、再読み込み後も保持される
- [ ] A9 — 公開面のレイアウト・配色は axe-core の重大違反 0 件で、light/dark 両方で本文コントラストが基準を満たす

## MVP スライス（2026-08-24）

本 PR で届けるのは SEO / AI 検索の土台だけ。A1–A9 は未充足のまま。到達したもの:

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
- 完了rollup: exact 13 が全 done かつ P07/P10/P11 の evidence が本 feature の受入 A1-A9 を満たすときだけ done とする
