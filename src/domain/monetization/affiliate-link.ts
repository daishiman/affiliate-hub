import {
  type AffiliateLinkId,
  type AffiliateProgramId,
  type DomainError,
  type MerchantId,
  type ProductId,
  type Result,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * Affiliate & Monetization コンテキスト / AffiliateLink (プラットフォーム層 §19.2)。
 *
 * このコンテキストは Commercial 区分。Ranking から参照してはならない。
 *
 * 最重要の不変条件: ASP が発行した URL を改変しない。
 * パラメータを足す・短縮する・リダイレクトを挟むといった操作は、
 * 多くの ASP で規約違反になり、成果が計上されない原因にもなる。
 * 「気をつける」ではなく、型と検証で止める。
 */
export type AffiliateLink = {
  readonly id: AffiliateLinkId;
  readonly workspaceId: WorkspaceId;
  readonly programId: AffiliateProgramId;
  readonly productId: ProductId | null;
  readonly merchantId: MerchantId | null;
  /**
   * ASP が発行した URL。生成後は変更しない。
   * 変更が必要なら、新しいリンクを作り直す (履歴が残る)。
   */
  readonly originalUrl: string;
  /** 改変禁止か。ASP 側の規約に従う。既定は true。 */
  readonly alterationProhibited: boolean;
  /** 内部計測用のリンク識別子。URL には足さず、クリック記録側で紐づける。 */
  readonly trackingRef: string;
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
  readonly disabledAt: Date | null;
};

/** ASP 発行 URL へ足してはいけないパラメータの例。 */
const FORBIDDEN_APPENDED_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "ref", "tag"];

export function createAffiliateLink(input: {
  id: AffiliateLinkId;
  workspaceId: WorkspaceId;
  programId: AffiliateProgramId;
  productId?: ProductId | null;
  merchantId?: MerchantId | null;
  originalUrl: string;
  alterationProhibited?: boolean;
  trackingRef: string;
  createdAt: Date;
  expiresAt?: Date | null;
}): Result<AffiliateLink, DomainError> {
  const url = input.originalUrl.trim();
  if (url === "") {
    return err(validationError("リンク先の URL が必要です。", "originalUrl"));
  }
  if (!url.startsWith("https://")) {
    return err(
      validationError("リンクは https のものだけ登録できます。", "originalUrl"),
    );
  }
  if (input.trackingRef.trim() === "") {
    return err(
      validationError(
        "計測用の識別子が必要です。URL を改変せずに効果を測るために使います。",
        "trackingRef",
      ),
    );
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    programId: input.programId,
    productId: input.productId ?? null,
    merchantId: input.merchantId ?? null,
    originalUrl: url,
    alterationProhibited: input.alterationProhibited ?? true,
    trackingRef: input.trackingRef.trim(),
    createdAt: input.createdAt,
    expiresAt: input.expiresAt ?? null,
    disabledAt: null,
  });
}

/**
 * 実際に読者へ出す URL を決める。
 *
 * 改変禁止のリンクは originalUrl をそのまま返す。
 * 計測は trackingRef を使ってクリック側で行う (URL に触らない)。
 */
export function resolveOutboundUrl(link: AffiliateLink): Result<string, DomainError> {
  return ok(link.originalUrl);
}

/**
 * URL が改変されていないか検査する。
 *
 * 保存時・表示時の両方で呼ぶ。表示の直前にも呼ぶ理由は、
 * テンプレートや画面側でパラメータを足す実装が後から入りうるため。
 */
export function assertNotAltered(
  link: AffiliateLink,
  urlAboutToBeUsed: string,
): Result<true, DomainError> {
  if (!link.alterationProhibited) return ok(true);
  if (urlAboutToBeUsed === link.originalUrl) return ok(true);

  const added = detectAddedParams(link.originalUrl, urlAboutToBeUsed);
  return err(
    validationError(
      added.length > 0
        ? `リンクに ${added.join(", ")} が追加されています。ASP が発行した URL は変更できません。`
        : "ASP が発行した URL が変更されています。そのままの URL を使ってください。",
      "originalUrl",
    ),
  );
}

function detectAddedParams(original: string, altered: string): readonly string[] {
  try {
    const before = new URL(original).searchParams;
    const after = new URL(altered).searchParams;
    const added: string[] = [];
    for (const key of after.keys()) {
      if (!before.has(key)) added.push(key);
    }
    return added;
  } catch {
    return FORBIDDEN_APPENDED_PARAMS.filter((p) => altered.includes(p));
  }
}

export function isLinkUsable(link: AffiliateLink, at: Date): boolean {
  if (link.disabledAt !== null && link.disabledAt <= at) return false;
  if (link.expiresAt !== null && link.expiresAt <= at) return false;
  return true;
}
