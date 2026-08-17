import {
  type DomainError,
  type MerchantId,
  type MerchantOfferId,
  type Money,
  type ProductId,
  type Provenance,
  type Result,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * 販売店の取扱情報 (価格・在庫)。
 *
 * 価格は「いつ確認した値か」と必ず一組で扱う。
 * ブログ層 §17.3「古い価格を現在価格として断定しない」を守るには、
 * 価格単体を持ち回れない構造にするのが確実。
 *
 * 注意: affiliateUrl はここに置くが、これは「読者を送る先」であって
 * 報酬額ではない。報酬額は Affiliate & Monetization コンテキストにあり、
 * Product Intelligence からは参照できない。
 */
export type Availability = "in_stock" | "out_of_stock" | "preorder" | "unknown";

export type MerchantOffer = {
  readonly id: MerchantOfferId;
  readonly workspaceId: WorkspaceId;
  readonly productId: ProductId;
  readonly merchantId: MerchantId;
  readonly merchantName: string;
  /** 価格不明は null。0 円ではない (§17.3「価格を確認」と表示する)。 */
  readonly displayPrice: Money | null;
  readonly availability: Availability;
  /** 送料・ポイントは価格と混ぜない。条件が違うものを足すと比較できなくなる。 */
  readonly shippingNote: string | null;
  readonly pointsNote: string | null;
  readonly affiliateUrl: string | null;
  readonly checkedAt: Date;
  readonly expiresAt: Date | null;
  readonly provenance: Provenance;
};

/** 価格の鮮度。これを過ぎたら「確認日時つきの参考値」として扱う。 */
export const PRICE_FRESHNESS_HOURS = 24;

export type PriceDisplay =
  | { readonly kind: "fresh"; readonly price: Money; readonly checkedAt: Date }
  | { readonly kind: "stale"; readonly price: Money; readonly checkedAt: Date; readonly note: string }
  | { readonly kind: "unknown"; readonly note: string };

/**
 * 価格の表示方法を決める。純粋関数。
 *
 * この判断を UI 側に書くと、記事・AI回答・WebMCP応答・SNSプレビューの
 * 4 箇所で表記が食い違う。1 箇所に閉じる。
 */
export function resolvePriceDisplay(offer: MerchantOffer, at: Date): PriceDisplay {
  if (offer.displayPrice === null) {
    return { kind: "unknown", note: "価格を確認してください (取得できていません)。" };
  }
  const ageHours = (at.getTime() - offer.checkedAt.getTime()) / 3_600_000;
  if (offer.expiresAt !== null && offer.expiresAt <= at) {
    return {
      kind: "stale",
      price: offer.displayPrice,
      checkedAt: offer.checkedAt,
      note: "この価格は有効期限を過ぎています。販売店で最新価格を確認してください。",
    };
  }
  if (ageHours > PRICE_FRESHNESS_HOURS) {
    return {
      kind: "stale",
      price: offer.displayPrice,
      checkedAt: offer.checkedAt,
      note: `${formatCheckedAt(offer.checkedAt)}時点の価格です。変わっている場合があります。`,
    };
  }
  return { kind: "fresh", price: offer.displayPrice, checkedAt: offer.checkedAt };
}

function formatCheckedAt(d: Date): string {
  // 相対日付だけにしない (ブログ層 §10.3「具体的な日付を示す」)。
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function createMerchantOffer(input: {
  id: MerchantOfferId;
  workspaceId: WorkspaceId;
  productId: ProductId;
  merchantId: MerchantId;
  merchantName: string;
  displayPrice?: Money | null;
  availability?: Availability;
  shippingNote?: string | null;
  pointsNote?: string | null;
  affiliateUrl?: string | null;
  checkedAt: Date;
  expiresAt?: Date | null;
  provenance: Provenance;
}): Result<MerchantOffer, DomainError> {
  if (input.merchantName.trim() === "") {
    return err(validationError("販売店名が空です。", "merchantName"));
  }
  if (input.expiresAt && input.expiresAt <= input.checkedAt) {
    return err(validationError("有効期限が確認日時より前になっています。", "expiresAt"));
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    productId: input.productId,
    merchantId: input.merchantId,
    merchantName: input.merchantName,
    displayPrice: input.displayPrice ?? null,
    availability: input.availability ?? "unknown",
    shippingNote: input.shippingNote ?? null,
    pointsNote: input.pointsNote ?? null,
    affiliateUrl: input.affiliateUrl ?? null,
    checkedAt: input.checkedAt,
    expiresAt: input.expiresAt ?? null,
    provenance: input.provenance,
  });
}
