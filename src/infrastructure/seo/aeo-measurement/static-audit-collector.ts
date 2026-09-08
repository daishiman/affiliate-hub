import type { StaticAuditCollectorPort } from "@/application/ports/seo-measurement";
import type {
  JsonLdNodeObservation,
  ObservedImage,
  OpenGraphObservation,
  PageKey,
  PageObservation,
} from "@/domain/seo/aeo-measurement";
import { pageKeyOf } from "@/domain/seo/aeo-measurement";
import { domainError, err, ok } from "@/domain/shared";

/**
 * 系統①: 自分のサイトの公開 HTML を読んで、観測した事実だけを返す。
 *
 * ==========================================================================
 * 規則をここに書かない
 * ==========================================================================
 *
 * この関数は「title が短い」とは言わない。「title はこれ」としか言わない。
 * 判断は `auditPageObservation`（ドメイン）が持つ。分けているのは、
 * **規則を変えるたびに HTML を読み直さなくてよいようにする**ためである。
 *
 * ==========================================================================
 * なぜ HTMLRewriter か
 * ==========================================================================
 *
 * Workers の中で HTML を解く手段は、実質これしかない。DOM は無く、
 * 正規表現で `<title>` を拾う作りは、属性の順や改行や
 * コメントの中の似た文字列で静かに間違える。**静かに間違えるのが良くない。**
 * 所見が 0 件になっても「合っている」に見えるので、誰も気づかない。
 *
 * HTMLRewriter は流し読みなので、要素は現れた順に 1 度ずつ来る。
 * 見出しの段（`headingLevels`）が現れた順に並ぶのはそのためで、
 * 段の飛びを見るのに順序が要る。
 */

/**
 * 読みに行くときの上限。
 *
 * 自分のサイトを読むだけなので落ちにくいが、落ちたときに
 * 収集そのものが終わらなくなるのが困る。1 ページで待つ時間を切っておくと、
 * 1 ページの不調が「その回の収集が丸ごと止まる」に育たない。
 */
const FETCH_TIMEOUT_MS = 10_000;
/** Worker memoryと異常な公開HTMLの影響を1ページ内に閉じる。 */
export const STATIC_AUDIT_MAX_RESPONSE_BYTES = 1_000_000;
/** navigationを事実として保持する上限。超過を「リンクあり」の成功へ倒さない。 */
export const STATIC_AUDIT_MAX_LINK_TARGETS = 500;

export type StaticAuditCollectorDeps = {
  /** 差し替えられるようにしておく（テストで本物の網を使わないため）。 */
  readonly fetch?: typeof fetch;
};

