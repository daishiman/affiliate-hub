/** @tier 2 @req REQ-SEO13 @types scenario, boundary */
// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BlogArticleRow } from "@/application/usecases/blog-ops/manage-blog-articles";
import { BLOG_ARTICLE_STATUS_LABEL } from "@/domain/blogops";
import BlogArticlesPage from "@/app/admin/blog/articles/page";

const { listArticles } = vi.hoisted(() => ({ listArticles: vi.fn() }));
vi.mock("@/presentation/composition", () => ({
  blogOpsEntry: async () => ({ ready: true, listArticles: { execute: listArticles } }),
  currentActor: async () => ({ workspaceId: "workspace" }),
}));
vi.mock("@/presentation/admin/admin-shell", () => ({ AdminShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/presentation/admin/publish/blog-site-options", async (original) => ({
  ...await original<Record<string, unknown>>(),
  blogSiteOptions: async () => ({ options: [{ value: "家具&暮らし", label: "家具と暮らし", categories: [] }], emptyReason: null }),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

function row(status: BlogArticleRow["status"]): BlogArticleRow {
  return {
    articleId: `internal-${status}`, siteSlug: "家具&暮らし", slug: `机/選び方?${status}`,
    title: `${status}の記事`, template: "T3", templateLabel: "解説", status,
    statusLabel: BLOG_ARTICLE_STATUS_LABEL[status], authorName: "書き手",
    updatedAt: "2026-09-08T00:00:00Z", publishedAt: status === "draft" ? null : "2026-09-01T00:00:00Z",
    freshness: "fresh", freshnessLabel: "新しい",
    health: { compliance: "healthy", delivery: "healthy", freshness: "fresh" },
    thumbnailUrl: null, thumbnailSource: "generated", thumbnailSourceLabel: "代替図版",
  };
}

describe("記事一覧から同じ記事の検索での見え方を確認する", () => {
  it("公開中の記事だけを、内部IDではなくブログと公開slugで観測区画へ結ぶ", async () => {
    const rows = [row("published"), row("draft"), row("review"), row("archived")];
    listArticles.mockResolvedValue({ ok: true, value: { rows, total: 4, staleCount: 0, emptyReason: null } });
    render(await BlogArticlesPage({ searchParams: Promise.resolve({}) }));
    const table = screen.getByRole("table", { name: "ブログ記事" });
    const publicRow = within(table).getByRole("link", { name: "publishedの記事" }).closest("tr")!;
    const link = within(publicRow).getByRole("link", { name: "検索での見え方" });
    const url = new URL(link.getAttribute("href")!, "https://example.test");
    expect(url.pathname).toBe("/admin/seo");
    expect(url.searchParams.get("site")).toBe("家具&暮らし");
    expect(url.searchParams.get("article")).toBe("机/選び方?published");
    expect(url.hash).toBe("#article-observations");
    expect(within(table).getAllByRole("link", { name: "検索での見え方" })).toHaveLength(1);
    for (const status of ["draft", "review", "archived"]) {
      const articleRow = within(table).getByRole("link", { name: `${status}の記事` }).closest("tr")!;
      expect(within(articleRow).getByText("検索での見え方は公開後に確認できます")).toBeDefined();
    }
    expect(within(table).getAllByRole("columnheader")).toHaveLength(7);
  });
});
