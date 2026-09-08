/** @tier 2 */
import { getAllByRole, getByRole, queryByRole, within } from "@testing-library/dom";
import { createElement, Fragment, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ArticleSummary } from "@/application/read-models/published-article";
import type { PublicSiteBlueprint } from "@/application/usecases/site/read-site";
import {
  SAMPLE_SITE_SLUG,
  sampleSites,
} from "@/infrastructure/persistence/sample/site-sample-repository";
import {
  SiteHomeContent,
  toSiteHomeView,
  type SiteHomeView,
} from "@/presentation/site/home-content";
import type { PublicSiteProjection } from "@/presentation/site/public-site-projection";
import { renderDom } from "../support/render";

/**
 * トップ画面のおすすめは、「最新を別の見出しで再掲」ではない。
 * 運営者が並べた順に最初に読め、同じ記事は後続の最新／人気一覧に
 * もう一度出さない。機械が読む ItemList もその見える順と一致させる。
 */

const SITE = SAMPLE_SITE_SLUG;
const BLUEPRINT: PublicSiteBlueprint = (() => {
  const found = sampleSites().find((site) => site.slug === SITE)?.blueprint;
  if (found === undefined) throw new Error(`見本のブログ ${SITE} が見つかりません。`);
  return found;
})();

function article(slug: string, title: string): ArticleSummary {
  return {
    slug,
    siteSlug: SITE,
    type: "guide",
    title,
    summary: `${title}の要約`,
    categorySlug: BLUEPRINT.categories[0]?.slug ?? "guide",
    updatedAt: "2026-09-05T00:00:00.000Z",
    authorName: "編集部",
  };
}

const FEATURED_A = article("featured-a", "おすすめA");
const FEATURED_B = article("featured-b", "おすすめB");
const LATEST = article("latest", "最新の記事");
const RECENT = [FEATURED_A, LATEST, FEATURED_B] as const;
const FEATURED = [FEATURED_B, FEATURED_A] as const;

type FeaturedHomeView = SiteHomeView & {
  readonly featuredArticles: SiteHomeView["recentArticles"];
  readonly featuredSelectedCount: number;
};

function homeView(input: {
  readonly articles?: readonly ArticleSummary[];
  readonly featuredArticles?: readonly ArticleSummary[];
  readonly selectedCount?: number;
} = {}): FeaturedHomeView {
  return toSiteHomeView(SITE, BLUEPRINT, input.articles ?? RECENT, {
    featuredArticles: input.featuredArticles ?? FEATURED,
    featuredSelectedCount: input.selectedCount ?? FEATURED.length,
  } as never) as FeaturedHomeView;
}

describe("おすすめ記事の表示", () => {
  it("運営者の順で最初に表示し、後続の記事一覧から同じslugを除く", async () => {
    const view = homeView();

    expect(view.featuredArticles.map((card) => card.title)).toEqual([
      FEATURED_B.title,
      FEATURED_A.title,
    ]);
    expect(view.recentArticles.map((card) => card.title)).toEqual([LATEST.title]);

    const { document, cleanup } = await renderDom(createElement(SiteHomeContent, { view }));
    const headings = getAllByRole(document.body, "heading");
    const recommended = getByRole(document.body, "region", { name: "おすすめ記事" });
    const recent = getByRole(document.body, "region", { name: "記事を読む" });

    expect(headings.indexOf(within(recommended).getByRole("heading", { name: "おすすめ記事" })))
      .toBeLessThan(headings.indexOf(within(recent).getByRole("heading", { name: "記事を読む" })));
    expect(
      within(recommended).getAllByRole("link").map((link) => (link.textContent ?? "").trim()),
    ).toEqual([FEATURED_B.title, FEATURED_A.title]);
    expect(queryByRole(recent, "link", { name: FEATURED_A.title })).toBeNull();
    expect(queryByRole(recent, "link", { name: FEATURED_B.title })).toBeNull();
    cleanup();
  });

  it("selectedCountで、未設定と選択済み記事の一時非公開を別の理由として伝える", async () => {
    const neverSelected = await renderDom(
      createElement(SiteHomeContent, {
        view: homeView({ articles: [], featuredArticles: [], selectedCount: 0 }),
      }),
    );
    const temporarilyUnavailable = await renderDom(
      createElement(SiteHomeContent, {
        view: homeView({ articles: [], featuredArticles: [], selectedCount: 2 }),
      }),
    );

    expect(neverSelected.document.body.textContent).toContain(
      "おすすめ記事はまだ選ばれていません",
    );
    expect(temporarilyUnavailable.document.body.textContent).toContain(
      "選ばれたおすすめ記事は現在公開されていません",
    );
    expect(temporarilyUnavailable.document.body.textContent).not.toContain(
      "おすすめ記事はまだ選ばれていません",
    );
    neverSelected.cleanup();
    temporarilyUnavailable.cleanup();
  });
});

