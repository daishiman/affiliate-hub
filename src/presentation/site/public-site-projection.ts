import type {
  BlogArticleDetail,
  BlogDeliveryPartRecord,
  BlogLayoutBandRecord,
  BlogLayoutSlotRecord,
  BlogTagRecord,
  FixedPageRecord,
  PublicBlogPort,
  PublicSiteReader,
  SiteNetworkRecord,
} from "@/application/ports/blog-ops";
import type { BlogArticle } from "@/domain/blogops";
import { FIXED_PAGE_KINDS, FIXED_PAGE_PATH } from "@/domain/blogops";
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
  readonly slots: readonly BlogLayoutSlotRecord[];
  readonly bands: readonly BlogLayoutBandRecord[];
  readonly articles: readonly BlogArticle[];
  readonly network: readonly SiteNetworkRecord[];
  readonly tags: readonly BlogTagRecord[];
  readonly fixedPages: readonly FixedPageRecord[];
  readonly deliveryParts: readonly BlogDeliveryPartRecord[];
  readonly chrome: PublicSiteChromeProjection;
};

export type PublicSiteChromeProjection = {
  readonly headerSlots: readonly BlogLayoutSlotRecord[];
  readonly footerSlots: readonly BlogLayoutSlotRecord[];
  readonly fixedPageLinks: readonly SiteNavItem[];
};

type PublicProjectionEntry = {
  readonly source: PublicDataSource;
  readonly port: PublicBlogPort;
};

const PROJECTION_ARTICLE_LIMIT = 100;

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
  const [slots, bands, articles, network, tags, fixedPages, deliveryParts] = await Promise.all([
    reader.listLayoutSlots(),
    reader.listLayoutBands(),
    reader.listPublished(PROJECTION_ARTICLE_LIMIT),
    reader.listNetwork(),
    reader.listTags(),
    reader.listFixedPages(),
    reader.listDeliveryParts(),
  ]);
  for (const result of [slots, bands, articles, network, tags, fixedPages, deliveryParts]) {
    if (!result.ok) return err(result.error);
  }
  if (
    !slots.ok ||
    !bands.ok ||
    !articles.ok ||
    !network.ok ||
    !tags.ok ||
    !fixedPages.ok ||
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
    fixedPages: fixedPages.value,
    deliveryParts: deliveryParts.value,
  } as const;
  return ok({ ...base, chrome: projectPublicSiteChrome(siteSlug, base) });
}

/** 記事詳細は slug が必要なので投影に含めず、port の公開境界をそのまま使う。 */
export function findProjectedArticle(
  reader: PublicSiteReader,
  slug: string,
): PortResult<BlogArticleDetail | null> {
  return reader.findArticleBySlug(slug);
}
