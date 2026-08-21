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

/**
 * 読者に見せる入口の道を、合言葉から作る。
 *
 * **道の形をここ 1 箇所だけで決める。** 画面側で `/go/` と書き始めると、
 * 入口の場所を変えたときに直し漏れが出て、その画面のクリックだけが
 * 数えられなくなる（画面は普通に動くので気づけない）。
 */
export function trackingPathForCode(code: string): string {
  return `/go/${code}`;
}

/** 読者に見せる入口の道。 */
export function trackingPath(link: TrackingLink): string {
  return trackingPathForCode(link.code);
}

/**
 * 転送のときに読む、平らにした形（仕様 03 §1.2 の resolver store）。
 *
 * **なぜ [[TrackingLink]] と [[AffiliateLink]] を突き合わせて解決しないのか。**
 * 転送は読者が待っている経路なので、表を 2 つ引くと待ち時間がそのぶん延びる。
 * そこで、公開のときに転送に要る値だけをここへ写しておき、
 * 転送時はこの 1 件だけを読む。
 *
 * 写しである以上、**元を書き換えたら写しも作り直す**必要がある。
 * これを忘れると古い URL へ送り続けるので、写しは上書きせず作り直す
 * （仕様 §1.1「転送先原本は不変とする。差し替え時は新規発行する」）。
 *
 * `destinationUrl` は ASP が発行した URL そのものである。
 * **ここへ入れる前に https であることを確かめる**（`isSafeDestination`）。
 * 合言葉から URL を組み立てる経路は作らない。作った時点で、
 * 合言葉を細工すれば任意の場所へ飛ばせる入口（オープンリダイレクト）になる。
 */
export type RedirectResolution = {
  readonly code: string;
  readonly workspaceId: WorkspaceId;
  readonly affiliateLinkId: AffiliateLinkId;
  /** ASP が発行した URL。1 文字も変えずにここへ入れ、1 文字も変えずに返す。 */
  readonly destinationUrl: string;
  /** どのブログの記事から押されたか。数える軸に使う。 */
  readonly siteSlug: string;
  readonly articlePath: string;
  readonly placement: string;
  readonly productId: string | null;
  readonly state: "active" | "disabled" | "expired";
  readonly expiresAt: Date | null;
};

/**
 * 転送の結果。**3 つしかない。**
 *
 * HTTP の番号をドメインに持ち込まず、状態に名前を付ける。
 * 番号への割り当ては入口（`src/app/go/[code]/route.ts`）が 1 箇所で行い、
 * 検査もそこで固定する。こうしないと「停止したリンクが 404 で返る」ような
 * 取り違えが、画面からは正常に見えたまま残る。
 *
 *   redirect … 転送してよい
 *   unknown  … 知らない合言葉（404）。**転送先を推測しない**
 *   gone     … あったが、もう使えない（410）。理由を読者に伝える
 */
export type RedirectOutcome =
  | { readonly kind: "redirect"; readonly url: string }
  | { readonly kind: "unknown" }
  | { readonly kind: "gone"; readonly reason: string };

/**
 * 転送先として保存してよい URL か。
 *
 * **保存する前と、転送する直前の両方で呼ぶ。** 保存時だけにすると、
 * 表を直接書き換えられたときに素通りする。転送時だけにすると、
 * 使えない値が保存され続けて、押した読者だけが気づく。
 */
export function isSafeDestination(url: string): boolean {
  return url.startsWith("https://");
}

/**
 * 合言葉から転送先を決める。
 *
 * 引数の `resolution` が `null` のときが「知らない合言葉」である。
 * 呼び出し側で `null` を分岐させると、分岐を書き忘れた経路が
 * **転送先を推測して埋める**ほうへ倒れやすい。ここで一緒に扱う。
 */
export function resolveRedirect(
  resolution: RedirectResolution | null,
  at: Date,
): RedirectOutcome {
  if (resolution === null) return { kind: "unknown" };
  if (resolution.state === "disabled") {
    return { kind: "gone", reason: "このリンクは停止されています。" };
  }
  if (resolution.state === "expired") {
    return { kind: "gone", reason: "このリンクの有効期限が切れています。" };
  }
  if (resolution.expiresAt !== null && resolution.expiresAt <= at) {
    return { kind: "gone", reason: "このリンクの有効期限が切れています。" };
  }
  if (!isSafeDestination(resolution.destinationUrl)) {
    // 保存されている値が https でない。**推測して直さない。**
    // ここを「http なら https に付け替える」で通すと、
    // 保存側の不備が転送側で隠れ、誰も気づかないまま残る。
    return { kind: "gone", reason: "このリンクの転送先が正しく登録されていません。" };
  }
  return { kind: "redirect", url: resolution.destinationUrl };
}
