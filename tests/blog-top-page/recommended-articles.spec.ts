/** @tier 2 */
import { getAllByRole, getByRole, queryByRole, within } from "@testing-library/dom";
import { createElement, Fragment, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PublicSiteReader } from "@/application/ports/blog-ops";
import type { ArticleSummary } from "@/application/read-models/published-article";
import type { PublicSiteBlueprint } from "@/application/usecases/site/read-site";
import { domainError } from "@/domain/shared/errors";
import { err, ok } from "@/domain/shared/result";
import type { SiteContext } from "@/presentation/site/page-frame";
import {
  SAMPLE_SITE_SLUG,
  sampleSites,
} from "@/infrastructure/persistence/sample/site-sample-repository";
import {
  SiteHomeContent,
  toSiteHomeView,
  type SiteHomeView,
} from "@/presentation/site/home-content";
import {
  aPublicSiteProjection,
  aPublicSiteReader,
  aSiteChrome,
} from "../support/factories";
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

/*
  ここには `as never` と `as FeaturedHomeView` の 2 つの偽装が置いてあった。
  `SiteHomeView` が `featuredArticles` / `featuredSelectedCount` を持つ前の名残で、
  **いまは正本の型がそのまま受け取る**。偽装を残すと、options の名前が変わった日に
  この呼び出しだけが黙って素通りする。
*/
function homeView(input: {
  readonly articles?: readonly ArticleSummary[];
  readonly featuredArticles?: readonly ArticleSummary[];
  readonly selectedCount?: number;
} = {}): SiteHomeView {
  return toSiteHomeView(SITE, BLUEPRINT, input.articles ?? RECENT, {
    featuredArticles: input.featuredArticles ?? FEATURED,
    featuredSelectedCount: input.selectedCount ?? FEATURED.length,
  });
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
const pageWorld = vi.hoisted(() => ({ context: null as null | SiteContext }));

/**
 * この検査が関心を持つのは**評価の読み取りが成功したか失敗したか**だけ。
 * 残りは `tests/support/factories.ts` の雛形が正本から埋める。
 *
 * 以前はここで投影を丸ごと手で組み、`as unknown as PublicSiteProjection` で
 * 締めていた。読み口は 14 個の口を持つのに 2 つしか無く、`chrome` は
 * `SiteChrome` ですらなかった——**型が表明している契約を、型の外から破っていた**。
 */
function contextWith(
  ratings: PublicSiteReader["summarizeReaderRatings"],
): SiteContext {
  return {
    siteSlug: SITE,
    blueprint: BLUEPRINT,
    chrome: aSiteChrome({ siteName: BLUEPRINT.name }),
    projection: aPublicSiteProjection({
      reader: aPublicSiteReader({ blueprint: BLUEPRINT, summarizeReaderRatings: ratings }),
      articles: RECENT,
      featuredArticles: { articles: FEATURED, selectedCount: FEATURED.length },
    }),
  };
}

vi.mock("@/presentation/site/page-frame", () => ({
  /*
    **`value: unknown` で受けない。**`vi.mock` の factory は戻り値の型検査が
    効かないので、ここを緩めると `SiteContext` に項目が増えたことに気づけない。
    以前は `chrome` を `Record<string, never>` で埋めていたが、これは
    `SiteChrome` ではない——**型の外から契約を破っていた**。
  */
  SiteFrame: async ({
    children,
  }: {
    readonly children: (value: SiteContext) => ReactNode | Promise<ReactNode>;
  }) =>
    createElement(
      Fragment,
      null,
      await children(
        pageWorld.context ?? (() => { throw new Error("pageWorld.context が未設定です。"); })(),
      ),
    ),
}));

vi.mock("@/presentation/http/request-origin", () => ({
  requestOriginFromNextHeaders: async () => "https://example.test",
}));

describe("おすすめを含むトップの構造化データ", () => {
  it("ItemListは見えるおすすめ→後続記事の重複なし順と一致する", async () => {
    pageWorld.context = contextWith(async () => ok({}));
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
    pageWorld.context = contextWith(async () =>
      err(domainError("UPSTREAM_UNAVAILABLE", "評価を読み込めません。", { retryable: true })),
    );
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
