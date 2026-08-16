# 文脈をまたぐ連絡（イベント台帳）

このファイルは `tests/domain/domain-events.test.ts` が作る。手で書き換えない。
更新は `UPDATE_EVENT_LEDGER=1 pnpm test` を実行して、出た差分をそのまま保存する。

イベントは、ある文脈で起きたことを別の文脈へ伝えるための唯一の経路。
別の文脈の保存処理を直接呼ばないので、受け手が増えても送り手は変わらない。

件数: 16（うち実際に発行しているもの: 6）

| 名前 | 出す文脈 | 何が起きたか | 必ず入る項目 | 状態 | 発行場所 / 何が済めば出せるか |
|---|---|---|---|---|---|
| `affiliate_url.submitted` | monetization | 成果リンクが受信箱に入った | `linkIngestionId` `url` | 発行あり | `src/application/usecases/monetization/manage-link-inbox.ts` |
| `affiliate_url.resolved` | monetization | 受信したリンクの行き先と広告主が判明した | `linkIngestionId` `programId` | 発行あり | `src/application/usecases/monetization/manage-link-inbox.ts` |
| `product.matched` | product | リンクの行き先が既知の商品と結びついた | `linkIngestionId` `productId` | 発行あり | `src/application/usecases/monetization/manage-link-inbox.ts` |
| `product.enriched` | product | 商品の属性が新しい情報源で補われた | `productId` `sourceArtifactId` | まだ発行していない | 外部情報から商品属性を補う取込処理 |
| `comparison.ready` | product | 比較の候補がそろい、比較表を作れる状態になった | `comparisonSetId` | まだ発行していない | 比較候補の 4 分類（同一/派生/競合/代替）の判定処理 |
| `content_package.created` | authoring | 記事のまとまり（同じ素材から作る一式）が作られた | `contentPackageId` | まだ発行していない | 記事のまとまりを作る画面と生成の起動 |
| `content_variant.generated` | authoring | 媒体ごとの原稿ができた（まだ公開してよい状態ではない） | `variantId` | 発行あり | `src/application/usecases/content/manage-content.ts` |
| `content_variant.approved` | authoring | 人が原稿を承認した | `variantId` `approvedBy` | 発行あり | `src/application/usecases/content/manage-content.ts` |
| `publication.scheduled` | distribution | 出し先と日時が決まった | `publicationId` `scheduledAt` | まだ発行していない | 配信予約の実装（出し先の接続が要る） |
| `publication.published` | distribution | 出し先へ公開された | `publicationId` | まだ発行していない | 配信の実行（各サービスの認証が要る） |
| `publication.failed` | distribution | 出し先への公開に失敗した | `publicationId` `reason` | まだ発行していない | 配信の実行と失敗の取り扱い |
| `affiliate_link.broken` | monetization | 成果リンクが切れている（読者を行き止まりに送っている） | `affiliateLinkId` `reason` | まだ発行していない | リンク切れ検出の定期実行 |
| `affiliate_program.terminated` | monetization | 提携そのものが終了した（掲載中の記事の見直しが要る） | `programId` | まだ発行していない | ASP からの提携状態の取得 |
| `claim.expired` | evidence | 根拠の有効期限が切れた（その主張はもう出せない） | `claimId` | まだ発行していない | 根拠の有効期限を見て回る定期実行 |
| `content.refresh_due` | authoring | 記事の見直し時期が来た | `variantId` | 発行あり | `src/application/usecases/content/manage-content.ts` |
| `conversion.received` | monetization | 成果が計上された | `conversionId` | まだ発行していない | ASP からの成果データ取込 |
