import type {
  AffiliatePreviewFetcherPort,
  CommercialAffiliateLinkRepositoryPort,
  CommercialLinkIngestionRepositoryPort,
} from "@/application/ports/monetization";
import { requireCapability } from "@/domain/identity";
import {
  type AffiliatePreview,
  normalizeAffiliateUrl,
} from "@/domain/monetization";
import {
  type DomainError,
  type Result,
  type WorkspaceId,
  ok,
  readDataClass,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

export type PreviewAffiliateUrlDeps = {
  readonly fetcher: AffiliatePreviewFetcherPort;
  readonly inbox: CommercialLinkIngestionRepositoryPort;
  readonly links: CommercialAffiliateLinkRepositoryPort;
};

export type PreviewAffiliateUrlInput = { readonly rawUrl: string };
export type PreviewAffiliateUrlOutput = { readonly preview: AffiliatePreview };

function failurePreview(
  rawUrl: string,
  status: "failed" | "rejected",
  reason: string,
): AffiliatePreview {
  let sourceHost = "—";
  try {
    sourceHost = new URL(rawUrl).hostname;
  } catch {
    // 解析できないURLは、本文として返さない。
  }
  return {
    rawUrl,
    canonicalUrl: null,
    productName: null,
    merchantName: null,
    oneLine: null,
    imageUrl: null,
    price: null,
    currency: null,
    retrievedAt: new Date(0).toISOString(),
    sourceHost,
    method: "manual",
    status,
    reason,
    duplicateCandidates: [],
    providerId: "manual",
    providerLabel: "手入力",
  };
}

function normalized(raw: string | null): string | null {
  if (raw === null) return null;
  const result = normalizeAffiliateUrl(raw);
  return result.ok ? result.value : null;
}

async function duplicateCandidates(
  deps: PreviewAffiliateUrlDeps,
  workspaceId: WorkspaceId,
  preview: AffiliatePreview,
): Promise<Result<readonly string[], DomainError>> {
  const [inbox, links] = await Promise.all([
    deps.inbox.list(workspaceId, { state: null }, { limit: 100, cursor: null }),
    deps.links.listWithSnapshot(workspaceId),
  ]);
  if (!inbox.ok) return inbox;
  if (!links.ok) return links;

  const original = normalized(preview.rawUrl);
  const canonical = normalized(preview.canonicalUrl);
  const productName = preview.productName?.trim().toLocaleLowerCase("ja-JP") ?? null;
  const found = new Set<string>();
  for (const item of inbox.value.items) {
    if (item.normalizedUrl === original || (canonical !== null && item.normalizedUrl === canonical)) {
      found.add(`inbox:${String(item.id)}`);
    }
  }
  for (const item of links.value) {
    const saved = normalized(item.link.originalUrl);
    if (
      saved === original ||
      (canonical !== null && saved === canonical) ||
      (productName !== null && item.snapshot.productName.trim().toLocaleLowerCase("ja-JP") === productName)
    ) {
      found.add(`link:${String(item.link.id)}`);
    }
  }
  return ok([...found]);
}

export function createPreviewAffiliateUrlUseCase(
  deps: PreviewAffiliateUrlDeps,
): UseCase<PreviewAffiliateUrlInput, PreviewAffiliateUrlOutput> {
  if (readDataClass(deps.inbox) !== "commercial" || readDataClass(deps.links) !== "commercial") {
    throw new Error("プレビューの重複照合は Commercial の保存先に限定します。");
  }
  return {
    async execute(actor, input): Promise<Result<PreviewAffiliateUrlOutput, DomainError>> {
      const allowed = requireCapability(actor, "affiliate.manage", "成果リンクのプレビュー");
      if (!allowed.ok) return allowed;

      const fetched = await deps.fetcher.retrieve(input.rawUrl);
      if (fetched.kind !== "ok") {
        return ok({ preview: failurePreview(input.rawUrl, fetched.kind, fetched.reason) });
      }

      const duplicates = await duplicateCandidates(deps, actor.workspaceId, fetched.preview);
      if (!duplicates.ok) return duplicates;
      if (duplicates.value.length === 0) return ok({ preview: fetched.preview });
      return ok({
        preview: {
          ...fetched.preview,
          status: "duplicate",
          reason: "同じURL、正規URL、または商品名の登録候補があります。新規登録前に確認してください。",
          duplicateCandidates: duplicates.value,
        },
      });
    },
  };
}
