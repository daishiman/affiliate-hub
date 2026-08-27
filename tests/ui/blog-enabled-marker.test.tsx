/** @tier 1 @req REQ-BOPS02, REQ-BOPS03, REQ-BOPS08 @types boundary */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useActionState: (_action: unknown, initial: unknown) => [initial, () => undefined, false],
  };
});

const { BlogDeliveryForm } = await import("@/presentation/admin/blog-delivery-form");
const { BlogLayoutBandForm, BlogLayoutSlotForm } = await import(
  "@/presentation/admin/blog-layout-form"
);

describe("checkbox の存在marker", () => {
  it("表示を切ったフォームでも、enabled 欄自体は存在したと送れる", () => {
    const html = [
      renderToStaticMarkup(
        <BlogLayoutSlotForm
          siteSlug="owned-blog"
          region="header"
          slotKey="global-nav"
          title=""
          body=""
          position={0}
          enabled={false}
        />,
      ),
      renderToStaticMarkup(
        <BlogLayoutBandForm
          siteSlug="owned-blog"
          band="latest_posts"
          title="新着"
          position={0}
          itemLimit={3}
          enabled={false}
        />,
      ),
      renderToStaticMarkup(
        <BlogDeliveryForm
          siteSlug="owned-blog"
          part="rss_feeds"
          enabled={false}
          note=""
          position={0}
        />,
      ),
    ];

    for (const form of html) {
      expect(form).toContain('name="enabledPresent" value="1"');
      expect(form).toContain('type="checkbox" name="enabled"');
      expect(form).not.toContain('name="enabled" checked=""');
    }
  });
});
