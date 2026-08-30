import { isInternalHost, normalizeHostname, sameHost } from "./link-ingestion";

/**
 * 貼り付けられた URL の中身を「見せるため」だけに読む層。
 *
 * **ここで取り出した値は表示専用であり、`ProductSnapshot` の入力にしない。**
 * 写しの正本は、操作者が見ている ASP の管理画面である
 * （`./product-snapshot.ts` の冒頭、`docs/product/design-decisions.md §2`）。
 * 自動抽出値をそのまま保存すると「登録した日の写し」が誰の見た表記か分からなくなり、
 * 表記の責任者を後から辿れなくなる。
 *
 * したがって `productName` / `merchantName` / `oneLine` に保存経路が無いのは
 * **配線忘れではなく意図**である。プレビューは検証支援として自己完結し、
 * 足りないものは `status: "partial"` と `reason` で手入力へ誘導する
 * （入力欄は `src/presentation/admin/earn/inbox-forms.tsx` の登録フォーム）。
 */

export type AffiliatePreviewStatus = "ready" | "partial" | "duplicate" | "failed" | "rejected";
export type AffiliatePreviewMethod = "json-ld" | "open-graph" | "html-meta" | "manual";

/**
 * 外部取得を許すのは、ホストと転送先を列挙できる提携先だけ。
 * imageDisplayAllowed は「ホストが安全」と「画像を表示できる」を分ける権利ゲートである。
 */
export type AffiliatePreviewProviderPolicy = {
  readonly id: string;
  readonly label: string;
  readonly fetchHosts: readonly string[];
  readonly imageHosts: readonly string[];
  readonly imageDisplayAllowed: boolean;
};

/**
 * 実サービス用は既定拒否。画像の再表示権利は推測せず、すべて図解へ退避する。
 * 新しい提携先を足すときは、fetchHosts と転送先の契約を同時にレビューする。
 */
export const AFFILIATE_PREVIEW_PROVIDER_POLICIES: readonly AffiliatePreviewProviderPolicy[] = [
  {
    id: "amazon-associates-jp",
    label: "Amazonアソシエイト",
    fetchHosts: ["amazon.co.jp", "www.amazon.co.jp", "amzn.to"],
    imageHosts: [],
    imageDisplayAllowed: false,
  },
  {
    id: "rakuten-affiliate-jp",
    label: "楽天アフィリエイト",
    fetchHosts: ["item.rakuten.co.jp", "hb.afl.rakuten.co.jp", "a.r10.to"],
    imageHosts: [],
    imageDisplayAllowed: false,
  },
] as const;

export type AffiliatePreview = {
  readonly rawUrl: string;
  readonly canonicalUrl: string | null;
  readonly productName: string | null;
  readonly merchantName: string | null;
  readonly oneLine: string | null;
  readonly imageUrl: string | null;
  readonly price: string | null;
  readonly currency: string | null;
  readonly retrievedAt: string;
  readonly sourceHost: string;
  readonly method: AffiliatePreviewMethod;
  readonly status: AffiliatePreviewStatus;
  readonly reason: string | null;
  readonly duplicateCandidates: readonly string[];
  readonly providerId: string;
  readonly providerLabel: string;
};

export function resolveAffiliatePreviewProvider(
  rawUrl: string,
  policies: readonly AffiliatePreviewProviderPolicy[] = AFFILIATE_PREVIEW_PROVIDER_POLICIES,
): { readonly ok: true; readonly policy: AffiliatePreviewProviderPolicy } | {
  readonly ok: false;
  readonly reason: string;
} {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { ok: false, reason: "URLとして読み取れませんでした。" };
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") {
    return { ok: false, reason: "https:// の成果リンクをそのまま貼り付けてください。" };
  }
  const hostname = normalizeHostname(url.hostname);
  if (isInternalHost(hostname)) {
    return { ok: false, reason: "内部ネットワーク宛のため取得しません。" };
  }
  const policy = policies.find((candidate) => candidate.fetchHosts.some((host) => sameHost(hostname, host)));
  return policy === undefined
    ? { ok: false, reason: "この提携先は自動取得に未対応です。" }
    : { ok: true, policy };
}

export function isAffiliatePreviewFetchHopAllowed(
  url: URL,
  policy: AffiliatePreviewProviderPolicy,
): boolean {
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return false;
  const hostname = normalizeHostname(url.hostname);
  if (isInternalHost(hostname)) return false;
  return policy.fetchHosts.some((host) => sameHost(hostname, host));
}

export function canDisplayAffiliatePreviewImage(
  rawUrl: string,
  policy: AffiliatePreviewProviderPolicy,
): boolean {
  if (!policy.imageDisplayAllowed) return false;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return false;
  const hostname = normalizeHostname(url.hostname);
  if (isInternalHost(hostname)) return false;
  return policy.imageHosts.some((host) => sameHost(hostname, host));
}

