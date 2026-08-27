---
graph_node_id: "feat-blog-ops-crud"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["blog","crud","site-network","blueprint","review-media-classic","reader-surface","admin"]
priority: "high"
start_date: "2026-08-25"
target_date: null
iteration: null
title: "ブログ運用 CRUD とサイト網ブループリント再現 (作成者面・閲覧者面)"
owners: ["daishiman"]
created_at: "2026-08-25T09:40:00Z"
updated_at: "2026-08-26T14:59:23.852748Z"
status: "active"
depends_on: ["feat-blog-ui-builder","feat-site-blueprint","feat-site-builder"]
related_nodes: ["spec-system-spec-index","arch-system-spec-overview","feat-reader-surface"]
resource_scope: ["src","drizzle","docs/spec","system-spec","features/feat-blog-ops-crud.context.json"]
purpose: "発信者がサイト網 (ハブ + サブサイト + ミニサイト) と記事・固定ページ・タグ・配信部品を一つの管理面で作成・一覧・編集・削除・評価でき、閲覧者には抽象ブループリント review-media-classic v1.1 の構成 (ヘッダー・ヒーロー・2 カラム記事・追従サイドバー・3 層フッター・記事型 T1-T4) で再現された公開面を届ける"
goal: "管理画面からサイト網とそのトップ構成・レイアウト・記事 (T1-T4)・固定ページ 8 種・ブランドタグ・配信部品を CRUD でき、一覧で各記事/サイトのブループリント適合・配信健全性・鮮度・閲覧者評価を確認でき、公開面が docs/spec/13 §8 のブループリント・パラメータどおりに描画・配信され、参考サイト固有の文章・素材・固有名・色値を一切含まない状態になっている"
scope_in: ["サイト網 (site_network) の CRUD: ハブ 1 + サブサイト n (path_prefix / 独自カテゴリ木 / 独自 feed / 独自サイドバー / 運営者情報) + ミニサイト (dictionary / navigator / shop) の作成・一覧・編集・論理削除・復元・複製 (sites 拡張 network_id / network_role / path_prefix / mini_kind)","ハブトップの構成編集 (blog_hero_config): hero-banner (見出し・説明・検索の一言・人物コメント) / latest-posts-band / sister-sites-band (max_items) / category-hub-grid (遷移先 = 下位カテゴリ代表まとめ記事) / navigator-band","レイアウト編集 (blog_layout_config): header 3 部品、sidebar 通常 8 + 追従 2 (sticky-promo-slot / sticky-toc)、footer 4 部品のスロット配列と custom-html-slot ×2 (サニタイズ済み HTML)","記事 CRUD: 記事型 T1 まとめ / T2 単品レビュー / T3 ガイド / T4 ハブ の article_template と題名規則、本文部品列 (breadcrumb → article-title → article-meta → featured-image → disclosure-notice → intro-box → hierarchical-toc → editor-credential-box → body-blocks → comment-form → prev-next)、product-card の 3 箇所再掲、emphasis-box、下書き→公開→論理削除の状態遷移","固定ページ 8 種 (profile / sitemap / site-policy / privacy-policy / commercial-transaction / contact / review-guidelines / company) の CRUD と legal-nav / footer への自動反映 (legal_pages.kind)","タグをブランド軸として扱う (tags.kind=brand): タグ CRUD、タグ一覧ページ、サイドバー brand-tag-cloud","配信部品の必須出力と記録 (delivery_snapshots): canonical / og-twitter-meta / jsonld-website・article・collection / rss-feeds (網 + 各サイト) / sitemap-index + parts / llms-txt / robots","運用評価 (evaluate): 一覧画面の評価列 = ブループリント適合 (BP-01..06 / AT-01..05) ・配信健全性 (delivery 欠落 0) ・鮮度 (最終更新からの日数) と、閲覧者の記事評価 (役に立った / コメント) の受付・管理側一覧・非表示","閲覧者面: T1-T4 の公開レンダリング、パンくず、前後記事、追従サイドバー、狭幅折りたたみ、サブサイト別 feed / sitemap parts","運用イベントの監査記録 (作成・更新・削除・公開・復元) と公開面 edge cache (TTL 10 分) の失効","転用禁止ゲート: 参考サイト固有の文章・画像・固有名・色値・テーマ名がコード / seed / docs / spec に 0 件であることを CI で検査"]
scope_out: ["ブログ既定テーマ・ページ単位配色・テンプレート 6 種の選択 UI と SEO/AI 検索土台の初期実装 (feat-blog-ui-builder)","Blueprint の複製規則・article_template の検証規則そのものの定義 (feat-site-blueprint)","ブログ作成ウィザードの入口 (feat-site-builder)","記事本文の AI 生成 (feat-ai-content-studio)","アフィリエイト URL 登録・商品識別・配置逆引き (feat-affiliate-inbox / feat-affiliate-hub / feat-blog-ui-builder)","クリック計測・成果突合 (feat-analytics-insight)","参考サイトの文章・画像・固有名・色値・テーマ/プラグイン名の転用","独自ドメイン・DNS 運用"]
acceptance: ["管理画面からサイト網 (ハブ 1 + サブサイト 2 + ミニサイト 1) を作成・一覧・編集・論理削除でき、削除後は公開面が 404 になり、一覧の削除済みフィルタから復元すると同じ URL で再公開される","ハブトップに hero-banner / latest-posts-band / sister-sites-band / category-hub-grid / navigator-band が blog_hero_config の順序どおり描画され、sister-sites-band の件数が max_items を超えない","サブサイトは独自のカテゴリ木・feed・サイドバー・運営者情報ページを持ち、ヘッダーとフッターのカテゴリ木は網で共有される (サブサイト 2 件で同一ヘッダー / 異なるサイドバーを確認)","記事は T1-T4 のいずれかの article_template で作成され、題名規則違反と必須部品の欠落は保存時に検証エラー (AT-01..05 / BP-01..06) として返り、下書き→公開→論理削除→復元の遷移が監査イベントに 1 件ずつ残る","T1 記事ページに breadcrumb から prev-next までの部品列が順序どおり描画され、product-card が紹介・比較・まとめの 3 箇所に再掲され、hierarchical-toc が h2/h3 の階層を反映する","サイドバーが通常 8 部品 + 追従 2 部品で構成され、custom-html-slot の内容は許可タグ以外が除去されて描画され、狭幅では折りたたまれる","固定ページ 8 種を作成・編集・公開でき、公開したものだけが legal-nav と footer に自動反映される","タグに kind=brand を付与でき、タグ一覧ページとサイドバーの brand-tag-cloud に反映され、非ブランドタグはクラウドに出ない","公開面が canonical / OG・Twitter meta / JSON-LD (website・article・collection) / RSS (網 + 各サイト) / sitemap index + parts / llms.txt / robots を出力し、生成結果が delivery_snapshots に記録されて欠落 0 件で一覧に表示される","記事一覧とサイト一覧にブループリント適合・配信健全性・鮮度の評価列があり、各列で並べ替えと絞り込みができる","閲覧者が記事ごとに評価 (役に立った / コメント) を送信でき、管理側の評価一覧で確認・非表示にでき、非表示にした評価は公開面に出ない","作成・更新・削除・公開・復元の全操作が監査イベントに記録され、公開面の反映が edge cache TTL 10 分以内に完了する","参考サイト固有の文章・画像・固有名・色値・テーマ/プラグイン名がコード・seed・docs・spec に 0 件であることを CI の grep ゲートが検査し PASS する","公開面と管理画面の主要 6 画面 (サイト網一覧 / トップ構成 / レイアウト / 記事編集 / 固定ページ / 評価一覧) が axe-core の重大違反 0 件である"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-blog-ops-crud.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"6ffac8f3a50c77499d310c4be14b89f27ba91cba627b0267c23e3e686c093dee","evaluator":"system-spec-harness/assign-system-spec-completeness-evaluator","evidence_ref":"system-spec/completeness-report.json"}
source_lineage: {"imported_at":"2026-08-25T09:40:00Z","origin_kind":"generated","source_digest":"7b029152ed5130b0c3e331bb390f3f344811fc97f9cb92b9f0b3557d9a9b54c1","source_path":"system-spec/frontend.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "利用者要望 (ブログ運用ページの完全 CRUD + 参考ブログ全体構成の抽象再現) を C14 macro 分解で 1 feature 化。確定章 qa-*-web-site-blueprint と docs/spec/13 v1.1 を lineage 参照し、細分は system-dev-planner の P01..P13 に委譲"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-blog-ops-crud.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-85cn","github_mirror":null,"linked_at":"2026-08-25T14:30:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-25T09:40:00Z","missing_sections":[],"status":"complete"}
---

