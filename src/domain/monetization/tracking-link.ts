import {
  type AffiliateLinkId,
  type DomainError,
  type Result,
  type TrackingLinkId,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";
import type { AffiliateLink } from "./affiliate-link";

/**
 * Affiliate & Monetization コンテキスト / TrackingLink (§19.2.1・§21 E13)。
 *
 * このコンテキストは Commercial 区分。Ranking から参照してはならない。
 *
 * **ASP が発行した URL を書き換えずに、どこからのクリックかを数えるための仕組み。**
 * 素朴にやると `?utm_source=...` を足したくなるが、それは多くの ASP で規約違反になり、
 * 成果が計上されなくなる。そこで、こちら側に別の入口 (`/go/<code>`) を用意し、
 * 「どの記事のどの位置から来たか」はこちら側に記録して、
 * 転送先は [[AffiliateLink]] の `originalUrl` を **1 文字も変えずに** そのまま使う。
 *
 * 型の上でも、転送先を自由な文字列として持たせない。
 * 持てるのは AffiliateLinkId だけで、URL は転送のときに元リンクから取り出す。
 * こうすると「うっかり加工した URL を保存する」経路が存在しなくなる。
 */
export type TrackingLink = {
  readonly id: TrackingLinkId;
  readonly workspaceId: WorkspaceId;
  /** 転送先。URL 文字列ではなく ID で持つ（加工の余地を残さないため）。 */
  readonly affiliateLinkId: AffiliateLinkId;
  /** `/go/<code>` の部分。 */
  readonly code: string;
  /** どこに置いたリンクか（記事内の位置など）。集計の軸に使う。 */
  readonly placement: string;
  readonly createdAt: Date;
  readonly disabledAt: Date | null;
};

const CODE_PATTERN = /^[a-z0-9]{6,32}$/;

export function createTrackingLink(input: {
  id: TrackingLinkId;
  workspaceId: WorkspaceId;
  affiliateLinkId: AffiliateLinkId;
  code: string;
  placement: string;
  createdAt: Date;
}): Result<TrackingLink, DomainError> {
  const code = input.code.trim().toLowerCase();
  if (!CODE_PATTERN.test(code)) {
    return err(
      validationError(
        "計測用の合言葉は半角の小文字と数字で 6〜32 文字にしてください。",
        "code",
      ),
    );
  }
  if (input.placement.trim() === "") {
    return err(
      validationError(
        "設置場所が必要です。どこからのクリックか分けて数えるために使います。",
        "placement",
      ),
    );
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    affiliateLinkId: input.affiliateLinkId,
    code,
    placement: input.placement.trim(),
    createdAt: input.createdAt,
    disabledAt: null,
  });
}

/**
 * 転送先の URL を決める。
 *
 * **ここが「改変しない」を守る唯一の場所。** 元リンクの URL をそのまま返す。
 * 引数に足すものは無く、戻り値を加工する余地も呼び出し側に渡さない。
 */
export function resolveDestination(
  link: TrackingLink,
  affiliate: AffiliateLink,
  at: Date,
): Result<string, DomainError> {
  if (link.affiliateLinkId !== affiliate.id) {
    return err(
      validationError("計測リンクと転送先が対応していません。", "affiliateLinkId"),
    );
  }
  if (link.disabledAt !== null && link.disabledAt <= at) {
    return err(
      validationError("この計測リンクは停止されています。", "disabledAt"),
    );
  }
  if (affiliate.disabledAt !== null && affiliate.disabledAt <= at) {
    return err(
      validationError(
        "転送先の成果リンクが停止されています。提携状況を確認してください。",
        "affiliateLinkId",
      ),
    );
  }
  if (affiliate.expiresAt !== null && affiliate.expiresAt <= at) {
    return err(
      validationError(
        "転送先の成果リンクの有効期限が切れています。ASP で発行し直してください。",
        "affiliateLinkId",
      ),
    );
  }
  return ok(affiliate.originalUrl);
}

/** 読者に見せる入口の道。 */
export function trackingPath(link: TrackingLink): string {
  return `/go/${link.code}`;
}
