import type {
  AffiliatePreviewFetcherPort,
  AffiliatePreviewFetchResult,
} from "@/application/ports/monetization";
import {
  AFFILIATE_PREVIEW_PROVIDER_POLICIES,
  extractAffiliatePreview,
  isAffiliatePreviewFetchHopAllowed,
  resolveAffiliatePreviewProvider,
  type AffiliatePreviewProviderPolicy,
} from "@/domain/monetization";
import { guardedFetch } from "./guarded-fetch";

const UNSUPPORTED_PROVIDER = "この提携先は自動取得に未対応です。";

export function createAffiliatePreviewFetcher(
  options: {
    readonly fetchImpl?: typeof fetch;
    readonly now?: () => Date;
    readonly policies?: readonly AffiliatePreviewProviderPolicy[];
  } = {},
): AffiliatePreviewFetcherPort {
  const policies = options.policies ?? AFFILIATE_PREVIEW_PROVIDER_POLICIES;
  const now = options.now ?? (() => new Date());
  return {
    async retrieve(rawUrl: string): Promise<AffiliatePreviewFetchResult> {
      const resolved = resolveAffiliatePreviewProvider(rawUrl, policies);
      if (!resolved.ok) return { kind: "rejected", reason: resolved.reason };

      const result = await guardedFetch(rawUrl, {
        ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
        validateHop: (url) =>
          isAffiliatePreviewFetchHopAllowed(url, resolved.policy) ? null : UNSUPPORTED_PROVIDER,
        acceptContentType: (raw) => {
          const value = raw?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
          return value === "text/html" || value === "application/xhtml+xml";
        },
        unsupportedContentTypeReason: "HTML以外の内容は自動解析しません。",
      });
      if (result.kind !== "ok") return { kind: result.kind, reason: result.reason };
      if (result.status < 200 || result.status >= 300) {
        return { kind: "failed", reason: `提携先から応答されませんでした。（${result.status}）` };
      }
      const contentType = result.contentType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
      if (contentType !== "text/html" && contentType !== "application/xhtml+xml") {
        return { kind: "failed", reason: "HTML以外の内容は自動解析しません。" };
      }
      return {
        kind: "ok",
        preview: extractAffiliatePreview({
          rawUrl,
          finalUrl: result.finalUrl,
          html: result.body,
          retrievedAt: now(),
          policy: resolved.policy,
        }),
      };
    },
  };
}
