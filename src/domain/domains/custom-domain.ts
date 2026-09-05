import { type DomainError, type Result, err, ok, validationError } from "../shared";

/**
 * ブログの住所 (独自ドメイン)。
 *
 * ブログには必ず**既定住所** (`/s/<ブログ>`) がある。独自ドメインは
 * その上に乗るだけで、置き換えではない。この向きを型で固定する理由は、
 * 証明書の発行待ちや所有権の検証失敗で独自ドメインが使えない間も、
 * 読者が読める場所が消えてはならないからである
 * (architecture/arch-blog-operations-console.md AD-1 の帰結)。
 *
 * 外部 (Cloudflare for SaaS) の custom hostname が実体の正本で、
 * ここに持つのは**写し**である。写しは常に遅れうる前提で扱う。
 */

/**
 * 住所の検証段階。
 *
 * `pending` は登録しただけで DNS 設定を待っている状態、`verifying` は
 * Cloudflare 側が所有権と証明書を確認している最中、`active` は所有権が
 * 検証されて配信できる状態、`failed` は検証が通らなかった状態、
 * `revoked` は運用者が意図して取り下げた状態。
 *
 * `failed` と `revoked` を分けるのは、**誰が止めたか**が復旧手順を変える
 * からである。failed は DNS を直せば再試行できるが、revoked は運用判断
 * なので、同じ扱いにすると取り下げたはずの住所が自動で戻る。
 */
export const CUSTOM_DOMAIN_STATUSES = [
  "pending",
  "verifying",
  "active",
  "failed",
  "revoked",
] as const;
export type CustomDomainStatus = (typeof CUSTOM_DOMAIN_STATUSES)[number];

export const CUSTOM_DOMAIN_STATUS_LABEL: Readonly<Record<CustomDomainStatus, string>> = {
  pending: "DNS 設定待ち",
  verifying: "所有権を確認中",
  active: "配信中",
  failed: "確認できませんでした",
  revoked: "取り下げ済み",
};

/**
 * 証明書の状態。住所の状態とは別に持つ。
 *
 * 所有権が確認できていても証明書がまだ発行されていない時間帯があり、
 * その間は HTTPS で配信できない。1 つの列にまとめると
 * 「所有権は OK だが証明書が未発行」を表せず、運用者が待つべきか
 * 直すべきかを判断できなくなる。
 */
export const CERTIFICATE_STATUSES = [
  "none",
  "pending",
  "issued",
  "expired",
  "error",
] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

export const CERTIFICATE_STATUS_LABEL: Readonly<Record<CertificateStatus, string>> = {
  none: "未申請",
  pending: "発行待ち",
  issued: "発行済み",
  expired: "期限切れ",
  error: "発行エラー",
};

export type CustomDomain = {
  readonly id: string;
  readonly siteSlug: string;
  /** 小文字に正規化した完全修飾ホスト名。 */
  readonly hostname: string;
  readonly status: CustomDomainStatus;
  readonly certificateStatus: CertificateStatus;
  /**
   * このブログの正規の住所として使うか。
   * 配信可能な行（active かつ証明書 issued）にしか立てられない。
   */
  readonly canonical: boolean;
  /** Cloudflare for SaaS の custom hostname id。写しの出どころ。 */
  readonly externalHostnameId: string | null;
  /** 外部の状態を最後に写し取った時刻。null は一度も同期していない。 */
  readonly syncedAt: Date | null;
  /** 検証が失敗したときに運用者へ見せる理由。成功時は null。 */
  readonly lastError: string | null;
};

/**
 * 独自ドメインを読者向けの配信と正規 URL に使ってよいか。
 *
 * 所有権が確認済みでも、証明書が未発行なら HTTPS では配信できない。
 * 正規 URL の昇格と公開 Host の解決で同じ判定を使い、片方だけ開くことを防ぐ。
 */
export function isCustomDomainDeliveryEligible(
  domain: Pick<CustomDomain, "status" | "certificateStatus">,
): boolean {
  return domain.status === "active" && domain.certificateStatus === "issued";
}

/** ホスト名の 1 ラベルの上限 (RFC 1035)。 */
const MAX_LABEL_LENGTH = 63;
/** ホスト名全体の上限。末尾ドットを除いた表記での実用上限。 */
const MAX_HOSTNAME_LENGTH = 253;

/**
 * 独自ドメインとして受け付けられるホスト名かを判定し、正規化して返す。
 *
 * 大文字小文字は DNS で区別されないため、入力時点で小文字へ倒す。
 * 倒さずに保存すると、`Example.com` と `example.com` が別行として
 * 登録でき、同じ住所を 2 つのブログが持ててしまう。
 *
 * スキームやパスを含む入力 (`https://example.com/blog`) は、
 * 黙って切り落とさず拒否する。切り落とすと、利用者は自分が何を
 * 登録したのかを画面から確かめられない。
 */
