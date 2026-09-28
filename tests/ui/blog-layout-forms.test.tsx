/**
 * @tier 2
 * @req REQ-BOPS02
 * @types scenario, state-transition, boundary
 */
// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BlogLayoutBandForm, BlogLayoutSlotForm } from "@/presentation/admin/publish/blog-layout-form";

const { saveLayout } = vi.hoisted(() => ({ saveLayout: vi.fn() }));
vi.mock("@/presentation/admin/publish/blog-layout-action", () => ({
  manageBlogLayoutAction: saveLayout,
}));

afterEach(() => { cleanup(); saveLayout.mockReset(); });

type Target = { readonly siteSlug: string; readonly title: string; readonly enabled: boolean };
const CASES: readonly { readonly name: string; readonly form: (target: Target) => ReactElement }[] = [
  {
    name: "枠",
    form: (target) => <BlogLayoutSlotForm {...target} region="sidebar" slotKey="brand-tag-cloud" body="" position={0} />,
  },
  {
    name: "補助帯",
    form: (target) => <BlogLayoutBandForm {...target} band="navigator" position={0} itemLimit={3} />,
  },
];

describe("版面の編集対象", () => {
  it.each(CASES)("$name: 別ブログへ切り替えると、表示値と送信対象が同時に変わる", async ({ form }) => {
    const user = userEvent.setup();
    const view = render(form({ siteSlug: "first", title: "最初のブログ", enabled: false }));
    const title = screen.getByRole("textbox", { name: /見出し/ });
    await user.clear(title);
    await user.type(title, "保存していない下書き");
    await user.click(screen.getByRole("checkbox", { name: "読者に見せる" }));

    view.rerender(form({ siteSlug: "second", title: "次のブログ", enabled: false }));

    expect((screen.getByRole("textbox", { name: /見出し/ }) as HTMLInputElement).value).toBe("次のブログ");
    expect((screen.getByRole("checkbox", { name: "読者に見せる" }) as HTMLInputElement).checked).toBe(false);
    const data = new FormData(screen.getByRole("button", { name: /保存/ }).closest("form")!);
    expect(data.get("siteSlug")).toBe("second");
    expect(data.get("title")).toBe("次のブログ");
    expect(data.has("enabled")).toBe(false);
  });

  it.each(CASES)("$name: 保存中は表示設定のチェックも変更できない", async ({ form }) => {
    const user = userEvent.setup();
    let finish!: (state: { status: string; message: string }) => void;
    let submittedTarget: unknown;
    saveLayout.mockImplementation((_previous, data: FormData) => {
      submittedTarget = { siteSlug: data.get("siteSlug"), title: data.get("title"), enabled: data.has("enabled") };
      return new Promise((resolve) => { finish = resolve; });
    });
    render(form({ siteSlug: "first", title: "保存するブログ", enabled: true }));
    await user.click(screen.getByRole("button", { name: /保存/ }));
    await waitFor(() => expect(submittedTarget).toEqual({ siteSlug: "first", title: "保存するブログ", enabled: true }));
    const checkbox = screen.getByRole("checkbox", { name: "読者に見せる" }) as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    await user.click(checkbox);
    expect(checkbox.checked).toBe(true);
    finish({ status: "failed", message: "保存できませんでした。" });
    await screen.findByText("保存できませんでした。");
    expect(checkbox.disabled).toBe(false);
  });

});
