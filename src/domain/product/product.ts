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

/**
 * 商品の枝ちがい (色・容量・サイズ) を作る。
 *
 * 2026-08-19 まで、この型には**作る関数が無かった**。型だけが在り、
 * `src` と `tests` を通して 1 か所も組み立てていない
 * (`ProductVariantId` の宣言を除けば参照 0 件)。追跡表の「見本データ」も
 * 事実ではなかった。**誰も作らない型は、断る場所を持てない。**
 *
 * ここで作ったのは関数と断りだけで、**画面は作っていない**。追跡表に書いてある
 * 解除条件 (色・容量ちがいを画面で分けて扱う要望が出たとき) はそのまま残る。
 * 分けたのは、画面を作る理由と、組み立てを 1 か所に寄せる理由が別だからである。
 */
export function createProductVariant(input: {
  id: ProductVariantId;
  workspaceId: WorkspaceId;
  productId: ProductId;
  axis: string;
  value: string;
  identityKeys: readonly ProductIdentityKey[];
  specifications?: Readonly<Record<string, string | number>>;
}): Result<ProductVariant, DomainError> {
  if (input.axis.trim() === "") {
    return err(
      validationError(
        "何が違うのか (色・容量・サイズなど) が空です。比較表の見出しを作れません。",
        "axis",
      ),
    );
  }
  if (input.value.trim() === "") {
    return err(validationError("枝ちがいの値が空です。どれを指すのか決まりません。", "value"));
  }
  if (input.identityKeys.length === 0) {
    // 親商品と同じ理由に見えるが、断る理由は違う。親は「同一商品の判定」で、
    // こちらは「**別に買えるものかどうか**」である。別の識別子を持たない枝は、
    // 買う先が親と同じなので枝ではなく、仕様欄の 1 行にすぎない。
    return err(
      validationError(
        "識別子が 1 つもありません。枝ちがいは別に買えるものなので、親商品とは別の JANコード・ASIN・型番が要ります。",
        "identityKeys",
      ),
    );
  }
  const specifications = input.specifications ?? {};
  const declared = specifications[input.axis];
  if (declared !== undefined && String(declared) !== input.value) {
    // 「色: 赤」と書いてある枝の value が「青」でも、型は通る。通ったまま
    // 比較表に載ると、見出しと中身が食い違った表が出る。**黙って間違うので、
    // ここで断る**。同じことを画面側で直すと、画面を増やすたびに書き写しが要る。
    return err(
      validationError(
        `仕様の「${input.axis}」が「${String(declared)}」なのに、枝ちがいの値が「${input.value}」です。比較表の見出しと中身が食い違います。`,
        "specifications",
      ),
    );
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    productId: input.productId,
    axis: input.axis,
    value: input.value,
    identityKeys: input.identityKeys,
    specifications,
  });
}

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
