import {
  type AssetId,
  type CategoryId,
  type DomainError,
  type ProductId,
  type ProductVariantId,
  type Provenance,
  type Result,
  type SourceArtifactId,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";
import type { ProductIdentityKey } from "./product-identity";

/**
 * 商品。
 *
 * 2 つの仕様書の Product を 1 つに統合したもの。二重定義を作らない。
 *   プラットフォーム層 §9.3 (取得日時・情報源・信頼度・有効期限つき)
 *   ブログ層 §12 Product (brand/name/model_number/specifications ほか)
 *
 * ここに書いてはいけないもの: 価格 (MerchantOffer)、報酬 (Monetization)、
 * 記事本文 (Content Authoring)。
 */
export type Product = {
  readonly id: ProductId;
  readonly workspaceId: WorkspaceId;
  readonly brand: string;
  readonly name: string;
  readonly manufacturer: string | null;
  readonly categoryId: CategoryId | null;
  readonly identityKeys: readonly ProductIdentityKey[];
  readonly description: string | null;
  /** 仕様。キーはカテゴリー単位で揃える (比較表の列がずれるため)。 */
  readonly specifications: Readonly<Record<string, string | number>>;
  readonly imageAssetIds: readonly AssetId[];
  readonly releaseDate: Date | null;
  readonly discontinuedAt: Date | null;
  readonly officialUrl: string | null;
  readonly officialSourceIds: readonly SourceArtifactId[];
  /** この商品情報がどこから来たか。全ての重要情報に必須 (§10.5)。 */
  readonly provenance: Provenance;
};

export type ProductVariant = {
  readonly id: ProductVariantId;
  readonly workspaceId: WorkspaceId;
  readonly productId: ProductId;
  /** 色・容量・サイズなど、何が違うか。 */
  readonly axis: string;
  readonly value: string;
  readonly identityKeys: readonly ProductIdentityKey[];
  readonly specifications: Readonly<Record<string, string | number>>;
};

export function createProduct(input: {
  id: ProductId;
  workspaceId: WorkspaceId;
  brand: string;
  name: string;
  manufacturer?: string | null;
  categoryId?: CategoryId | null;
  identityKeys: readonly ProductIdentityKey[];
  description?: string | null;
  specifications?: Readonly<Record<string, string | number>>;
  imageAssetIds?: readonly AssetId[];
  releaseDate?: Date | null;
  discontinuedAt?: Date | null;
  officialUrl?: string | null;
  officialSourceIds?: readonly SourceArtifactId[];
  provenance: Provenance;
}): Result<Product, DomainError> {
  if (input.name.trim() === "") {
    return err(validationError("商品名が空です。", "name"));
  }
  if (input.identityKeys.length === 0) {
    return err(
      validationError(
        "識別子が 1 つもありません。JANコード・ASIN・型番のいずれかを登録してください。同一商品の判定ができません。",
        "identityKeys",
      ),
    );
  }
  if (input.discontinuedAt && input.releaseDate && input.discontinuedAt < input.releaseDate) {
    return err(validationError("販売終了日が発売日より前になっています。", "discontinuedAt"));
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    brand: input.brand,
    name: input.name,
    manufacturer: input.manufacturer ?? null,
    categoryId: input.categoryId ?? null,
    identityKeys: input.identityKeys,
    description: input.description ?? null,
    specifications: input.specifications ?? {},
    imageAssetIds: input.imageAssetIds ?? [],
    releaseDate: input.releaseDate ?? null,
    discontinuedAt: input.discontinuedAt ?? null,
    officialUrl: input.officialUrl ?? null,
    officialSourceIds: input.officialSourceIds ?? [],
    provenance: input.provenance,
  });
}

/** 販売終了しているか。終了商品をランキング上位に出さない判断に使う。 */
export function isDiscontinued(product: Product, at: Date): boolean {
  return product.discontinuedAt !== null && product.discontinuedAt <= at;
}