export function createStaticAuditCollector(
  deps: StaticAuditCollectorDeps = {},
): StaticAuditCollectorPort {
  const doFetch = deps.fetch ?? fetch;

  return {
    async observe(url) {
      const key = pageKeyOf(url);
      if (!key.ok) {
        return err(
          domainError("VALIDATION_FAILED", `この URL は計測の対象にできません（${key.reason}）。`, {
            retryable: false,
            suggestedAction: "検索結果のような、問い合わせで中身が変わるページは対象外です。",
          }),
        );
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const response = await doFetch(url, {
          signal: controller.signal,
          headers: { accept: "text/html" },
        });
        if (!isExpectedResponseUrl(response, url)) {
          return unexpectedRedirect("page");
        }
        if (!response.ok) {
          return err(domainError("UPSTREAM_UNAVAILABLE", `ページが ${response.status} を返しました。`, {
            retryable: response.status >= 500,
            details: { status: String(response.status) },
          }));
        }
        const bounded = await responseWithinByteLimit(response);
        return ok(await readObservation(bounded, url, key.key));
      } catch (cause) {
        const limit = cause instanceof StaticAuditLimitError ? cause.reason
          : cause instanceof Error && (cause.name === "response_too_large" || cause.name === "link_limit_exceeded")
            ? cause.name : null;
        return err(
          domainError("UPSTREAM_UNAVAILABLE", limit === "response_too_large"
            ? "ページが読み取り上限を超えています。"
            : limit === "link_limit_exceeded"
              ? "ページ内のリンク先が読み取り上限を超えています。"
              : "ページの中身を読めませんでした。", {
            retryable: limit === null,
            details: { reason: limit ?? (cause instanceof Error ? cause.name : "unknown") },
          }),
        );
      } finally {
        clearTimeout(timer);
      }
    },
    async observeLlmsTxt(url) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const response = await doFetch(url, {
          signal: controller.signal,
          headers: { accept: "text/plain" },
        });
        if (!isExpectedResponseUrl(response, url)) {
          return unexpectedRedirect("llms");
        }
        if (response.status === 404) return ok("missing" as const);
        if (!response.ok) {
          return err(domainError("UPSTREAM_UNAVAILABLE", `AI向け案内ファイルが ${response.status} を返しました。`, {
            retryable: response.status >= 500,
            details: { status: String(response.status) },
          }));
        }
        const bounded = await responseWithinByteLimit(response);
        return ok((await bounded.text()).trim() === "" ? "empty" as const : "present" as const);
      } catch (cause) {
        const limit = cause instanceof StaticAuditLimitError ? cause.reason : null;
        return err(domainError("UPSTREAM_UNAVAILABLE", limit === "response_too_large"
          ? "AI向け案内ファイルが読み取り上限を超えています。"
          : "AI向け案内ファイルを読めませんでした。", {
          retryable: limit === null,
          details: { reason: limit ?? (cause instanceof Error ? cause.name : "unknown") },
        }));
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * fetch はredirectを追うため、HTTP成功だけで選択siteの応答とは言えない。
 * 最終URLが同じorigin・basePathに属し、依頼したPageKeyそのものかを確かめる。
 */
function isExpectedResponseUrl(response: Response, requestedUrl: string): boolean {
  // `new Response()`を返す差替えfetchはurlを持たない。本物のfetch Responseは常に
  // 最終URLを持つ。redirectが明示されたのにurlが無い場合だけは閉じる。
  if (response.url === "") return !response.redirected;
  try {
    const requested = new URL(requestedUrl);
    const actual = new URL(response.url);
    const boundary = siteBoundaryOf(requestedUrl);
    const requestedKey = pageKeyOf(requested.toString());
    const actualKey = pageKeyOf(actual.toString());
    return requested.origin.toLowerCase() === actual.origin.toLowerCase()
      && insideSiteBoundary(actual, boundary)
      && requestedKey.ok
      && actualKey.ok
      && requestedKey.key === actualKey.key;
  } catch {
    return false;
  }
}

function unexpectedRedirect(kind: "page" | "llms") {
  return err(domainError("UPSTREAM_UNAVAILABLE", kind === "page"
    ? "ページの取得先が確認対象の外へ移動しました。"
    : "AI向け案内ファイルの取得先が確認対象の外へ移動しました。", {
    retryable: false,
    details: { reason: "unexpected_redirect" },
  }));
}

class StaticAuditLimitError extends Error {
  constructor(readonly reason: "response_too_large" | "link_limit_exceeded") {
    super(reason);
    // HTMLRewriter はhandler内の例外を別realmへ渡すため、判別子をnameにも置く。
    this.name = reason;
  }
}

async function responseWithinByteLimit(response: Response): Promise<Response> {
  const announced = Number(response.headers.get("content-length"));
  if (Number.isFinite(announced) && announced > STATIC_AUDIT_MAX_RESPONSE_BYTES) {
    throw new StaticAuditLimitError("response_too_large");
  }
  if (response.body === null) return new Response(null, response);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    total += part.value.byteLength;
    if (total > STATIC_AUDIT_MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new StaticAuditLimitError("response_too_large");
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
}

/** 集めている途中の入れもの。読み終わるまで書き換わる。 */
type Collector = {
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  ogImage: string | null;
  jsonLdTypes: string[];
  headingLevels: number[];
  internalLinkCount: number;
  images: ObservedImage[];
  openGraph: { title: string | null; description: string | null; type: string | null; url: string | null; image: string | null };
  jsonLdNodes: JsonLdNodeObservation[];
  visibleDateTimes: string[];
  internalLinkPageKeys: Set<PageKey>;
};

async function readObservation(
  response: Response,
  url: string,
  pageKey: PageObservation["pageKey"],
): Promise<PageObservation> {
  const boundary = siteBoundaryOf(url);
  const found: Collector = {
    title: null,
    metaDescription: null,
    canonical: null,
    ogImage: null,
    jsonLdTypes: [],
    headingLevels: [],
    internalLinkCount: 0,
    images: [],
    openGraph: { title: null, description: null, type: null, url: null, image: null },
    jsonLdNodes: [],
    visibleDateTimes: [],
    internalLinkPageKeys: new Set(),
  };

  /*
    text ハンドラは 1 要素の中身を細切れで渡してくる（`lastInTextNode`）。
    継ぎ足してから読むのは、長い title や JSON-LD が途中で切れるためである。
    切れた JSON は読めず、`missing_json_ld` として出る —— つまり
    「構造化データを出しているのに無いと言われる」が起きる。
  */
  let titleBuffer = "";
  let jsonLdBuffer = "";

  const rewriter = new HTMLRewriter()
    .on("title", {
      text(chunk) {
        titleBuffer += chunk.text;
        if (chunk.lastInTextNode) {
          // 最初の title だけを採る。2 つ目以降はブラウザも無視する。
          found.title ??= titleBuffer;
          titleBuffer = "";
        }
      },
    })
    .on("meta", {
      element(element) {
        const name = element.getAttribute("name")?.toLowerCase();
        const property = element.getAttribute("property")?.toLowerCase();
        const content = element.getAttribute("content");
        if (content === null) return;
        if (name === "description") found.metaDescription ??= content;
        if (property === "og:image") found.ogImage ??= content;
        if (property === "og:title") found.openGraph.title ??= content;
        if (property === "og:description") found.openGraph.description ??= content;
        if (property === "og:type") found.openGraph.type ??= content;
        if (property === "og:url") found.openGraph.url ??= content;
        if (property === "og:image") found.openGraph.image ??= content;
      },
    })
    .on("link", {
      element(element) {
        if (element.getAttribute("rel")?.toLowerCase() === "canonical") {
          found.canonical ??= element.getAttribute("href");
        }
      },
    })
    .on('script[type="application/ld+json"]', {
      text(chunk) {
        jsonLdBuffer += chunk.text;
        if (!chunk.lastInTextNode) return;
        collectJsonLd(jsonLdBuffer, found.jsonLdTypes, found.jsonLdNodes);
        jsonLdBuffer = "";
      },
    })
    .on("h1, h2, h3, h4, h5, h6", {
      element(element) {
        const level = Number.parseInt(element.tagName.slice(1), 10);
        if (Number.isInteger(level)) found.headingLevels.push(level);
      },
    })
    .on("a[href]", {
      element(element) {
        const href = element.getAttribute("href") ?? "";
        const target = internalLinkTarget(href, url, pageKey, boundary);
        if (target === null) return;
        found.internalLinkCount += 1;
        found.internalLinkPageKeys.add(target);
        if (found.internalLinkPageKeys.size > STATIC_AUDIT_MAX_LINK_TARGETS) {
          throw new StaticAuditLimitError("link_limit_exceeded");
        }
      },
    })
    .on("time[datetime]", {
      element(element) {
        const value = element.getAttribute("datetime")?.trim();
        if (value) found.visibleDateTimes.push(value);
      },
    })
    .on("img", {
      element(element) {
        found.images.push({
          src: element.getAttribute("src") ?? "",
          /*
            空文字の alt は「説明の要らない飾りの絵」を表す正しい書き方なので、
            **有るものとして数える。** 空を欠落として扱うと、正しく書いた
            飾り画像が毎回所見に出て、直しようが無い指摘が積み上がる。
          */
          hasAlt: element.getAttribute("alt") !== null,
          hasDimensions:
            element.getAttribute("width") !== null && element.getAttribute("height") !== null,
        });
      },
    });

  // 変換した本文を最後まで読み切らないとハンドラが呼ばれない。
  // 中身は使わないが、読み捨てることに意味がある。
  await rewriter.transform(response).arrayBuffer();

  return {
    pageKey,
    url,
    title: found.title === null ? null : found.title.trim(),
    metaDescription: found.metaDescription,
    canonical: found.canonical,
    ogImage: found.ogImage,
    jsonLdTypes: found.jsonLdTypes,
    headingLevels: found.headingLevels,
    internalLinkCount: found.internalLinkCount,
    images: found.images,
    openGraph: found.openGraph satisfies OpenGraphObservation,
    jsonLdNodes: found.jsonLdNodes,
    visibleDateTimes: found.visibleDateTimes,
    internalLinkPageKeys: [...found.internalLinkPageKeys],
  };
}

/**
 * JSON-LD の塊から `@type` を集める。**読めない塊は黙って捨てる。**
 *
 * 捨てるのは、読めない JSON-LD が 1 つあっても他の塊は有効だからである。
 * ここで失敗させると、広告の埋め込みが壊れた JSON を出した日に
 * ページ全体の観測が落ちる。読めた分だけを事実として残す。
 */
function collectJsonLd(raw: string, typesInto: string[], nodesInto: JsonLdNodeObservation[]): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }

  // `@graph` の中に並べる書き方も、配列で並べる書き方も同じだけ使われている。
  const nodes: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
  for (const node of nodes) {
    if (typeof node !== "object" || node === null) continue;
    const record = node as Record<string, unknown>;
    const graph = record["@graph"];
    if (Array.isArray(graph)) nodes.push(...graph);

    const type = record["@type"];
    const types = typeof type === "string" ? [type]
      : Array.isArray(type) ? type.filter((one): one is string => typeof one === "string") : [];
    typesInto.push(...types);
    if (types.length > 0) {
      nodesInto.push({
        types,
        properties: Object.keys(record).filter((key) => key !== "@context" && key !== "@type"),
        datePublished: typeof record["datePublished"] === "string" ? record["datePublished"] : null,
        dateModified: typeof record["dateModified"] === "string" ? record["dateModified"] : null,
      });
    }
  }
}

/**
 * 同じブログの中を指すリンクか。
 *
 * `#section` や `mailto:` を数えない。数えると、目次だけがあって
 * 他の記事へ 1 本も繋がっていないページが「行き先あり」になり、
 * `no_internal_links` が永久に出なくなる。
 */
type SiteBoundary = { readonly origin: string; readonly basePath: string };

function siteBoundaryOf(rawUrl: string): SiteBoundary {
  const url = new URL(rawUrl);
  const match = /^\/s\/[^/]+/.exec(url.pathname);
  return { origin: url.origin.toLowerCase(), basePath: match?.[0] ?? "" };
}

function insideSiteBoundary(url: URL, boundary: SiteBoundary): boolean {
  return url.origin.toLowerCase() === boundary.origin
    && (url.pathname === boundary.basePath || url.pathname.startsWith(`${boundary.basePath}/`));
}

function internalLinkTarget(
  href: string,
  currentUrl: string,
  self: PageKey,
  boundary: SiteBoundary,
): PageKey | null {
  const trimmed = href.trim();
  if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("//")) return null;
  let absolute: URL;
  try {
    absolute = new URL(trimmed, currentUrl);
  } catch {
    return null;
  }
  if (absolute.origin.toLowerCase() !== boundary.origin) return null;
  if (boundary.basePath !== "" && absolute.pathname !== boundary.basePath
      && !absolute.pathname.startsWith(`${boundary.basePath}/`)) return null;
  const path = absolute.pathname.length > 1 ? absolute.pathname.replace(/\/+$/, "") : "/";
  if (path === `${boundary.basePath}/search` || path === `${boundary.basePath}/shortlist`) return null;
  const key = pageKeyOf(absolute.toString());
  return key.ok && key.key !== self ? key.key : null;
}
