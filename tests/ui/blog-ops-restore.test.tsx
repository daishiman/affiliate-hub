/** @tier 1 @req REQ-UX02, REQ-BOPS01, REQ-BOPS05, REQ-BOPS06 @types state-transition */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useActionState: (_action: unknown, initial: unknown) => [initial, () => undefined, false],
  };
});

const { BlogArticleRestoreForm } = await import("@/presentation/admin/publish/blog-article-form");
const { SiteNetworkRestoreForm } = await import("@/presentation/admin/publish/site-network-form");
const { BlogPageRestoreForm } = await import("@/presentation/admin/publish/blog-page-form");

const ROOT = resolve(import.meta.dirname, "../..");

describe("削除済みのブログ運用を戻す画面", () => {
  it("記事を同じ URL へ戻す操作を表示する", () => {
    const html = renderToStaticMarkup(
      <BlogArticleRestoreForm articleId="bar_deleted" title="削除済みの記事" />,
    );

    expect(html).toContain('name="intent" value="restore"');
    expect(html).toContain('name="articleId" value="bar_deleted"');
    expect(html).toContain("同じ URL で戻す");
  });

  it("サイト網を同じ URL へ戻す操作を表示する", () => {
    const html = renderToStaticMarkup(
      <SiteNetworkRestoreForm nodeId="snn_deleted" name="削除済みのブログ" />,
    );

    expect(html).toContain('name="intent" value="restore"');
    expect(html).toContain('name="nodeId" value="snn_deleted"');
    expect(html).toContain("同じ URL で戻す");
  });

  it("固定ページを元のID・本文・公開状態へ戻す操作を表示する", () => {
    const html = renderToStaticMarkup(
      <BlogPageRestoreForm pageId="lgp_deleted" siteSlug="hub" kind="profile" />,
    );

    expect(html).toContain('name="intent" value="restore"');
    expect(html).toContain('name="pageId" value="lgp_deleted"');
    expect(html).toContain('name="siteSlug" value="hub"');
    expect(html).toContain("元の内容で戻す");
  });

  it("通常一覧から削除済み一覧へ辿れ、削除済み一覧の画面がある", () => {
    const paths = [
      "src/app/admin/site-network/deleted/page.tsx",
      "src/app/admin/blog/articles/deleted/page.tsx",
    ];
    for (const path of paths) expect(existsSync(resolve(ROOT, path)), path).toBe(true);

    const network = readFileSync(resolve(ROOT, "src/app/admin/site-network/page.tsx"), "utf8");
    const articles = readFileSync(resolve(ROOT, "src/app/admin/blog/articles/page.tsx"), "utf8");
    expect(network).toContain('/admin/site-network/deleted');
    expect(articles).toContain('/admin/blog/articles/deleted');
  });
});