# 目的

発信者がサイト網と記事・固定ページ・タグ・配信部品を一つの管理面で運用でき、閲覧者には抽象ブループリント `review-media-classic` v1.1 に従う公開面を届ける。詳細な制約と到達状態は frontmatter の `purpose` / `goal` / `scope_in` / `scope_out` を正本とし、本文では再定義しない。

## 受入正本レジストリ

- canonical source: `features/feat-blog-ops-crud.md#frontmatter.acceptance`
- planner projection: `features/feat-blog-ops-crud.context.json#/acceptance`
- ID mapping: 配列の 1 始まり順番を `A1` 〜 `A14` に対応させる
- acceptance source digest: `sha256:7d03855a6d54fdd216e92734e92d4ff5e6baf89dd094c6a4fcd9904c515603e5`

A1–A14 の文言は frontmatter にのみ保持する。実装要件・設計・証跡は canonical ID と上記 digest を参照し、別の文言を同じ ID で定義しない。デザイン上の派生要件は `REQ-BOPS01`–`REQ-BOPS14` namespace を使う。

## アーキテクチャ参照

- `architecture_refs`: arch-system-spec-overview, arch-two-layer-platform
- 構成の正本は `docs/spec/13-参考サイト全体構成解析-抽象ブループリント.md` v1.1 と system-spec 確定章を lineage 参照し、本 feature で複製しない。

## 機能間依存

- `depends_on`: feat-blog-ui-builder, feat-site-blueprint, feat-site-builder
- テーマ選択、複製・検証規則、ウィザード入口は各依存 feature の正本を利用する。

## Handoff

- per-feature planning: `run-system-dev-plan --feature-id feat-blog-ops-crud --feature-context features/feat-blog-ops-crud.context.json`
- package contract: P01..P13 exact 13 + intra-feature DAG
- completion rollup: 全 task の `completion_evidence.status=done` と A1–A14 の現行 digest に対する再検証証跡が揃ったときだけ feature を done にする
