import type {
  AffiliateAccount,
  AffiliateLink,
  AffiliateProgram,
  AspKind,
  Conversion,
} from "@/domain/monetization";
import type {
  AffiliateAccountId,
  AffiliateLinkId,
  AffiliateProgramId,
  Commercial,
  ConversionId,
  ProductId,
  WorkspaceId,
} from "@/domain/shared";
import type { Page, Paged, PortResult } from "./common";

/**
 * Affiliate & Monetization のポート。すべて Commercial 区分。
 *
 * これらを組み立てるときは `markCommercial()` を通す。
 * ランキングのユースケースへ渡すとコンパイルが通らなくなる。
 */
export type AffiliateAccountRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: AffiliateAccountId): PortResult<AffiliateAccount | null>;
  list(workspaceId: WorkspaceId, page: Page): PortResult<Paged<AffiliateAccount>>;
  save(account: AffiliateAccount): PortResult<AffiliateAccount>;
};

export type AffiliateProgramRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: AffiliateProgramId): PortResult<AffiliateProgram | null>;
  list(workspaceId: WorkspaceId, page: Page): PortResult<Paged<AffiliateProgram>>;
  save(program: AffiliateProgram): PortResult<AffiliateProgram>;
};

export type AffiliateLinkRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: AffiliateLinkId): PortResult<AffiliateLink | null>;
  listByProduct(workspaceId: WorkspaceId, productId: ProductId): PortResult<readonly AffiliateLink[]>;
  save(link: AffiliateLink): PortResult<AffiliateLink>;
};

export type ConversionRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: ConversionId): PortResult<Conversion | null>;
  findByExternalId(
    workspaceId: WorkspaceId,
    asp: AspKind,
    normalizedExternalId: string,
  ): PortResult<Conversion | null>;
  listByPeriod(workspaceId: WorkspaceId, period: string, page: Page): PortResult<Paged<Conversion>>;
  save(conversion: Conversion): PortResult<Conversion>;
};

export type CommercialAffiliateLinkRepositoryPort = Commercial<AffiliateLinkRepositoryPort>;
export type CommercialConversionRepositoryPort = Commercial<ConversionRepositoryPort>;

/**
 * ASP との通信。
 *
 * ASP を 1 つ増やすときに触るのはこの契約の実装だけ。
 * ユースケースもドメインも変わらない (変更容易性シナリオ ①)。
 */
export type AspAdapterPort = {
  readonly asp: AspKind;
  /** 商品検索。編集用の商品情報を取る。報酬額はここでは返さない。 */
  searchProducts(query: { keyword: string; limit: number }): PortResult<readonly AspProductResult[]>;
  /** 成果データの取得。取込は Commercial 側でのみ使う。 */
  fetchConversions(range: { from: Date; to: Date }): PortResult<readonly AspConversionResult[]>;
  /** アフィリエイトリンクの発行。返る URL は改変せずそのまま保存する。 */
  createLink(input: { productExternalId: string }): PortResult<{ url: string }>;
};

export type AspProductResult = {
  readonly externalId: string;
  readonly name: string;
  readonly brandName: string | null;
  readonly imageUrl: string | null;
  readonly priceMinor: number | null;
  readonly currency: string;
  readonly merchantName: string;
  readonly productUrl: string;
  readonly retrievedAt: Date;
};

export type AspConversionResult = {
  readonly externalConversionId: string;
  readonly status: "pending" | "approved" | "rejected" | "cancelled";
  readonly occurredAt: Date;
  readonly rewardMinor: number | null;
  readonly currency: string;
  readonly linkRef: string | null;
};
