/** @tier 1 @req REQ-BOPS07, REQ-UX02 @types boundary, contract */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useActionState: (_action: unknown, initial: unknown) => [initial, () => undefined, false],
  };
});

const { PageThemeOverrideForms } = await import(
  "@/presentation/admin/publish/blog-appearance-form"
);

describe("ページ単位の配色上書き", () => {
  it("保存済みの上書きを値入りで編集でき、新規の対象はroute正本から選べる", () => {
    const html = renderToStaticMarkup(
      <PageThemeOverrideForms
        siteSlug="owned-blog"
        overrides={[
          {
            pagePath: "/operator",
            override: { brandTheme: "indigo-teal", colorMode: "dark" },
          },
        ]}
      />,
    );

    const pagePathInputs = html.match(/name="pagePath"/g) ?? [];
    expect(pagePathInputs).toHaveLength(2);
    expect(html).toMatch(
      /<input(?=[^>]*name="pagePath")(?=[^>]*value="\/operator")(?=[^>]*readOnly)/,
    );
    expect(html).toContain('<option value="indigo-teal" selected="">');
    expect(html).toContain('<option value="dark" selected="">');

    expect(html).toContain('<option value="/operator">運営者情報</option>');
    expect(html).toContain('<option value="/privacy">個人情報の扱い</option>');
    expect(html).not.toContain("/about");
  });
});
