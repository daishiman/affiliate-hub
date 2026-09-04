/**
 * リクエストから公開 URL の origin を決める唯一の規則。
 *
 * sitemap・metadata・JSON-LD・IndexNow がそれぞれ Host を連結すると、
 * 同じリクエストから違う URL が生まれる。ここは文字列だけを受け取る純関数にし、
 * Next.js と Web Request は薄い adapter から同じ判定へ渡す。
 *
 * `x-forwarded-*` は edge が設定する前提だが、値そのものは外部入力である。
 * 複数値やパス・userinfo を含む値を「先頭だけ採用」せず、曖昧なら null にする。
 */

export type RequestOriginInput = {
  /** Web Request が持つ URL。Next Server Component では取得できないため省略する。 */
  readonly requestUrl?: string | null;
  readonly host?: string | null;
  readonly forwardedHost?: string | null;
  readonly forwardedProtocol?: string | null;
  /** request URLにもforwarded protoにも無いNext Server Component用の安全な既定。 */
  readonly defaultProtocol?: "http" | "https";
};

const FORBIDDEN_HOST_CHARACTERS = /[\u0000-\u0020\u007f,/@\\?#]/u;

function requestUrl(input: string | null | undefined): URL | null | undefined {
  if (input === undefined || input === null) return undefined;
  try {
    const parsed = new URL(input);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}

function protocolOf(raw: string | null | undefined): "http" | "https" | null | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (raw === "" || raw !== raw.trim() || raw.includes(",")) return null;
  const normalized = raw.toLowerCase();
  return normalized === "http" || normalized === "https" ? normalized : null;
}

function originOf(protocol: "http" | "https", rawHost: string): string | null {
  if (
    rawHost === "" ||
    rawHost !== rawHost.trim() ||
    FORBIDDEN_HOST_CHARACTERS.test(rawHost)
  ) {
    return null;
  }

  try {
    const parsed = new URL(`${protocol}://${rawHost}`);
    if (
      parsed.protocol !== `${protocol}:` ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.hostname === "" ||
      parsed.pathname !== "/" ||
      parsed.search !== "" ||
      parsed.hash !== ""
    ) {
      return null;
    }
    if (parsed.port !== "") {
      const port = Number(parsed.port);
      if (!Number.isInteger(port) || port < 1 || port > 65_535) return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function resolveRequestOrigin(input: RequestOriginInput): string | null {
  const parsedRequestUrl = requestUrl(input.requestUrl);
  if (parsedRequestUrl === null) return null;

  const forwardedProtocol = protocolOf(input.forwardedProtocol);
  if (forwardedProtocol === null) return null;
  const protocol =
    forwardedProtocol ??
    (parsedRequestUrl?.protocol === "http:" ? "http" : undefined) ??
    (parsedRequestUrl?.protocol === "https:" ? "https" : undefined) ??
    input.defaultProtocol;
  if (protocol === undefined) return null;

  // forwarded host が在るのに壊れている場合、Host/request URLへfallbackしない。
  // fallbackすると、攻撃値を拒否した事実が見えないまま別のURLを配ってしまう。
  const selectedHost = input.forwardedHost ?? input.host ?? parsedRequestUrl?.host;
  if (selectedHost === undefined || selectedHost === null) return null;
  return originOf(protocol, selectedHost);
}

/** Web標準 Request を純関数へ写す薄いadapter。 */
export function requestOriginFromRequest(request: Request): string | null {
  return resolveRequestOrigin({
    requestUrl: request.url,
    host: request.headers.get("host"),
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProtocol: request.headers.get("x-forwarded-proto"),
  });
}
