/** @tier 1 @req REQ-UX02, REQ-BOPS07 @types boundary */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useActionState: (_action: unknown, initial: unknown) => [initial, () => undefined, false],
  };
});

const { BlogTagForm } = await import("@/presentation/admin/publish/blog-tag-form");

describe("タグを消す前の案内", () => {
  it("記事件数を取得していないとき、「いま 0 本」と断定しない", () => {
    const html = renderToStaticMarkup(
      <BlogTagForm
        siteSlug="owned-blog"
        tagId="btg_owned"
        slug="owned-tag"
        name="保存済みタグ"
        description="説明"
        kind="topic"
      />,
    );

    expect(html).not.toContain("いま ");
    expect(html).toContain("タグを消しても記事は消えませんが、このまとまりは無くなります。");
  });
});
