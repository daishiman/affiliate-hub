/**
 * @tier 2
 * @req REQ-BOPS04, REQ-BOPS05
 * @types scenario, regression, boundary
 *
 * renderer関数単体ではなく、正規URLが呼ぶArticlePage全体を描く。
 */
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type PublishedArticle,
  projectBlogArticle,
} from "@/application/read-models/published-article";
import { serializeProse } from "@/domain/blogops";
import { renderMarkup } from "../support/render";

const state = vi.hoisted(() => ({ article: null as PublishedArticle | null }));

vi.mock("@/presentation/composition", () => ({
  publicArticleBlockOrder: async () => null,
  publicBlogEntry: async () => ({
    summarizeRating: async () => ({ ok: true as const, value: { count: 0, average: null } }),
  }),
  readerActor: () => ({ kind: "anonymous" as const }),
  siteUseCases: async () => ({
    getArticle: {
      execute: async () =>
        state.article === null
          ? { ok: false as const, error: { code: "NOT_FOUND" } }
          : { ok: true as const, value: state.article },
    },
    listRecent: { execute: async () => ({ ok: true as const, value: [] }) },
  }),
}));

vi.mock("@/presentation/http/request-origin", () => ({
  requestOriginFromNextHeaders: async () => null,
}));

vi.mock("@/presentation/site/page-frame", () => ({
  SiteFrame: async ({ children }: { readonly children: (context: unknown) => ReactNode | Promise<ReactNode> }) =>
    children({
      blueprint: { name: "机まわり研究室" },
      projection: {
        reader: {
          findSourceArticleId: async () => ({ ok: true as const, value: null }),
        },
      },
    }),
  ReadFailureBody: () => <p>記事を表示できません。</p>,
  stopIfMissing: () => undefined,
}));

const { ArticlePage } = await import("@/presentation/site/article-page");

function published(source: string): PublishedArticle {
  return projectBlogArticle({
    id: "article-page-prose",
    siteSlug: "desk",
    slug: "quiet-keyboard",
    type: "guide",
    title: "静かなキーボードの選び方",
    lead: "音を比べて選びます。",
    authorName: "編集部",
    publishedAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-02T00:00:00.000Z"),
    categorySlug: "keyboards",
    blocks: [{ id: "body", kind: "intro-box", heading: "選び方", body: source }],
  });
}

/** 永続化JSONはTypeScriptの型保証の外側から復元される。 */
function persistedArticleWithFormattedBody(formattedBody: unknown): PublishedArticle {
  const article = published("本文です。");

  return JSON.parse(
    JSON.stringify({
      ...article,
      sections: article.sections.map((section) => ({
        ...section,
        paragraphs: ["### これは文字通りの段落です。"],
        formattedBody,
      })),
    }),
  ) as PublishedArticle;
}

function renderArticlePage() {
  return renderMarkup(
    ArticlePage({
      siteSlug: "desk",
      slug: "quiet-keyboard",
      pathPrefix: "/guides",
      routeLabel: "選び方",
    }),
  );
}

beforeEach(() => {
  state.article = published("本文です。");
});

describe("正規URLの記事画面でのProse描画", () => {
  it("形式付き本文を、見出しと箇条書きのsemantic DOMで返す", async () => {
    state.article = published(
      serializeProse([
        { kind: "heading", level: 3, text: "打鍵音を見る" },
        { kind: "bullet-list", items: ["静音軸", "吸音材"] },
      ]),
    );

    const html = await renderArticlePage();

    expect(html).toMatch(/<h3[^>]*>打鍵音を見る<\/h3>/);
    expect(html).toContain("<ul><li>静音軸</li><li>吸音材</li></ul>");
  });

  it("形式の印が無い旧記事は、見出し記法から始まってもpのまま返す", async () => {
    state.article = {
      ...published("本文です。"),
      sections: [
        {
          id: "legacy",
          heading: "以前の記事",
          paragraphs: ["### これは文字通りの段落です。"],
        },
      ],
    };

    const html = await renderArticlePage();

    expect(html).toContain("<p>### これは文字通りの段落です。</p>");
    expect(html).not.toMatch(/<h3[^>]*>これは文字通りの段落です。<\/h3>/);
  });

  it("未解決の商品カード位置を、空白にせず明示する", async () => {
    state.article = published(
      serializeProse([{ kind: "product-card", productId: "product-1" }]),
    );

    const html = await renderArticlePage();

    expect(html).toContain("この位置の商品情報は現在表示できません。");
  });

  it.each([
    { name: "null", formattedBody: null },
    { name: "配列", formattedBody: [] },
    { name: "primitive", formattedBody: 1 },
    { name: "source欠落", formattedBody: { format: "prose-v1", version: 1 } },
  ])(
    "永続化JSONの壊れたformattedBody（$name）は、旧段落へ戻す",
    async ({ formattedBody }) => {
      state.article = persistedArticleWithFormattedBody(formattedBody);

      const html = await renderArticlePage();

      expect(html).toContain("<p>### これは文字通りの段落です。</p>");
      expect(html).not.toMatch(/<h3[^>]*>これは文字通りの段落です。<\/h3>/);
    },
  );
});
