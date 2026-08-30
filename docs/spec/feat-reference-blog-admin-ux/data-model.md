# Data model

## 正本と一時read model

| model | 種別 | 主フィールド | 不変条件 |
|---|---|---|---|
| reference sitemap snapshot | 再生成可能read model | part URL/status/lastmod/content digest/count/capturedAt | 本文・画像・assetを保持しない |
| reference URL inventory | 再生成可能read model | canonical URL/source/lastmod/screen type/variant/year/digest | canonical重複除外、unknown 0 |
| `articles` | 既存記事正本 | 既存列 + `revision integer not null default 1` | updateは `workspace_id + id + revision`のCAS、成功で+1 |
| local article draft | 端末一時保護 | form values/article id/revision/savedAt/TTL | 7日TTL、server保存完了で破棄、復元を明示 |
| article improvement | 導出read model | id/severity/blockId/location/rationale/before/after | article detailから決定的に導出、別tableにしない |
| affiliate preview | 未保存read model | 9項目/status/reason | 明示確定前はD1へ書かない |
| `affiliate_links` snapshot | 既存商用正本の後方互換拡張 | canonicalUrl/merchantName/imageUrl/priceMinor/currency/retrievedAt/sourceMethod/lastCheckedAt | originalUrlは不変、不明値はnull、古い行は更新せず再登録 |
| `blog_affiliate_placement` | placement正本 | affiliateLinkId/siteSlug/articleSlug/blockId/placement/status/position/lastRenderedAt/updatedAt | workspace始まりの索引、1 link:N placements |

## migration

1. `articles.revision` をdefault 1で追加。既存rowは1。
2. affiliate snapshot列をnullableで追加。既存の3項目snapshotはそのまま。
3. placement列をnullable/default付きで追加。link IDの無いlegacy rowは「要確認」として保持。
4. `workspace_id, affiliate_link_id, status`と`workspace_id, site_slug, article_slug`索引を追加。

削除・上書きbackfillはしない。rollbackは追加列を読まない旧codeへ戻す論理rollbackとする。

