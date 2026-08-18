# つなぎ目の呼び出し（自動生成）

`node scripts/port-wiring.mjs` が書き出す。手で直さない。

**製品コード（`src/application` `src/presentation` `src/app`）から**
呼ばれていないポートの手続きの一覧。テストからの呼び出しは数えない。

- ポート 63 件 / 手続き 187 件
- 呼ばれていない 81 件（上限 82）
- 理由つきの除外 0 件（上限 0）

| ポート | 手続き | 宣言 |
| --- | --- | --- |
| `AffiliateAccountRepositoryPort` | `findById` | `src/application/ports/monetization.ts` |
| `AffiliateAccountRepositoryPort` | `save` | `src/application/ports/monetization.ts` |
| `AffiliateLinkRepositoryPort` | `findById` | `src/application/ports/monetization.ts` |
| `AffiliateLinkRepositoryPort` | `save` | `src/application/ports/monetization.ts` |
| `AffiliateProgramRepositoryPort` | `save` | `src/application/ports/monetization.ts` |
| `AspAdapterPort` | `searchProducts` | `src/application/ports/monetization.ts` |
| `AspAdapterPort` | `fetchConversions` | `src/application/ports/monetization.ts` |
| `AspAdapterPort` | `createLink` | `src/application/ports/monetization.ts` |
| `AuditLogPort` | `listByTarget` | `src/application/ports/compliance.ts` |
| `AuthenticationPort` | `currentUserId` | `src/application/ports/identity.ts` |
| `AuthenticationPort` | `profileOf` | `src/application/ports/identity.ts` |
| `BrandRepositoryPort` | `findById` | `src/application/ports/identity.ts` |
| `BrandRepositoryPort` | `save` | `src/application/ports/identity.ts` |
| `CachePort` | `get` | `src/application/ports/common.ts` |
| `CachePort` | `set` | `src/application/ports/common.ts` |
| `CachePort` | `delete` | `src/application/ports/common.ts` |
| `ChannelConnectionRepositoryPort` | `findById` | `src/application/ports/distribution.ts` |
| `ChannelConnectionRepositoryPort` | `save` | `src/application/ports/distribution.ts` |
| `ChannelConnectorPort` | `publish` | `src/application/ports/distribution.ts` |
| `ChannelConnectorPort` | `unpublish` | `src/application/ports/distribution.ts` |
| `ChannelConnectorPort` | `validate` | `src/application/ports/distribution.ts` |
| `ClaimRepositoryPort` | `findById` | `src/application/ports/evidence.ts` |
| `ClaimRepositoryPort` | `listExpiringBefore` | `src/application/ports/evidence.ts` |
| `ClaimRepositoryPort` | `save` | `src/application/ports/evidence.ts` |
| `ComparisonSetRepositoryPort` | `findById` | `src/application/ports/product.ts` |
| `ComparisonSetRepositoryPort` | `listByProduct` | `src/application/ports/product.ts` |
| `ComparisonSetRepositoryPort` | `save` | `src/application/ports/product.ts` |
| `ConsentStorePort` | `read` | `src/application/ports/telemetry.ts` |
| `ConsentStorePort` | `write` | `src/application/ports/telemetry.ts` |
| `ContentPackageRepositoryPort` | `list` | `src/application/ports/authoring.ts` |
| `ContentPackageRepositoryPort` | `save` | `src/application/ports/authoring.ts` |
| `ConversionRepositoryPort` | `findByExternalId` | `src/application/ports/monetization.ts` |
| `DisclosureRepositoryPort` | `findById` | `src/application/ports/compliance.ts` |
| `DisclosureRepositoryPort` | `save` | `src/application/ports/compliance.ts` |
| `EvidenceRepositoryPort` | `findById` | `src/application/ports/evidence.ts` |
| `EvidenceRepositoryPort` | `search` | `src/application/ports/evidence.ts` |
| `EvidenceRepositoryPort` | `save` | `src/application/ports/evidence.ts` |
| `FeedbackCaptureStoragePort` | `deleteExpired` | `src/application/ports/feedback.ts` |
| `ImprovementRepositoryPort` | `saveVariantSpec` | `src/application/ports/improvement.ts` |
| `ImprovementRepositoryPort` | `saveRun` | `src/application/ports/improvement.ts` |
| `LlmPort` | `embed` | `src/application/ports/llm.ts` |
| `LoggerPort` | `info` | `src/application/ports/common.ts` |
| `LoggerPort` | `error` | `src/application/ports/common.ts` |
| `MembershipRepositoryPort` | `findById` | `src/application/ports/identity.ts` |
| `MembershipRepositoryPort` | `findByUser` | `src/application/ports/identity.ts` |
| `MembershipRepositoryPort` | `save` | `src/application/ports/identity.ts` |
| `MerchantOfferRepositoryPort` | `findById` | `src/application/ports/product.ts` |
| `MerchantOfferRepositoryPort` | `listByProduct` | `src/application/ports/product.ts` |
| `MerchantOfferRepositoryPort` | `listByMerchant` | `src/application/ports/product.ts` |
| `MerchantOfferRepositoryPort` | `save` | `src/application/ports/product.ts` |
| `MerchantOfferRepositoryPort` | `listStale` | `src/application/ports/product.ts` |
| `MetricsRepositoryPort` | `record` | `src/application/ports/analytics.ts` |
| `PersonaRepositoryPort` | `saveAuthor` | `src/application/ports/authoring.ts` |
| `PersonaRepositoryPort` | `saveAudience` | `src/application/ports/authoring.ts` |
| `PolicyRuleRepositoryPort` | `findById` | `src/application/ports/compliance.ts` |
| `PolicyRuleRepositoryPort` | `save` | `src/application/ports/compliance.ts` |
| `ProductRepositoryPort` | `findByIdentityKey` | `src/application/ports/product.ts` |
| `ProductRepositoryPort` | `save` | `src/application/ports/product.ts` |
| `PublicationRepositoryPort` | `listByVariant` | `src/application/ports/distribution.ts` |
| `PublicationRepositoryPort` | `listDue` | `src/application/ports/distribution.ts` |
| `RankingModelRepositoryPort` | `list` | `src/application/ports/ranking.ts` |
| `RankingModelRepositoryPort` | `save` | `src/application/ports/ranking.ts` |
| `ScoreCardRepositoryPort` | `save` | `src/application/ports/ranking.ts` |
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
| `TestRunRepositoryPort` | `save` | `src/application/ports/evidence.ts` |
| `TrackingLinkIssuerPort` | `issue` | `src/application/ports/analytics.ts` |
| `WorkspaceRepositoryPort` | `findByOwner` | `src/application/ports/identity.ts` |
| `WorkspaceRepositoryPort` | `save` | `src/application/ports/identity.ts` |
| `WorkspaceRepositoryPort` | `countGenerationsThisMonth` | `src/application/ports/identity.ts` |

