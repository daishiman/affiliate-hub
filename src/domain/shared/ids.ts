import { type Tagged, taggedString } from "./tagged";

/**
 * 全コンテキストで使う識別子。
 *
 * 共有カーネルに置いてよいのは「どのコンテキストでも同じ意味を持つもの」だけ。
 * ID・時刻・由来・エラー・テナント境界がそれにあたる。
 * 商品の評価軸やランキングの重みは共有カーネルに置かない (コンテキスト固有)。
 */

// Identity & Tenancy
export type WorkspaceId = Tagged<string, "WorkspaceId">;
export type UserId = Tagged<string, "UserId">;
export type BrandId = Tagged<string, "BrandId">;
export type MembershipId = Tagged<string, "MembershipId">;

// Product Intelligence
export type ProductId = Tagged<string, "ProductId">;
export type ProductVariantId = Tagged<string, "ProductVariantId">;
export type MerchantId = Tagged<string, "MerchantId">;
export type MerchantOfferId = Tagged<string, "MerchantOfferId">;
export type CategoryId = Tagged<string, "CategoryId">;
export type ComparisonSetId = Tagged<string, "ComparisonSetId">;

// Evidence & Claim
export type ClaimId = Tagged<string, "ClaimId">;
export type EvidenceId = Tagged<string, "EvidenceId">;
export type TestRunId = Tagged<string, "TestRunId">;
export type SourceArtifactId = Tagged<string, "SourceArtifactId">;

// Ranking
export type RankingModelId = Tagged<string, "RankingModelId">;

// Content Authoring
export type CampaignId = Tagged<string, "CampaignId">;
export type ContentPackageId = Tagged<string, "ContentPackageId">;
export type MasterBriefId = Tagged<string, "MasterBriefId">;
export type ContentVariantId = Tagged<string, "ContentVariantId">;
export type ArticleId = Tagged<string, "ArticleId">;
export type AuthorPersonaId = Tagged<string, "AuthorPersonaId">;
export type AudiencePersonaId = Tagged<string, "AudiencePersonaId">;
export type AssetId = Tagged<string, "AssetId">;
export type ConversationBlockId = Tagged<string, "ConversationBlockId">;
export type FaqId = Tagged<string, "FaqId">;
export type UpdateLogId = Tagged<string, "UpdateLogId">;

// Site (Content Authoring の配置面)
export type SiteId = Tagged<string, "SiteId">;
export type SiteBlueprintId = Tagged<string, "SiteBlueprintId">;
/** ブログ作成ウィザードの下書き。設計図になる前の状態。 */
export type SiteDraftId = Tagged<string, "SiteDraftId">;

// Distribution
export type ChannelConnectionId = Tagged<string, "ChannelConnectionId">;
export type PublicationId = Tagged<string, "PublicationId">;

// Affiliate & Monetization
export type AffiliateAccountId = Tagged<string, "AffiliateAccountId">;
export type AffiliateProgramId = Tagged<string, "AffiliateProgramId">;
export type AffiliateLinkId = Tagged<string, "AffiliateLinkId">;
export type ConversionId = Tagged<string, "ConversionId">;
/** ASP からの成果データ取り込みの実行記録。 */
export type AffiliateIngestionId = Tagged<string, "AffiliateIngestionId">;
/** 受信箱に入った成果リンク 1 件。上の取込とは別物なので ID も分ける。 */
export type LinkIngestionId = Tagged<string, "LinkIngestionId">;
/** 内部計測用の短縮リンク。ASP 発行 URL とは別物なので ID も分ける。 */
export type TrackingLinkId = Tagged<string, "TrackingLinkId">;

// Compliance
export type DisclosureId = Tagged<string, "DisclosureId">;
export type PolicyRuleId = Tagged<string, "PolicyRuleId">;
export type AuditLogId = Tagged<string, "AuditLogId">;

// Analytics
export type MetricId = Tagged<string, "MetricId">;
export type ExperimentId = Tagged<string, "ExperimentId">;

/**
 * 文字列から ID を作る。
 *
 * 生成 (uuid など) は infrastructure 層の IdGeneratorPort が行う。
 * ドメイン層は「文字列を ID として解釈する」ことだけを担当する。
 */
export const asWorkspaceId = (v: string) => taggedString<"WorkspaceId">(v);
export const asUserId = (v: string) => taggedString<"UserId">(v);
export const asBrandId = (v: string) => taggedString<"BrandId">(v);
export const asProductId = (v: string) => taggedString<"ProductId">(v);
export const asCategoryId = (v: string) => taggedString<"CategoryId">(v);
export const asClaimId = (v: string) => taggedString<"ClaimId">(v);
export const asEvidenceId = (v: string) => taggedString<"EvidenceId">(v);
export const asTestRunId = (v: string) => taggedString<"TestRunId">(v);
export const asRankingModelId = (v: string) => taggedString<"RankingModelId">(v);
export const asArticleId = (v: string) => taggedString<"ArticleId">(v);
export const asSiteId = (v: string) => taggedString<"SiteId">(v);
export const asContentPackageId = (v: string) => taggedString<"ContentPackageId">(v);
export const asContentVariantId = (v: string) => taggedString<"ContentVariantId">(v);
export const asAuthorPersonaId = (v: string) => taggedString<"AuthorPersonaId">(v);
export const asAudiencePersonaId = (v: string) => taggedString<"AudiencePersonaId">(v);
export const asAffiliateLinkId = (v: string) => taggedString<"AffiliateLinkId">(v);
export const asAffiliateProgramId = (v: string) => taggedString<"AffiliateProgramId">(v);
export const asPublicationId = (v: string) => taggedString<"PublicationId">(v);
export const asDisclosureId = (v: string) => taggedString<"DisclosureId">(v);
export const asMerchantId = (v: string) => taggedString<"MerchantId">(v);
export const asMerchantOfferId = (v: string) => taggedString<"MerchantOfferId">(v);
export const asComparisonSetId = (v: string) => taggedString<"ComparisonSetId">(v);
export const asChannelConnectionId = (v: string) => taggedString<"ChannelConnectionId">(v);
export const asCampaignId = (v: string) => taggedString<"CampaignId">(v);
export const asSiteBlueprintId = (v: string) => taggedString<"SiteBlueprintId">(v);
export const asMasterBriefId = (v: string) => taggedString<"MasterBriefId">(v);
export const asAssetId = (v: string) => taggedString<"AssetId">(v);
export const asExperimentId = (v: string) => taggedString<"ExperimentId">(v);
export const asTrackingLinkId = (v: string) => taggedString<"TrackingLinkId">(v);
