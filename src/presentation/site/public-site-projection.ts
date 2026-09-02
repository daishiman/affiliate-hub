import type {
  BlogDeliveryPartRecord,
  BlogLayoutBandRecord,
  BlogLayoutSlotRecord,
  BlogTagRecord,
  FixedPageRecord,
  PublicBlogPort,
  PublicSiteReader,
  SiteNetworkRecord,
} from "@/application/ports/blog-ops";
import type {
  ArticleSummary,
  PublishedArticle,
} from "@/application/read-models/published-article";
import {
  evaluateSiteComposition,
  type CompositionReport,
} from "@/domain/authoring";
import {
  FIXED_PAGE_KINDS,
  FIXED_PAGE_PATH,
  type FixedPageKind,
} from "@/domain/blogops";
import { err, ok } from "@/domain/shared";
import type { PortResult } from "@/application/ports/common";
import type { SiteNavItem } from "@/presentation/ui";

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
  /** 下書きを含む作成済み実体。描画には使わない。 */
  readonly provisionedFixedPages: readonly FixedPageRecord[];
  readonly fixedPages: readonly FixedPageRecord[];
  readonly deliveryParts: readonly BlogDeliveryPartRecord[];
  readonly chrome: PublicSiteChromeProjection;
};

export type PublicSiteChromeProjection = {
  readonly headerSlots: readonly BlogLayoutSlotRecord[];
  readonly footerSlots: readonly BlogLayoutSlotRecord[];
  readonly fixedPageLinks: readonly SiteNavItem[];
};

export type PublicProjectionEntry = {
  readonly source: PublicDataSource;
  readonly port: PublicBlogPort;
};

const PROJECTION_ARTICLE_LIMIT = 100;

export type PublicSiteCompositionReport = CompositionReport & {
  /** 公開投影に実在しない固定ページ。設計図の pages 宣言からは導かない。 */
  readonly missingFixedPages: readonly FixedPageKind[];
};

/**
 * 読者が実際に見る公開投影から、管理表示と作成判定が共有する構成レポートを作る。
 * 宣言済みの `blueprint.pages` は数えない。作成完了には下書きを含む固定ページ実体を、
 * 内容の公開準備には公開中の固定ページ種別を使い、2 つの状態を混ぜない。
 */
export function projectPublicSiteComposition(
  projection: PublicSiteProjection,
): PublicSiteCompositionReport {
  const presentKinds = new Set(projection.fixedPages.map((page) => page.kind));
  const missingFixedPages = FIXED_PAGE_KINDS.filter((kind) => !presentKinds.has(kind));
  const report = evaluateSiteComposition(
    {
      network_node: projection.network.length,
      fixed_pages: projection.provisionedFixedPages.length,
      layout_bands: projection.provisionedBands.length,
      layout_slots: projection.provisionedSlots.length,
      categories: projection.reader.blueprint.categories.length,
      articles: projection.articles.length,
    },
    missingFixedPages.length > 0 ? ["fixed_pages"] : [],
  );
  return {
    ...report,
    missingFixedPages,
  };
}

export function projectPublicSiteChrome(
  siteSlug: string,
  input: Pick<PublicSiteProjection, "fixedPages" | "slots">,
): PublicSiteChromeProjection {
  return {
    headerSlots: input.slots.filter((slot) => slot.region === "header" && slot.enabled),
    footerSlots: input.slots.filter((slot) => slot.region === "footer" && slot.enabled),
    fixedPageLinks: FIXED_PAGE_KINDS.flatMap((kind) => {
      const page = input.fixedPages.find((candidate) => candidate.kind === kind);
      return page === undefined
        ? []
        : [{ href: `/s/${siteSlug}${FIXED_PAGE_PATH[kind]}`, label: page.title }];
    }),
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
  const [
    slots,
    provisionedSlots,
    bands,
    provisionedBands,
    articles,
    network,
    tags,
    provisionedFixedPages,
    fixedPages,
    deliveryParts,
  ] = await Promise.all([
    reader.listLayoutSlots(),
    reader.listProvisionedLayoutSlots(),
    reader.listLayoutBands(),
    reader.listProvisionedLayoutBands(),
    reader.listPublished(PROJECTION_ARTICLE_LIMIT),
    reader.listNetwork(),
    reader.listTags(),
    reader.listProvisionedFixedPages(),
    reader.listFixedPages(),
    reader.listDeliveryParts(),
  ]);
  for (const result of [
    slots,
    provisionedSlots,
    bands,
    provisionedBands,
    articles,
    network,
    tags,
    provisionedFixedPages,
    fixedPages,
    deliveryParts,
  ]) {
    if (!result.ok) return err(result.error);
  }
  if (
    !slots.ok ||
    !provisionedSlots.ok ||
    !bands.ok ||
    !provisionedBands.ok ||
    !articles.ok ||
    !network.ok ||
    !tags.ok ||
    !provisionedFixedPages.ok ||
    !fixedPages.ok ||
    !deliveryParts.ok
  ) {
    throw new Error("公開投影の Result 絞り込みに失敗しました。");
  }
  const base = {
    source: entry.source,
    reader,
    slots: slots.value,
    provisionedSlots: provisionedSlots.value,
    bands: bands.value,
    provisionedBands: provisionedBands.value,
    articles: articles.value,
    network: network.value,
    tags: tags.value,
    provisionedFixedPages: provisionedFixedPages.value,
    fixedPages: fixedPages.value,
    deliveryParts: deliveryParts.value,
  } as const;
  return ok({ ...base, chrome: projectPublicSiteChrome(siteSlug, base) });
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
