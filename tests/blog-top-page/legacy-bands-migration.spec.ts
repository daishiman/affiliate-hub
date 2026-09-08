/** @tier 2 */
import {
  getByRole,
  getByText,
  queryByRole,
  within,
} from "@testing-library/dom";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import type {
  BlogLayoutBandRecord,
  BlogTagRecord,
  SiteNetworkRecord,
} from "@/application/ports/blog-ops";
import type { ArticleSummary } from "@/application/read-models/published-article";
import { toSummary } from "@/application/read-models/published-article";
import type { PublicSiteBlueprint } from "@/application/usecases/site/read-site";
import { SAMPLE_ARTICLES } from "@/infrastructure/persistence/sample/content-sample-data";
import {
  SAMPLE_SITE_SLUG,
  sampleSites,
} from "@/infrastructure/persistence/sample/site-sample-repository";
import { BlogTopBands } from "@/presentation/site/blog-top-bands";
import { SiteHomeContent, toSiteHomeView } from "@/presentation/site/home-content";
import type { PublicSiteProjection } from "@/presentation/site/public-site-projection";
import { intoDom, renderDom } from "../support/render";

/**
 * ブログトップの正本は「おすすめ→記事→カテゴリー→一覧への出口」の 4 区画。
 *
 * 旧 `BlogTopBands` にも同じ記事とカテゴリーを描く種類があるが、
 * 移行中に両方を出すと読者に同じ入口が 2 回届く。そのため、
 * `latest_posts` / `category_hub` だけを正本側に寄せ、
 * 別の価値を持つ `sister_sites` / `navigator` は後方互換として残す。
 *
 * ここで見るのは、読者が読む見出し・文章・リンクとその行き先だけ。
 * カードの class や入れ子構造は、この契約に無関係なので見ない。
 */

const SITE = SAMPLE_SITE_SLUG;
const BLUEPRINT: PublicSiteBlueprint = (() => {
  const blueprint = sampleSites().find((site) => site.slug === SITE)?.blueprint;
  if (blueprint === undefined) {
    throw new Error(`見本のブログ ${SITE} が見つかりません。`);
  }
  return blueprint;
})();

const ARTICLES = SAMPLE_ARTICLES.filter((article) => article.siteSlug === SITE).map(toSummary);

function band(over: Partial<BlogLayoutBandRecord>): BlogLayoutBandRecord {
  return {
    id: `blb_${over.band ?? "latest_posts"}`,
    siteSlug: SITE,
    band: "latest_posts",
    title: "",
    enabled: true,
    position: 1,
    itemLimit: 5,
    ...over,
  };
}

function legacyArticle(over: Partial<ArticleSummary> = {}): ArticleSummary {
  return {
    slug: "legacy-chair",
    siteSlug: SITE,
    type: "review",
    title: "旧帯が再掲する椅子の記事",
    summary: "旧帯に表示されていた記事です。",
    categorySlug: "chairs",
    updatedAt: "2026-09-01T09:00:00.000Z",
    authorName: "編集部",
    ...over,
  };
}

async function homeDom(
  articles: readonly ArticleSummary[],
  categories = BLUEPRINT.categories,
) {
  const view = toSiteHomeView(SITE, { ...BLUEPRINT, categories }, articles);
  return renderDom(createElement(SiteHomeContent, { view }));
}

async function bandsDom(
  bands: readonly BlogLayoutBandRecord[],
  over: {
    readonly articles?: readonly ArticleSummary[];
    readonly network?: readonly SiteNetworkRecord[];
    readonly tags?: readonly BlogTagRecord[];
  } = {},
) {
  const node = BlogTopBands({
    siteSlug: SITE,
    projection: {
      bands,
      articles: over.articles ?? [],
      network: over.network ?? [],
      tags: over.tags ?? [],
    } as unknown as PublicSiteProjection,
  });
  return node === null ? intoDom("") : renderDom(node);
}

