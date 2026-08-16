import type {
  EditorialClaimRepositoryPort,
  EditorialEvidenceRepositoryPort,
  EditorialProductRepositoryPort,
  EditorialRankingModelRepositoryPort,
  EditorialScoreCardRepositoryPort,
  EditorialTestRunRepositoryPort,
} from "./ports";
import type {
  EditorialContentPackageRepositoryPort,
  EditorialContentVariantRepositoryPort,
  EditorialPersonaRepositoryPort,
} from "./ports/authoring";
import type {
  ChannelConnectionRepositoryPort,
  ManualExportPort,
  PublicationRepositoryPort,
} from "./ports/distribution";
import type { ClickTrackingPort, MetricsRepositoryPort } from "./ports/analytics";
import type { AuditLogPort, DisclosureRepositoryPort } from "./ports/compliance";
import type {
  BrandRepositoryPort,
  MembershipRepositoryPort,
  WorkspaceRepositoryPort,
} from "./ports/identity";
import type {
  AffiliateAccountRepositoryPort,
  AffiliateProgramRepositoryPort,
  CommercialAffiliateLinkRepositoryPort,
  CommercialConversionRepositoryPort,
} from "./ports/monetization";
import type {
  EditorialContactPort,
  EditorialReaderToolPort,
  EditorialShortlistPort,
} from "./ports/reader-interaction";
import type {
  EditorialPublishedContentPort,
  EditorialSiteRepositoryPort,
} from "./ports/site";

/**
 * ユースケースが必要とするもの一式。
 *
 * ここに並ぶのは実装ではなく**つなぎ目の宣言（ポート）**だけ。
 * 「どの実装を使うか」は `src/infrastructure/composition.ts` が決める。
 *
 * 機能を足すときは、ここへポートを 1 行足す。
 * 足した瞬間に、組み立て側が実装を渡していないことが型検査で分かる。
 */
export type AppDeps = {
  readonly rankingModels: EditorialRankingModelRepositoryPort;
  readonly scoreCards: EditorialScoreCardRepositoryPort;
  readonly products: EditorialProductRepositoryPort;
  readonly claims: EditorialClaimRepositoryPort;
  readonly evidence: EditorialEvidenceRepositoryPort;
  readonly testRuns: EditorialTestRunRepositoryPort;
  readonly sites: EditorialSiteRepositoryPort;
  readonly publishedContent: EditorialPublishedContentPort;
  readonly shortlist: EditorialShortlistPort;
  readonly readerTools: EditorialReaderToolPort;
  readonly contact: EditorialContactPort;
  readonly contentPackages: EditorialContentPackageRepositoryPort;
  readonly contentVariants: EditorialContentVariantRepositoryPort;
  readonly personas: EditorialPersonaRepositoryPort;
  readonly channelConnections: ChannelConnectionRepositoryPort;
  readonly publications: PublicationRepositoryPort;
  readonly manualExport: ManualExportPort;
  readonly metrics: MetricsRepositoryPort;
  readonly clickTracking: ClickTrackingPort;
  readonly workspaces: WorkspaceRepositoryPort;
  readonly memberships: MembershipRepositoryPort;
  readonly brands: BrandRepositoryPort;
  readonly disclosures: DisclosureRepositoryPort;
  readonly auditLog: AuditLogPort;
  /**
   * ここから下は Commercial 区分。
   * 順位づけのユースケースは Editorial 印のポートしか受け取らないので、
   * この 4 つを渡そうとするとコンパイルが通らない。
   */
  readonly affiliateAccounts: AffiliateAccountRepositoryPort;
  readonly affiliatePrograms: AffiliateProgramRepositoryPort;
  readonly affiliateLinks: CommercialAffiliateLinkRepositoryPort;
  readonly conversions: CommercialConversionRepositoryPort;
};