export function validateHostname(input: string): Result<string, DomainError> {
  const value = input.trim().toLowerCase().replace(/\.$/, "");
  if (value === "") {
    return err(validationError("ドメイン名を入れてください。", "hostname"));
  }
  if (/[:/?#]/.test(value)) {
    return err(
      validationError(
        "ドメイン名だけを入れてください (https:// やパスは付けません)。",
        "hostname",
      ),
    );
  }
  if (value.length > MAX_HOSTNAME_LENGTH) {
    return err(
      validationError(`ドメイン名は ${MAX_HOSTNAME_LENGTH} 文字までです。`, "hostname"),
    );
  }
  const labels = value.split(".");
  if (labels.length < 2) {
    return err(
      validationError(
        "`example.com` のように、少なくとも 1 つのドットを含むドメイン名を入れてください。",
        "hostname",
      ),
    );
  }
  for (const label of labels) {
    if (label.length === 0 || label.length > MAX_LABEL_LENGTH) {
      return err(
        validationError(
          `ドメイン名の各部分は 1〜${MAX_LABEL_LENGTH} 文字にしてください。`,
          "hostname",
        ),
      );
    }
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label)) {
      return err(
        validationError(
          "ドメイン名は英数字とハイフンだけで、各部分をハイフンで始めたり終えたりできません。",
          "hostname",
        ),
      );
    }
  }
  return ok(value);
}

/**
 * 既定住所。独自ドメインの有無にかかわらず必ず存在する。
 *
 * 独自ドメインが失効しても、ここが配信を受け止める。
 */
export function defaultHostPath(siteSlug: string): string {
  return `/s/${siteSlug}`;
}

/**
 * 読者へ見せる正規の住所を決める。
 *
 * 配信可能かつ `canonical` な独自ドメインが 1 つあるときだけ、その
 * ホスト名を返す。それ以外は既定住所を返す。**非 active の行は
 * canonical が立っていても無視する** — 外部の写しが遅れて active から
 * 落ちた瞬間に、証明書の無いホストへ読者を送ってしまうためである。
 *
 * canonical が複数立っている場合は、どれか 1 つを選ばずに既定住所へ倒す。
 * 「正規の住所が 2 つある」は矛盾であり、片方を黙って選ぶと検索エンジンへ
 * 送る正規化情報が実行のたびに変わりうる。
 */
export function resolveCanonicalHost(
  siteSlug: string,
  domains: readonly CustomDomain[],
): { readonly kind: "custom"; readonly hostname: string } | {
  readonly kind: "default";
  readonly path: string;
} {
  const canonical = domains.filter((d) => d.canonical && isCustomDomainDeliveryEligible(d));
  if (canonical.length === 1) {
    return { kind: "custom", hostname: canonical[0].hostname };
  }
  return { kind: "default", path: defaultHostPath(siteSlug) };
}

/**
 * 住所の状態遷移が許されるかを判定する。
 *
 * 外部 (Cloudflare) の写し取りと、運用者の操作の**両方**がこの関数を
 * 通る。片方だけが遷移表を持つと、写し取りが運用者の取り下げを
 * 上書きして、取り下げたはずの住所が復活する。
 */
export function canTransition(from: CustomDomainStatus, to: CustomDomainStatus): boolean {
  // 同じ状態への遷移は常に許す。外部の写し取りは同じ結果を何度も
  // 運んでくるため、ここで弾くと定期同期が毎回エラーを積む。
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * 遷移表。
 *
 * `revoked` からの出口が無いのは意図である。運用者が取り下げた住所を
 * 外部の写し取りが `active` へ戻せてしまうと、取り下げが効かない。
 * 同じドメインを使い直すときは、この行を復活させるのではなく
 * **新しい行として登録し直す** (`pending` から始まる)。
 *
 * `active → failed` を許すのは、証明書の期限切れや外部での取り消しを
 * 写し取る経路が要るためで、これを塞ぐと失効に気づけない。
 * 一方 `active → pending` は無い。所有権が一度確認できた住所を
 * DNS 設定待ちへ戻すのは、失効の表現としては後退でしかない。
 */
const ALLOWED_TRANSITIONS: Readonly<
  Record<CustomDomainStatus, readonly CustomDomainStatus[]>
> = {
  pending: ["verifying", "failed", "revoked"],
  verifying: ["active", "failed", "revoked"],
  active: ["failed", "revoked"],
  // DNS を直したあとの再試行。`verifying` へ直接飛ばさないのは、
  // 再確認を始めるのは外部であって、こちらは要求を出すだけだからである。
  failed: ["pending", "revoked"],
  revoked: [],
};
