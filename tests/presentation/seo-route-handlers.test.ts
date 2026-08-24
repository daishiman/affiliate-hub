/**
 * @tier 1
 * @req REQ-SEO02
 * @types integration, boundary
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleSummary } from "@/application/read-models/published-article";

const routeState = vi.hoisted(() => ({
  articles: [] as ArticleSummary[],
  requestedLimits: [] as Array<number | undefined>,
  emitLlmsTxt: true,
  indexNowKey: undefined as string | undefined,
  siteError: null as null | { code: "NOT_FOUND" | "UPSTREAM_UNAVAILABLE"; message: string },
  articleError: null as null | { code: "UPSTREAM_UNAVAILABLE"; message: string },
}));

vi.mock("@/presentation/composition", () => ({
  readerActor: () => ({ kind: "anonymous" }),
  siteUseCases: async () => ({
    getSite: {
      execute: async () =>
        routeState.siteError === null
          ? {
              ok: true as const,
              value: {
                blueprint: {
                  name: "ガジェット研究室",
                  purpose: "実測で比べる。",
                  emitLlmsTxt: routeState.emitLlmsTxt,
                },
              },
            }
          : { ok: false as const, error: routeState.siteError },
    },
    listRecent: {
      execute: async (_actor: unknown, input: { readonly limit?: number }) => {
        routeState.requestedLimits.push(input.limit);
        return routeState.articleError === null
          ? { ok: true as const, value: routeState.articles }
          : { ok: false as const, error: routeState.articleError };
      },
    },
  }),
}));

vi.mock("@/infrastructure/platform/worker-env", () => ({
  tryGetWorkerEnv: async () => ({ INDEXNOW_KEY: routeState.indexNowKey }),
}));

const { GET: getSitemap } = await import("@/app/s/[site]/sitemap.xml/route");
const { GET: getFeed } = await import("@/app/s/[site]/feed.xml/route");
const { GET: getLlmsTxt } = await import("@/app/s/[site]/llms.txt/route");
const { GET: getRobotsTxt } = await import("@/app/s/[site]/robots.txt/route");
const { GET: getIndexNowKey } = await import("@/app/indexnow.txt/route");

function article(index: number): ArticleSummary {
  return {
    slug: `item-${index}`,
    siteSlug: "gadget",
    type: "ranking",
    title: `記事 ${index}`,
    summary: `要約 ${index}`,
    categorySlug: "laptops",
    updatedAt: "2026-08-24",
    authorName: "編集部",
  };
}

const context = { params: Promise.resolve({ site: "gadget" }) };

beforeEach(() => {
  routeState.articles = [];
  routeState.requestedLimits = [];
  routeState.emitLlmsTxt = true;
  routeState.indexNowKey = undefined;
  routeState.siteError = null;
  routeState.articleError = null;
});

describe("sitemap.xml Route Handler", () => {
  it("新着20件に切らず、21件目の公開記事も列挙する", async () => {
    routeState.articles = Array.from({ length: 21 }, (_, index) => article(index + 1));

    const response = await getSitemap(
      new Request("https://example.com/s/gadget/sitemap.xml"),
      context,
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    expect(routeState.requestedLimits).toEqual([50_001]);
    expect(body).toContain("https://example.com/s/gadget/best/item-21");
  });

  it("記事の読み取り失敗を空のsitemapにせず503で返す", async () => {
    routeState.articleError = {
      code: "UPSTREAM_UNAVAILABLE",
      message: "公開記事を読み込めませんでした。",
    };

    const response = await getSitemap(
      new Request("https://example.com/s/gadget/sitemap.xml"),
      context,
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toContain("公開記事");
  });

  it("50,000件を超える公開記事を黙って切らず503で返す", async () => {
    routeState.articles = Array(50_001).fill(article(1));

    const response = await getSitemap(
      new Request("https://example.com/s/gadget/sitemap.xml"),
      context,
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toContain("50,000");
  });
});

describe("feed.xml Route Handler", () => {
  it("RSSだけは明示した新着20件のpolicyで配る", async () => {
    routeState.articles = [article(1)];

    const response = await getFeed(
      new Request("https://example.com/s/gadget/feed.xml"),
      context,
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/rss+xml; charset=utf-8",
    );
    expect(routeState.requestedLimits).toEqual([20]);
    expect(body).toContain("https://example.com/s/gadget/best/item-1");
  });
});

describe("robots.txt Route Handler", () => {
  it("記事を読まずにクローラー方針とsitemapを配る", async () => {
    const response = await getRobotsTxt(
      new Request("https://example.com/s/gadget/robots.txt"),
      context,
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(routeState.requestedLimits).toEqual([]);
    expect(body).toContain("Sitemap: https://example.com/s/gadget/sitemap.xml");
  });
});

describe("llms.txt Route Handler", () => {
  it("公開アダプターがブログのbase path付きcanonical URLを配る", async () => {
    routeState.articles = [article(1)];

    const response = await getLlmsTxt(
      new Request("https://example.com/s/gadget/llms.txt"),
      context,
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(routeState.requestedLimits).toEqual([50_001]);
    expect(body).toContain("(https://example.com/s/gadget/best/item-1)");
  });

  it("無いブログを空文字200にせず404で返す", async () => {
    routeState.siteError = { code: "NOT_FOUND", message: "ブログが見つかりません。" };

    const response = await getLlmsTxt(
      new Request("https://example.com/s/missing/llms.txt"),
      { params: Promise.resolve({ site: "missing" }) },
    );

    expect(response.status).toBe(404);
  });

  it("設計図で無効な場合は空文字200にせず404で返す", async () => {
    routeState.emitLlmsTxt = false;

    const response = await getLlmsTxt(
      new Request("https://example.com/s/gadget/llms.txt"),
      context,
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toContain("出さない設定");
  });

  it("50,000件を超える公開記事を黙って切らず503で返す", async () => {
    routeState.articles = Array(50_001).fill(article(1));

    const response = await getLlmsTxt(
      new Request("https://example.com/s/gadget/llms.txt"),
      context,
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toContain("50,000");
  });
});

describe("indexnow.txt Route Handler", () => {
  it("鍵が未設定なら空の所有証明を200で配らない", async () => {
    const response = await getIndexNowKey();

    expect(response.status).toBe(404);
  });

  it("設定済みの鍵だけをtext/plainで配る", async () => {
    routeState.indexNowKey = "indexnow-test-key";

    const response = await getIndexNowKey();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toBe("indexnow-test-key");
  });
});
