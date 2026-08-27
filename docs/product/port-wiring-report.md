# つなぎ目の呼び出し（自動生成）

`node scripts/port-wiring.mjs` が書き出す。手で直さない。
末尾の指紋がその見張りで、手で 1 文字でも書くと次の実行が**上書きせずに止まる**（書いた行は残る）。

**製品コード（`src/application` `src/presentation` `src/app`）から**
呼ばれていないポートの手続きの一覧。テストからの呼び出しは数えない。

- ポート 73 件 / 手続き 262 件
- 呼ばれていない 50 件（上限 79）
- 理由つきの除外 0 件（上限 0）

| ポート | 手続き | 宣言 |
| --- | --- | --- |
| `AffiliateLinkRepositoryPort` | `save` | `src/application/ports/monetization.ts` |
| `AspAdapterPort` | `searchProducts` | `src/application/ports/monetization.ts` |
| `AspAdapterPort` | `fetchConversions` | `src/application/ports/monetization.ts` |
| `AspAdapterPort` | `createLink` | `src/application/ports/monetization.ts` |
| `AuthenticationPort` | `currentUserId` | `src/application/ports/identity.ts` |
| `AuthenticationPort` | `profileOf` | `src/application/ports/identity.ts` |
| `CachePort` | `get` | `src/application/ports/common.ts` |
| `CachePort` | `set` | `src/application/ports/common.ts` |
| `CachePort` | `delete` | `src/application/ports/common.ts` |
| `ChannelConnectionRepositoryPort` | `save` | `src/application/ports/distribution.ts` |
| `ChannelConnectorPort` | `unpublish` | `src/application/ports/distribution.ts` |
| `ClaimRepositoryPort` | `findById` | `src/application/ports/evidence.ts` |
| `ClaimRepositoryPort` | `listExpiringBefore` | `src/application/ports/evidence.ts` |
| `ClaimRepositoryPort` | `save` | `src/application/ports/evidence.ts` |
| `ComparisonSetRepositoryPort` | `findById` | `src/application/ports/product.ts` |
| `ComparisonSetRepositoryPort` | `listByProduct` | `src/application/ports/product.ts` |
| `ComparisonSetRepositoryPort` | `save` | `src/application/ports/product.ts` |
| `ConsentStorePort` | `read` | `src/application/ports/telemetry.ts` |
| `ConsentStorePort` | `write` | `src/application/ports/telemetry.ts` |
| `ConversionRepositoryPort` | `findByExternalId` | `src/application/ports/monetization.ts` |
| `FeedbackCaptureStoragePort` | `deleteExpired` | `src/application/ports/feedback.ts` |
| `FeedbackRepositoryPort` | `findByCaptureId` | `src/application/ports/feedback.ts` |
| `FeedbackRepositoryPort` | `purgeExpiredDiagnostics` | `src/application/ports/feedback.ts` |
| `LlmPort` | `embed` | `src/application/ports/llm.ts` |
| `LoggerPort` | `info` | `src/application/ports/common.ts` |
| `LoggerPort` | `error` | `src/application/ports/common.ts` |
| `MerchantOfferRepositoryPort` | `findById` | `src/application/ports/product.ts` |
| `MerchantOfferRepositoryPort` | `listByProduct` | `src/application/ports/product.ts` |
| `MerchantOfferRepositoryPort` | `listByMerchant` | `src/application/ports/product.ts` |
| `MerchantOfferRepositoryPort` | `save` | `src/application/ports/product.ts` |
| `MerchantOfferRepositoryPort` | `listStale` | `src/application/ports/product.ts` |
| `MetricsRepositoryPort` | `record` | `src/application/ports/analytics.ts` |
| `ProductRepositoryPort` | `findByIdentityKey` | `src/application/ports/product.ts` |
| `PublicationRepositoryPort` | `findByIdempotencyKey` | `src/application/ports/distribution.ts` |
| `SecretResolverPort` | `resolve` | `src/application/ports/common.ts` |
| `SiteBlueprintRepositoryPort` | `findById` | `src/application/ports/authoring.ts` |
| `SiteBlueprintRepositoryPort` | `list` | `src/application/ports/authoring.ts` |
| `SiteBlueprintRepositoryPort` | `save` | `src/application/ports/authoring.ts` |
| `SourceFetchPort` | `fetchArticle` | `src/application/ports/evidence.ts` |
| `StoragePort` | `put` | `src/application/ports/common.ts` |
| `StoragePort` | `getSignedUrl` | `src/application/ports/common.ts` |
| `StoragePort` | `delete` | `src/application/ports/common.ts` |
| `TaskQueuePort` | `enqueue` | `src/application/ports/common.ts` |
| `TelemetryQueryPort` | `countByEvent` | `src/application/ports/telemetry.ts` |
| `TelemetrySinkPort` | `purgeExpired` | `src/application/ports/telemetry.ts` |
| `TelemetrySinkPort` | `forgetReader` | `src/application/ports/telemetry.ts` |
| `TestRunRepositoryPort` | `findById` | `src/application/ports/evidence.ts` |
| `TrackingLinkIssuerPort` | `issue` | `src/application/ports/analytics.ts` |
| `WorkspaceRepositoryPort` | `findByOwner` | `src/application/ports/identity.ts` |
| `WorkspaceRepositoryPort` | `countGenerationsThisMonth` | `src/application/ports/identity.ts` |

## 書き込みなのに操作の記録へ届いていない入口

上の表は「1 回でも呼ばれたか」しか見ないので、**一部の経路からしか
呼ばれていない**状態を拾えない。ここはその形を見る。

- 届いていない 0 件（上限 0）
- 理由つきの除外 5 件（上限 5）

- 読み書きを判定できない手続き 0 件（上限 0）

| 入口 | 書き込んでいるもの | 場所 |
| --- | --- | --- |

## 記録が残せなくても進む入口

上の 2 つは「記録へ**届いているか**」を見る。届いてさえいれば緑になる。
ここは届いた先で**書けなかったときに止まるか**を見る。

書けなかったのに進むと、**操作は成功し、記録だけが無い**状態が残る。
押した人には成功として返り、あとで記録を開いた人には「その操作は無かった」
ように見えるので、**どちらの側からも気づけない**。

- 記録が残せなくても進む入口 2 件（上限 2）

**0 にはできない。** 見本モードでは置き場が無く、0 にすると下書きが
1 段目から進まなくなる。だから 0 ではなく、いまの実測で止める。

| 入口 | 場所 |
| --- | --- |
| `createStartSiteDraftUseCase` | `src/application/usecases/site/build-site.ts:419` |
| `createSaveSiteDraftStepUseCase` | `src/application/usecases/site/build-site.ts:511` |
<!-- 生成物の指紋 sha256:8e16947e59360841b8943b33feb8ed84fde4e4759640e4a7914d90541c3c05d6 -->