describe("カテゴリーは、記事の再掲ではなく探すための索引", () => {
  it("カテゴリー名と 1 文説明から、それぞれの一覧へ行ける", async () => {
    const { document, cleanup } = await homeDom(ARTICLES);
    const directory = getByRole(document.body, "region", { name: "カテゴリーから探す" });
    const categoryNames = new Set(BLUEPRINT.categories.map((category) => category.name));
    const categoryLinks = within(directory)
      .getAllByRole("link")
      .filter((link) => categoryNames.has((link.textContent ?? "").trim()))
      .map((link) => ({
        name: (link.textContent ?? "").trim(),
        href: link.getAttribute("href"),
      }));
    const descriptions = BLUEPRINT.categories.map(
      (category) => getByText(directory, category.oneLine).textContent,
    );
    cleanup();

    expect(categoryLinks).toEqual(
      BLUEPRINT.categories.map((category) => ({
        name: category.name,
        href: `/s/${SITE}/categories/${category.slug}`,
      })),
    );
    expect(descriptions).toEqual(BLUEPRINT.categories.map((category) => category.oneLine));
  });

  it("正本の記事カードをカテゴリー区画に再掲しない", async () => {
    const article = ARTICLES[0];
    expect(article, "見本の公開記事がありません").toBeDefined();
    if (article === undefined) return;

    const { document, cleanup } = await homeDom([article]);
    const directory = getByRole(document.body, "region", { name: "カテゴリーから探す" });
    const articleIsRepeated =
      within(directory).queryByRole("link", { name: article.title }) !== null;
    cleanup();

    expect(articleIsRepeated, "同じ記事がカテゴリー区画に再掲されています").toBe(false);
  });

  it("カテゴリーが 0 件なら、壊れたのではなく未準備だと読者に伝える", async () => {
    const { document, cleanup } = await homeDom(ARTICLES, []);
    const directory = getByRole(document.body, "region", { name: "カテゴリーから探す" });
    const reason = within(directory).queryByText(/カテゴリー.*(?:ありません|準備中)/);
    cleanup();

    expect(reason, "0 件の理由が無言の空白になっています").not.toBeNull();
  });
});

describe("記事が無いブログの出口", () => {
  it("記事 0 件の理由は示すが、空の公開記事一覧へは誘導しない", async () => {
    const { document, cleanup } = await homeDom([]);
    const articles = getByRole(document.body, "region", { name: "記事を読む" });

    expect(getByText(articles, "まだ記事がありません")).toBeDefined();
    expect(
      getByText(articles, "最初の記事を準備しています。公開までしばらくお待ちください。"),
    ).toBeDefined();
    const emptyExitIsShown =
      queryByRole(document.body, "link", {
        name: "公開中の記事をすべて見る",
      }) !== null;
    cleanup();

    expect(emptyExitIsShown, "記事 0 件でも空の一覧への出口が出ています").toBe(false);
  });
});

describe("旧 BlogTopBands の移行", () => {
  it("latest_posts は正本の記事と重複するため出さない", async () => {
    const { document, cleanup } = await bandsDom(
      [band({ band: "latest_posts", title: "旧・新着記事" })],
      { articles: [legacyArticle()] },
    );
    const legacyHeadingIsShown =
      queryByRole(document.body, "heading", { name: "旧・新着記事" }) !== null;
    cleanup();

    expect(legacyHeadingIsShown, "latest_posts の帯が canonical 記事と二重で出ています").toBe(false);
  });

  it("category_hub は正本のカテゴリー索引と重複するため出さない", async () => {
    const { document, cleanup } = await bandsDom(
      [band({ band: "category_hub", title: "旧・カテゴリーハブ" })],
    );
    const legacyHeadingIsShown =
      queryByRole(document.body, "heading", {
        name: "旧・カテゴリーハブ",
      }) !== null;
    cleanup();

    expect(legacyHeadingIsShown, "category_hub の帯が canonical 索引と二重で出ています").toBe(false);
  });

  it("sister_sites と navigator は、旧設定から引き続き辿れる", async () => {
    const sister: SiteNetworkRecord = {
      id: "snn_sister",
      siteSlug: "sister",
      role: "sub",
      parentSlug: SITE,
      name: "姉妹サイト A",
      oneLine: "別のテーマを扱うブログです。",
      position: 1,
      status: "active",
    };
    const brand: BlogTagRecord = {
      id: "btg_acme",
      siteSlug: SITE,
      slug: "acme",
      name: "アクメ",
      description: "作り手から探す。",
      kind: "brand",
    };
    const { document, cleanup } = await bandsDom(
      [
        band({ id: "blb_sister", band: "sister_sites", title: "姉妹サイト", position: 1 }),
        band({ id: "blb_navigator", band: "navigator", title: "作り手から探す", position: 2 }),
      ],
      { network: [sister], tags: [brand] },
    );

    const sisterLink = getByRole(document.body, "link", { name: "姉妹サイト A" });
    const brandLink = getByRole(document.body, "link", { name: "アクメ" });
    cleanup();

    expect(sisterLink.getAttribute("href")).toBe("/s/sister");
    expect(brandLink.getAttribute("href")).toBe(`/s/${SITE}/search?tag=acme`);
  });
});