## 書き込みなのに操作の記録へ届いていない入口

上の表は「1 回でも呼ばれたか」しか見ないので、**一部の経路からしか
呼ばれていない**状態を拾えない。ここはその形を見る。

- 届いていない 11 件（上限 11）
- 理由つきの除外 4 件（上限 4）

- 読み書きを判定できない手続き 0 件（上限 0）

| 入口 | 書き込んでいるもの | 場所 |
| --- | --- | --- |
| `createHandOffFeedbackUseCase` | `FeedbackRepositoryPort.save` | `src/application/usecases/feedback/hand-off-feedback.ts` |
| `createSubmitFeedbackUseCase` | `FeedbackCaptureStoragePort.put`<br>`FeedbackRepositoryPort.save` | `src/application/usecases/feedback/submit-feedback.ts` |
| `createUpdateFeedbackStatusUseCase` | `FeedbackRepositoryPort.save` | `src/application/usecases/feedback/update-feedback-status.ts` |
| `createAdjustConversionUseCase` | `ConversionRepositoryPort.save` | `src/application/usecases/monetization/manage-affiliate.ts` |
| `createMatchLinkIngestionUseCase` | `EventPublisherPort.publish`<br>`LinkIngestionRepositoryPort.save` | `src/application/usecases/monetization/manage-link-inbox.ts` |
| `createRejectLinkIngestionUseCase` | `LinkIngestionRepositoryPort.save` | `src/application/usecases/monetization/manage-link-inbox.ts` |
| `createResolveLinkIngestionUseCase` | `EventPublisherPort.publish`<br>`LinkIngestionRepositoryPort.save` | `src/application/usecases/monetization/manage-link-inbox.ts` |
| `createSubmitAffiliateUrlUseCase` | `EventPublisherPort.publish`<br>`LinkIngestionRepositoryPort.save` | `src/application/usecases/monetization/manage-link-inbox.ts` |
| `createCreateSiteFromDraftUseCase` | `SiteDraftRepositoryPort.publishBlueprint`<br>`SiteDraftRepositoryPort.save` | `src/application/usecases/site/build-site.ts` |
| `createSaveSiteDraftStepUseCase` | `SiteDraftRepositoryPort.save` | `src/application/usecases/site/build-site.ts` |
| `createStartSiteDraftUseCase` | `SiteDraftRepositoryPort.save` | `src/application/usecases/site/build-site.ts` |

