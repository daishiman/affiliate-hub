import type {
  BlogArticleDetail,
  BlogDeliveryPartRecord,
  BlogLayoutBandRecord,
  BlogLayoutSlotRecord,
  BlogTagRecord,
  PublicBlogPort,
  PublicSiteReader,
  SiteNetworkRecord,
} from "@/application/ports/blog-ops";
import type { BlogArticle } from "@/domain/blogops";
import { err, ok } from "@/domain/shared";
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
  readonly slots: readonly BlogLayoutSlotRecord[];
  readonly bands: readonly BlogLayoutBandRecord[];
  readonly articles: readonly BlogArticle[];
  readonly network: readonly SiteNetworkRecord[];
  readonly tags: readonly BlogTagRecord[];
  readonly deliveryParts: readonly BlogDeliveryPartRecord[];
  readonly chrome: PublicSiteChromeProjection;
};

export type PublicSiteChromeProjection = {
  readonly headerSlots: readonly BlogLayoutSlotRecord[];
  readonly footerSlots: readonly BlogLayoutSlotRecord[];
};

type PublicProjectionEntry = {
  readonly source: PublicDataSource;
  readonly port: PublicBlogPort;
};

const PROJECTION_ARTICLE_LIMIT = 100;

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
  const [slots, bands, articles, network, tags, deliveryParts] = await Promise.all([
    reader.listLayoutSlots(),
    reader.listLayoutBands(),
    reader.listPublished(PROJECTION_ARTICLE_LIMIT),
    reader.listNetwork(),
    reader.listTags(),
    reader.listDeliveryParts(),
  ]);
  for (const result of [slots, bands, articles, network, tags, deliveryParts]) {
    if (!result.ok) return err(result.error);
  }
  if (
    !slots.ok ||
    !bands.ok ||
    !articles.ok ||
    !network.ok ||
    !tags.ok ||
    !deliveryParts.ok
  ) {
    throw new Error("公開投影の Result 絞り込みに失敗しました。");
  }
  const base = {
    source: entry.source,
    reader,
    slots: slots.value,
    bands: bands.value,
    articles: articles.value,
    network: network.value,
    tags: tags.value,
    deliveryParts: deliveryParts.value,
  } as const;
  return ok({ ...base, chrome: projectPublicSiteChrome(base) });
}

/** 記事詳細は slug が必要なので投影に含めず、port の公開境界をそのまま使う。 */
export function findProjectedArticle(
  reader: PublicSiteReader,
  slug: string,
): PortResult<BlogArticleDetail | null> {
  return reader.findArticleBySlug(slug);
}
