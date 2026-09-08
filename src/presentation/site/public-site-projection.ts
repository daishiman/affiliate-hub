import type {
  BlogDeliveryPartRecord,
  BlogLayoutBandRecord,
  BlogLayoutSlotRecord,
  BlogTagRecord,
  PublicBlogPort,
  PublicSiteReader,
  SiteNetworkRecord,
} from "@/application/ports/blog-ops";
import type {
  ArticleSummary,
  PublishedArticle,
} from "@/application/read-models/published-article";
import type { SiteDocument } from "@/application/ports/site";
import { evaluateSiteComposition, type CompositionReport } from "@/domain/authoring/site-publication";
import { SITE_DOCUMENT_KEYS, type SiteDocumentKey } from "@/domain/authoring/site-routes";
import { collectAll, err, ok } from "@/domain/shared";
import type { PortResult } from "@/application/ports/common";

export type PublicDataSource = "live" | "sample";

/**
 * SiteFrame が 1 回だけ読み、公開画面全体へ渡す read model。
 * 画面ごとに slot/tag/band の query と変換を書き直さない。
 */
export type PublicSiteProjection = {
  readonly source: PublicDataSource;
  /** 同じ request で一度だけ解決した公開サイトへ束縛された読み口。 */
  readonly reader: PublicSiteReader;
  /** 描画対象の enabled 枠。 */
  readonly slots: readonly BlogLayoutSlotRecord[];
  /** 作成済みの全枠。描画には直接使わない。 */
  readonly provisionedSlots: readonly BlogLayoutSlotRecord[];
  /** 描画対象の enabled 帯。 */
  readonly bands: readonly BlogLayoutBandRecord[];
  /** 作成済みの全帯。描画には直接使わない。 */
  readonly provisionedBands: readonly BlogLayoutBandRecord[];
  readonly articles: readonly ArticleSummary[];
  readonly network: readonly SiteNetworkRecord[];
  readonly tags: readonly BlogTagRecord[];
  /**
   * 保存済みのサイト文書。**未整備のものは含まれない。**
   *
   * 描画には使わない（本文は `PolicyPage` が直接読む）。ここにあるのは
   * 作成完了を判定するための件数だけである。
   */
  readonly documents: readonly SiteDocument[];
  readonly deliveryParts: readonly BlogDeliveryPartRecord[];
  readonly chrome: PublicSiteChromeProjection;
};

export type PublicSiteChromeProjection = {
  readonly headerSlots: readonly BlogLayoutSlotRecord[];
  readonly footerSlots: readonly BlogLayoutSlotRecord[];
};

export type PublicProjectionEntry = {
  readonly source: PublicDataSource;
  readonly port: PublicBlogPort;
};

const PROJECTION_ARTICLE_LIMIT = 100;

export type PublicSiteCompositionReport = CompositionReport & {
  /** 公開投影に実在しないサイト文書。設計図の pages 宣言からは導かない。 */
  readonly missingDocuments: readonly SiteDocumentKey[];
};

/**
 * 読者が実際に見る公開投影から、管理表示と作成判定が共有する構成レポートを作る。
 *
 * 宣言済みの `blueprint.pages` は数えない。**数えるのは保存された行だけ**である。
 * サイト文書は「まだ書いていないものは行が無い」形で保存されるので、
 * 件数と不足種別はどちらも同じ 1 つの読み取りから導ける。
 * 旧・固定ページのように下書きと公開の 2 状態を持たないぶん、
 * 「作成は終わったが読者には出ていない」というずれがそもそも作れない。
 */
export function projectPublicSiteComposition(
  projection: PublicSiteProjection,
): PublicSiteCompositionReport {
  const presentKeys = new Set(projection.documents.map((document) => document.key));
  const missingDocuments = SITE_DOCUMENT_KEYS.filter((key) => !presentKeys.has(key));
  const report = evaluateSiteComposition({
    network_node: projection.network.length,
    site_documents: projection.documents.length,
    layout_bands: projection.provisionedBands.length,
    layout_slots: projection.provisionedSlots.length,
    categories: projection.reader.blueprint.categories.length,
    articles: projection.articles.length,
  });
  return {
    ...report,
    missingDocuments,
  };
}

export function projectPublicSiteChrome(
  input: Pick<PublicSiteProjection, "slots">,
): PublicSiteChromeProjection {
  return {
    headerSlots: input.slots.filter((slot) => slot.region === "header" && slot.enabled),
    footerSlots: input.slots.filter((slot) => slot.region === "footer" && slot.enabled),
  };
}

/** 一部だけ古い公開面を描かない。必要な読み取りの 1 つでも失敗したら全体を閉じる。 */
export async function readPublicSiteProjection(
  siteSlug: string,
  entry: PublicProjectionEntry,
): PortResult<PublicSiteProjection | null> {
  const opened = await entry.port.openSite(siteSlug);
  if (!opened.ok) return err(opened.error);
  if (opened.value === null) return ok(null);
  const reader = opened.value;
  const reads = await Promise.all([
    reader.listLayoutSlots(),
    reader.listProvisionedLayoutSlots(),
    reader.listLayoutBands(),
    reader.listProvisionedLayoutBands(),
    reader.listPublished(PROJECTION_ARTICLE_LIMIT),
    reader.listNetwork(),
    reader.listTags(),
    reader.listDocuments(),
    reader.listDeliveryParts(),
  ]);
  // 失敗の判定と型の絞り込みを 1 つの番人に集める。
  // 2 つに分けると、後ろ側は決して真にならない枝として残る。
  const collected = collectAll(...reads);
  if (!collected.ok) return err(collected.error);
  const [
    slots,
    provisionedSlots,
    bands,
    provisionedBands,
    articles,
    network,
    tags,
    documents,
    deliveryParts,
  ] = collected.value;
  const base = {
    source: entry.source,
    reader,
    slots,
    provisionedSlots,
    bands,
    provisionedBands,
    articles,
    network,
    tags,
    documents,
    deliveryParts,
  } as const;
  return ok({ ...base, chrome: projectPublicSiteChrome(base) });
}

/** 公開面と同じ fail-closed reader を通した構成レポート。 */
export async function readPublicSiteComposition(
  siteSlug: string,
  entry: PublicProjectionEntry,
): PortResult<PublicSiteCompositionReport | null> {
  const projected = await readPublicSiteProjection(siteSlug, entry);
  if (!projected.ok) return projected;
  return ok(
    projected.value === null ? null : projectPublicSiteComposition(projected.value),
  );
}

/** 記事詳細は slug が必要なので投影に含めず、port の公開境界をそのまま使う。 */
export function findProjectedArticle(
  reader: PublicSiteReader,
  slug: string,
): PortResult<PublishedArticle | null> {
  return reader.findArticleBySlug(slug);
}