export function extractAffiliatePreview(input: {
  readonly rawUrl: string;
  readonly finalUrl: string;
  readonly html: string;
  readonly retrievedAt: Date;
  readonly policy: AffiliatePreviewProviderPolicy;
}): AffiliatePreview {
  const jsonProduct = findJsonLdProduct(input.html);
  const ogTitle = metaContent(input.html, "property", "og:title");
  const htmlTitle = titleContent(input.html);
  const productName = cleanText(stringValue(jsonProduct?.name)) ?? ogTitle ?? htmlTitle;
  const merchantName =
    cleanText(stringValue(objectValue(jsonProduct?.brand)?.name)) ??
    cleanText(stringValue(jsonProduct?.brand)) ??
    metaContent(input.html, "property", "og:site_name");
  const offer = firstOffer(jsonProduct?.offers);
  const price = cleanText(stringValue(offer?.price));
  const currency = cleanText(stringValue(offer?.priceCurrency));
  const oneLine =
    cleanText(stringValue(jsonProduct?.description)) ??
    metaContent(input.html, "property", "og:description") ??
    metaContent(input.html, "name", "description");
  const candidateImage =
    cleanText(firstString(jsonProduct?.image)) ?? metaContent(input.html, "property", "og:image");
  const imageUrl =
    candidateImage !== null && canDisplayAffiliatePreviewImage(candidateImage, input.policy)
      ? candidateImage
      : null;
  const canonicalCandidate = linkHref(input.html, "canonical");
  const canonicalUrl =
    canonicalCandidate !== null && isAffiliatePreviewFetchHopAllowed(safeUrl(canonicalCandidate), input.policy)
      ? canonicalCandidate
      : isAffiliatePreviewFetchHopAllowed(safeUrl(input.finalUrl), input.policy)
        ? input.finalUrl
        : null;
  const method: AffiliatePreviewMethod =
    jsonProduct !== null
      ? "json-ld"
      : ogTitle !== null
        ? "open-graph"
        : htmlTitle !== null || oneLine !== null
          ? "html-meta"
          : "manual";

  return {
    rawUrl: input.rawUrl,
    canonicalUrl,
    productName,
    merchantName,
    oneLine,
    imageUrl,
    price,
    currency,
    retrievedAt: input.retrievedAt.toISOString(),
    sourceHost: safeUrl(input.finalUrl).hostname,
    method,
    status: productName !== null && price !== null && currency !== null ? "ready" : "partial",
    reason:
      productName === null
        ? "商品名を自動取得できませんでした。確認して手入力してください。"
        : price === null
          ? "価格は取得できませんでした。現在価格は提携先で確認してください。"
          : null,
    duplicateCandidates: [],
    providerId: input.policy.id,
    providerLabel: input.policy.label,
  };
}

/** preview 固有。取得できなかった URL を、判定が必ず落ちる形へ倒す。 */
function safeUrl(raw: string): URL {
  try {
    return new URL(raw);
  } catch {
    return new URL("https://invalid.invalid/");
  }
}

function cleanText(value: string | null): string | null {
  if (value === null) return null;
  const cleaned = decodeEntities(value).replace(/\s+/g, " ").trim();
  return cleaned === "" ? null : cleaned;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function metaContent(html: string, key: "name" | "property", value: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = attributes(tag);
    if (attrs[key]?.toLowerCase() === value.toLowerCase()) return cleanText(attrs.content ?? null);
  }
  return null;
}

function linkHref(html: string, rel: string): string | null {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const attrs = attributes(tag);
    if ((attrs.rel ?? "").toLowerCase().split(/\s+/).includes(rel)) return cleanText(attrs.href ?? null);
  }
  return null;
}

function titleContent(html: string): string | null {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return cleanText(match?.[1]?.replace(/<[^>]+>/g, "") ?? null);
}

function attributes(tag: string): Readonly<Record<string, string>> {
  const output: Record<string, string> = {};
  const expression = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(expression)) {
    const key = match[1]?.toLowerCase();
    if (key !== undefined) output[key] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return output;
}

function findJsonLdProduct(html: string): Readonly<Record<string, unknown>> | null {
  const scripts = html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const match of scripts) {
    try {
      const parsed: unknown = JSON.parse(match[1] ?? "null");
      const found = findProductNode(parsed);
      if (found !== null) return found;
    } catch {
      // 壊れた JSON-LD は実行せず、次の安全な metadata へ進む。
    }
  }
  return null;
}

function findProductNode(value: unknown): Readonly<Record<string, unknown>> | null {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findProductNode(child);
      if (found !== null) return found;
    }
    return null;
  }
  const object = objectValue(value);
  if (object === null) return null;
  const type = object["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) return object;
  return findProductNode(object["@graph"]);
}

function objectValue(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : null;
}

function firstString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return null;
  return value.find((candidate): candidate is string => typeof candidate === "string") ?? null;
}

function firstOffer(value: unknown): Readonly<Record<string, unknown>> | null {
  if (Array.isArray(value)) return objectValue(value[0]);
  return objectValue(value);
}
