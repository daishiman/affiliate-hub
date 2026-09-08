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

/**
 * 商品名を突き合わせるための鍵。**「同じ商品名」の範囲をここ 1 か所で決める。**
 *
 * URL の一致と違い、商品名の一致は判断である。ASP ごとに同じ商品が
 * `Alpha Studio 15` / `ＡＬＰＨＡ　ＳＴＵＤＩＯ１５` / `AlphaStudio15` と
 * 別の表記で降ってくる。素の比較だと全部「別商品」になる。
 *
 * **見逃す側と、多く挙げる側のどちらに倒すか。**
 * この一覧は保存を止めるものではなく、人が確定前に見る候補である。
 * 多く挙げれば人が 1 行余計に読む。見逃せば同じ商品が二重登録され、
 * 成果が 2 本に割れて**誰も気づかない**。後者のほうが高い。だから広げる。
 *
 *   1. NFKC — 全角英数と全角スペースを半角へ畳む。
 *   2. 空白を全部落とす — 単語の切り方が ASP ごとに違うため。
 *   3. `ja-JP` 固定の小文字化 — ロケール既定だとトルコ語環境で
 *      `I` が `ı` になり、走らせた場所で結果が変わる。
 *
 * 空文字になったものは鍵として使わない（名前が分からない者同士が
 * 全部お互いの重複になり、候補欄が意味を失う）。
 */
function productKey(name: string | null): string | null {
  if (name === null) return null;
  const key = name.normalize("NFKC").replace(/\s+/gu, "").toLocaleLowerCase("ja-JP");
  return key === "" ? null : key;
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
  const productName = productKey(preview.productName);
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
      (productName !== null && productKey(item.snapshot.productName) === productName)
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
