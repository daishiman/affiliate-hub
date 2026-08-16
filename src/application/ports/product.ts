import type { ComparisonSet, MerchantOffer, Product } from "@/domain/product";
import type {
  ComparisonSetId,
  Editorial,
  MerchantId,
  MerchantOfferId,
  ProductId,
  WorkspaceId,
} from "@/domain/shared";
import type { PageRequest, Paged, PortResult } from "./common";

/**
 * Product Intelligence のポート。
 *
 * 商品と価格は編集判断に使う情報なので Editorial 区分。
 * 報酬に関する情報はここに含めない (Commercial 側の port が持つ)。
 */
export type ProductRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: ProductId): PortResult<Product | null>;
  findByIdentityKey(
    workspaceId: WorkspaceId,
    keyType: string,
    value: string,
  ): PortResult<Product | null>;
  search(
    workspaceId: WorkspaceId,
    query: { text?: string; categoryId?: string },
    page: PageRequest,
  ): PortResult<Paged<Product>>;
  save(product: Product): PortResult<Product>;
};

export type MerchantOfferRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: MerchantOfferId): PortResult<MerchantOffer | null>;
  listByProduct(workspaceId: WorkspaceId, productId: ProductId): PortResult<readonly MerchantOffer[]>;
  listByMerchant(
    workspaceId: WorkspaceId,
    merchantId: MerchantId,
    page: PageRequest,
  ): PortResult<Paged<MerchantOffer>>;
  save(offer: MerchantOffer): PortResult<MerchantOffer>;
  /** 価格が古くなった商品。更新の対象を見つける。 */
  listStale(workspaceId: WorkspaceId, olderThan: Date, limit: number): PortResult<readonly MerchantOffer[]>;
};

export type ComparisonSetRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: ComparisonSetId): PortResult<ComparisonSet | null>;
  listByProduct(workspaceId: WorkspaceId, productId: ProductId): PortResult<readonly ComparisonSet[]>;
  save(set: ComparisonSet): PortResult<ComparisonSet>;
};

/**
 * ランキングのユースケースへ渡してよい商品ポートの型。
 *
 * `Editorial<T>` の印が付いた値しか代入できない。
 * 報酬情報を持つポートに `markCommercial` を付けておけば、
 * ここへ渡した時点でコンパイルエラーになる。
 */
export type EditorialProductRepositoryPort = Editorial<ProductRepositoryPort>;
export type EditorialMerchantOfferRepositoryPort = Editorial<MerchantOfferRepositoryPort>;
