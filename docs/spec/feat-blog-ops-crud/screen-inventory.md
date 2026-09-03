# 画面棚卸し (docs/spec/13 §2 のページ種別のうち本 feature が扱うもの)

## 管理面 (新設)

| route | 役割 | 操作 | 受入 |
|-------|------|------|------|
| `/admin/site-network` | サイト網の節点一覧 | list | REQ-BOPS01 |
| `/admin/site-network/new` | 節点を作る | create | REQ-BOPS01 |
| `/admin/site-network/[node]` | 節点の詳細・トップ帯設定・論理削除 | update / delete | REQ-BOPS01, REQ-BOPS02 |
| `/admin/site-network/deleted` | 削除済み節点の一覧 | list / restore | REQ-BOPS01 |
| `/admin/blog` | ブログ運用の入口 | navigate | REQ-BOPS01–REQ-BOPS10 |
| `/admin/blog/layout` | ヘッダー / サイドバー / フッターの枠 | list / update | REQ-BOPS03 |
| `/admin/blog/delivery` | 配信部品 9 種の設定・点検履歴 | list / update / check | REQ-BOPS08 |
| `/admin/blog/articles` | 記事一覧 (型・状態・鮮度) | list | REQ-BOPS05 |
| `/admin/blog/articles/deleted` | 削除済み記事の一覧 | list / restore | REQ-BOPS04, REQ-BOPS05 |
| `/admin/blog/articles/new` | 記事を作る (T1–T4) | create | REQ-BOPS04 |
| `/admin/blog/articles/[article]` | 記事の更新・ブロック編集・論理削除 | update / delete | REQ-BOPS04, REQ-BOPS05 |
| `/admin/blog/pages` | 固定ページ 8 種と削除済み一覧 | list / create / update / delete / restore | REQ-BOPS06 |
| `/admin/blog/tags` | ブランドタグ | list / create / update / delete | REQ-BOPS07 |
| `/admin/blog/evaluate` | 評価・適合・鮮度の一覧 | list | REQ-BOPS09, REQ-BOPS10 |
| `/admin/blog/evaluate/[article]` | 1 記事の評価詳細 | list / hide / show | REQ-BOPS09, REQ-BOPS10 |

## 公開面 (既存を利用・拡張)

| route | 対応するブループリント要素 | 変更 | 受入 |
|-------|--------------------------|------|------|
| `/s/[site]` | §3.1 header 3 部品 + §3.2 top 4 帯 | 帯の描画をレイアウト設定から引く | REQ-BOPS02, REQ-BOPS03 |
| `/s/[site]/[fixedPage]` | 公開中の固定ページ | canonical 8 種の published かつ未削除だけを描画 | REQ-BOPS06 |
| `/s/[site]/blog` | 公開済み記事の一覧 | request-scoped な site identity の内側だけを描画 | REQ-BOPS04, REQ-BOPS05 |
| `/s/[site]/blog/[article]` | 公開済み記事の詳細 | 未削除・published の記事本体と部品を描画 | REQ-BOPS04, REQ-BOPS05 |
| `/s/[site]/reviews/[product]` ほか記事面 | §3.3 記事 15 部品列 + §3.4 sidebar | 評価送信部品を追加 | REQ-BOPS09 |
| `/s/[site]/feed.xml`, `/s/[site]/sitemap.xml`, `/s/[site]/llms.txt` | §6 配信部品 | 無効部品を出さない | REQ-BOPS08 |

## 扱わない画面 (scope_out)

- 既存 `/admin/sites` 系ウィザード (feat-site-builder の所有)
- 既存 `/admin/content` 系の記事版管理 (feat-blog-ui-builder / content の所有)
- 報酬・成果まわりの画面一式 (Editorial / Commercial 遮断)
