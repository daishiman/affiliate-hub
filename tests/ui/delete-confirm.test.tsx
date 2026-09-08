/** @tier 1 @req REQ-UX02, REQ-BOPS07 @types boundary */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DeleteFormState } from "@/presentation/admin/delete-form-state";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useActionState: (_action: unknown, initial: unknown) => [initial, () => undefined, false],
  };
});

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: unknown }) => (
    <a href={href}>{children as never}</a>
  ),
}));

const { DeleteConfirm } = await import("@/presentation/admin/delete-confirm");

const action = async (prev: DeleteFormState): Promise<DeleteFormState> => prev;

describe("理由付きの不可逆削除", () => {
  it("対象IDに加え、操作に必要な複数の隠し値を同じ確認欄から送る", () => {
    const html = renderToStaticMarkup(
      <DeleteConfirm
        action={action}
        toolName="delete_blog_tag"
        toolDescription="タグを消す"
        idName="tagId"
        idValue="btg_01"
        hiddenValues={[
          { name: "intent", value: "delete" },
          { name: "siteSlug", value: "owned-blog" },
        ]}
        label="タグ「運用」"
        verb="消す"
        consequence="記事は消えませんが、タグのまとまりは無くなります。"
      />,
    );

    expect(html).toContain('name="tagId" value="btg_01"');
    expect(html).toContain('name="intent" value="delete"');
    expect(html).toContain('name="siteSlug" value="owned-blog"');
    expect(html).toContain('name="reason"');
    expect(html).toContain("戻せないことを確かめました");
  });
});