/*
 * page が構造化データに何を渡すかを見るための最小の世界。
 * SiteFrame のクロームや保存先はこの契約の対象外なので、children に
 * 公開投影を渡す境界だけに縮める。
 */
const pageWorld = vi.hoisted(() => ({
  context: null as null | {
    readonly siteSlug: string;
    readonly blueprint: PublicSiteBlueprint;
    readonly chrome: Record<string, never>;
    readonly projection: PublicSiteProjection;
  },
}));

vi.mock("@/presentation/site/page-frame", () => ({
  SiteFrame: async ({
    children,
  }: {
    readonly children: (value: unknown) => ReactNode | Promise<ReactNode>;
  }) => createElement(Fragment, null, await children(pageWorld.context)),
}));

vi.mock("@/presentation/http/request-origin", () => ({
  requestOriginFromNextHeaders: async () => "https://example.test",
}));

describe("おすすめを含むトップの構造化データ", () => {
  it("ItemListは見えるおすすめ→後続記事の重複なし順と一致する", async () => {
    pageWorld.context = {
      siteSlug: SITE,
      blueprint: BLUEPRINT,
      chrome: {},
      projection: {
        source: "live",
        reader: {
          blueprint: BLUEPRINT,
          summarizeReaderRatings: async () => ({ ok: true, value: {} }),
        },
        articles: RECENT,
        featuredArticles: { articles: FEATURED, selectedCount: FEATURED.length },
        bands: [],
        provisionedBands: [],
        slots: [],
        provisionedSlots: [],
        network: [],
        tags: [],
        documents: [],
        deliveryParts: [],
        chrome: { headerSlots: [], footerSlots: [] },
      } as unknown as PublicSiteProjection,
    };
    const { default: SiteHomePage } = await import("@/app/s/[site]/page");
    const { document, cleanup } = await renderDom(
      SiteHomePage({
        params: Promise.resolve({ site: SITE }),
        searchParams: Promise.resolve({}),
      }),
    );
    const itemListScript = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((script) => JSON.parse(script.textContent ?? "{}") as Record<string, unknown>)
      .find((block) => block["@type"] === "ItemList");
    const items = (itemListScript?.itemListElement ?? []) as readonly Record<string, unknown>[];

    expect(getByRole(document.body, "region", { name: "おすすめ記事" })).toBeDefined();
    expect(items.map((item) => item.name)).toEqual([
      FEATURED_B.title,
      FEATURED_A.title,
      LATEST.title,
    ]);
    expect(new Set(items.map((item) => item.url)).size).toBe(items.length);
    cleanup();
  });

  it("人気順の評価取得が失敗したら最新順と偽らず、おすすめだけを宣言する", async () => {
    pageWorld.context = {
      siteSlug: SITE,
      blueprint: BLUEPRINT,
      chrome: {},
      projection: {
        source: "live",
        reader: {
          blueprint: BLUEPRINT,
          summarizeReaderRatings: async () => ({
            ok: false,
            error: { message: "評価を読み込めません。", suggestedAction: null },
          }),
        },
        articles: RECENT,
        featuredArticles: { articles: FEATURED, selectedCount: FEATURED.length },
        bands: [],
        provisionedBands: [],
        slots: [],
        provisionedSlots: [],
        network: [],
        tags: [],
        documents: [],
        deliveryParts: [],
        chrome: { headerSlots: [], footerSlots: [] },
      } as unknown as PublicSiteProjection,
    };
    const { default: SiteHomePage } = await import("@/app/s/[site]/page");
    const { document, cleanup } = await renderDom(
      SiteHomePage({
        params: Promise.resolve({ site: SITE }),
        searchParams: Promise.resolve({ sort: "popular" }),
      }),
    );
    const itemListScript = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((script) => JSON.parse(script.textContent ?? "{}") as Record<string, unknown>)
      .find((block) => block["@type"] === "ItemList");
    const items = (itemListScript?.itemListElement ?? []) as readonly Record<string, unknown>[];

    expect(document.body.textContent).toContain("人気順を読み込めませんでした");
    expect(document.body.textContent).not.toContain(LATEST.title);
    expect(items.map((item) => item.name)).toEqual([FEATURED_B.title, FEATURED_A.title]);
    cleanup();
  });
});
