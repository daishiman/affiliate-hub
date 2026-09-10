/**
 * @tier 2
 * @req REQ-BOPS02
 * @types screen-states, scenario
 */
import { describe, expect, it } from "vitest";
import { intoDom, renderRouteIn } from "../support/render";

describe("版面管理の表示と保存対象", () => {
  it("公開面に効く補助帯を編集し、同じブログの公開結果へ進める", async () => {
    const html = await renderRouteIn("blog-ops-ready", "../../src/app/admin/blog/layout/page.tsx", {
      searchParams: Promise.resolve({}),
    });
    const { document, cleanup } = intoDom(html);
    try {
      const forms = [...document.querySelectorAll("form")];
      const bands = forms.flatMap((form) => {
        const input = form.querySelector<HTMLInputElement>('input[name="band"]');
        return input === null ? [] : [input.value];
      });
      expect(bands.sort()).toEqual(["navigator", "sister_sites"]);
      expect(document.body.textContent).toContain("最新・人気の記事とカテゴリーは、公開記事から自動で表示されます");
      expect(document.querySelector('a[href^="/s/"]')?.textContent).toContain("公開ブログで確認する");
      const headings = [...document.querySelectorAll("h2,h3")].map((heading) => heading.textContent);
      expect(headings.some((heading) => heading?.includes("brand-tag-cloud"))).toBe(false);
      expect(headings.some((heading) => heading?.includes("ブランドから探す"))).toBe(true);
    } finally {
      cleanup();
    }
  });
});
