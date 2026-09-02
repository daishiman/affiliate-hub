# feat-blog-ops-crud 要求ベースライン

対象: 管理画面からサイト網・トップ構成・レイアウト・記事 (T1–T4)・固定ページ 8 種・
ブランドタグ・配信部品を CRUD し、公開面を抽象ブループリント `review-media-classic`
(docs/spec/13) のパラメータどおりに描画する。

参照元は **「参考サイト」** としてのみ呼ぶ。参考サイトの文章・素材・固有名・色値・
テーマ名/プラグイン名は本 feature の成果物のどこにも書かない (`REQ-BOPS13`)。

- canonical acceptance registry: `features/feat-blog-ops-crud.md#frontmatter.acceptance`
- acceptance source digest: `sha256:7d03855a6d54fdd216e92734e92d4ff5e6baf89dd094c6a4fcd9904c515603e5`
- 本書の `REQ-BOPSxx` は実装の派生要件であり、A1–A14 を再定義しない。

## 派生実装要件と画面/データ要求の一意対応表

| ID | 実装要件 | canonical acceptance refs | 画面要求 | データ要求 |
|----|-------------|---------------------------|----------|-----------|
| REQ-BOPS01 | サイト網の節点を作成・一覧・更新・論理削除・復元でき、参照中の子節点がある削除は断られる | A1, A12 | `/admin/site-network`, `/admin/site-network/new`, `/admin/site-network/[node]` | `site_network_node` |
| REQ-BOPS02 | ハブトップ帯の表示可否・並び・件数を保存し、公開トップに反映する | A2 | `/admin/site-network/[node]`, `/s/[site]` | `blog_layout_band` |
| REQ-BOPS03 | ヘッダー・サイドバー・フッターの枠を設定し、無効な枠は描画しない | A3, A6 | `/admin/blog/layout` | `blog_layout_slot` |
| REQ-BOPS04 | 記事を T1–T4 で作成し、題名規則・必須ブロック列違反を保存前に断る。新規公開時は site blueprint のカテゴリーを明示選択し、空でない書き手名を要求する | A4, A5 | `/admin/blog/articles/new` | `articles`, `blog_article_block` |
| REQ-BOPS05 | `articles` を編集 aggregate として記事を一覧・更新・論理削除・復元し、状態遷移を監査に残す。publish/update/unpublish/delete/restore は canonical public projection・墓標と同じ Unit of Work で更新し、復元後は公開面でも同じ ID・URL・本文を再表示する | A4, A12 | `/admin/blog/articles`, `/admin/blog/articles/[article]` | `articles`, `published_articles`, `published_article_tombstones`, `audit_logs` |
| REQ-BOPS06 | 固定ページ 8 種を種別ごとに管理し、公開状態を公開面へ反映する。削除は本文・公開状態を保持する論理削除とし、保存による暗黙復活を断って削除済み一覧から明示復元する | A7, A12 | `/admin/blog/pages` | `legal_page` |
| REQ-BOPS07 | ブランドタグを管理し記事へ複数割り当て、非ブランドを cloud から除外する | A8 | `/admin/blog/tags` | `blog_tag`, `blog_article_tag` |
| REQ-BOPS08 | 配信部品 9 種の設定と観測履歴を分離し、欠落状態を一覧可能にする。記事件数・sitemap は編集状態から推測せず、読者面と同じ canonical public projection だけを点検する | A9 | `/admin/blog/delivery` | `blog_delivery_part`, `blog_delivery_snapshot`, `published_articles` |
| REQ-BOPS09 | 閲覧者評価を受け付け、管理側の非表示状態を公開集計に反映する。公開 projection から `source_article_id` で既存 `articles.id` を解決し、再投影・旧 URL redirect 後も評価 identity を変えない | A11 | 公開記事, `/admin/blog/evaluate/[article]` | `blog_article_rating`, `published_articles.source_article_id` |
| REQ-BOPS10 | 記事・サイトの適合・配信健全性・鮮度を表示し、並べ替え・絞り込みできる | A10 | `/admin/blog/evaluate` | 読み取り射影 |
| REQ-BOPS11 | 公開面をサイト網・レイアウト・記事型・固定ページ・配信設定から構成する。記事一覧・本文・検索・カテゴリー・人物・SEO・feed・sitemap・composition は `published_articles` の同一 identity 集合を読み、`articles` 直読・sample fallback・union を持たない | A2, A3, A5, A6, A7, A8, A9 | `/s/[site]` 一式 | canonical public projection (`published_articles`) |
| REQ-BOPS12 | D1 が無い管理面は見本データへ暗黙 fallback せず `StorageNotice` を出す | A12 | 全管理画面 | `tryGetDb()` |
| REQ-BOPS13 | 参考サイト固有の文章・素材・固有名・色値・テーマ名を成果物に含めない | A13 | — | — |
| REQ-BOPS14 | 依存方向・単一定義・テナント境界・監査・a11y の既存ゲートを破らない。公開 URL は `articleHref` だけで導出し、旧 `/blog/:slug` は同じ projection から canonical URL へ 308 redirect する | A14 | 主要 6 画面、`/s/[site]/blog/[article]` | — |

## ブループリント参照規約

- 構成の正本は `docs/spec/13-参考サイト全体構成解析-抽象ブループリント.md`。
- 記事構成テンプレートの正本は `docs/spec/06-サイトブループリント-記事構成テンプレート.md`。
- 本 feature は上記を**参照**し、内容を複製しない。
