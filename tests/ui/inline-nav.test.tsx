/** @tier 1 @req REQ-S09 @types a11y */
// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InlineNav } from "@/presentation/ui";

describe("同格の行き先を横に案内する", () => {
  it("nav と list の意味を持ち、読み上げる区切り文字を足さない", () => {
    render(
      <InlineNav
        label="関連する画面"
        items={[
          { href: "/admin/calendar", label: "カレンダー" },
          { href: "/admin/content", label: "記事" },
        ]}
        renderLink={(href, label) => <a href={href}>{label}</a>}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "関連する画面" });
    expect(within(nav).getByRole("list")).not.toBeNull();
    expect(within(nav).getAllByRole("listitem")).toHaveLength(2);
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "カレンダー",
      "記事",
    ]);
    expect(nav.textContent).not.toContain("／");
  });
});
