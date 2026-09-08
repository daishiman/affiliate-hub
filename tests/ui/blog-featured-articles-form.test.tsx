/**
 * @tier 2
 * @req REQ-BOPS02
 * @types screen-states, scenario, boundary
 */
// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArticleSummary } from "@/application/read-models/published-article";
import * as blogLayoutForms from "@/presentation/admin/publish/blog-featured-articles-form";

/**
 * 運営者は数値の position を編集するのではなく、記事名を見ながら
 * 足す・上下に動かす・外す。ここでは class や内部 state は見ず、
 * 読み上げから辨別できる操作名、見える順序、公開 URL だけを見る。
 */

const { saveFeatured } = vi.hoisted(() => ({ saveFeatured: vi.fn() }));

vi.mock("@/presentation/admin/publish/blog-layout-action", () => ({
  manageBlogLayoutAction: async () => ({ status: "idle", message: "" }),
  manageBlogFeaturedArticlesAction: saveFeatured,
}));

type SelectedArticle = {
  readonly articleSlug: string;
  readonly article: ArticleSummary | null;
};

type FeaturedFormProps = {
  readonly siteSlug: string;
  readonly selectedArticles: readonly SelectedArticle[];
  readonly candidateArticles: readonly ArticleSummary[];
};

function featuredForm(): ComponentType<FeaturedFormProps> {
  const found = (
    blogLayoutForms as unknown as {
      readonly BlogFeaturedArticlesForm?: ComponentType<FeaturedFormProps>;
    }
  ).BlogFeaturedArticlesForm;
  expect(found, "版面画面におすすめ記事の編集欄がまだありません").toBeTypeOf(
    "function",
  );
  return found as ComponentType<FeaturedFormProps>;
}

function article(slug: string, title: string): ArticleSummary {
  return {
    slug,
    siteSlug: "hub",
    type: "guide",
    title,
    summary: `${title}の要約`,
    categorySlug: "guide",
    updatedAt: "2026-09-05T00:00:00.000Z",
    authorName: "編集部",
  };
}

const A = article("featured-a", "最初の記事");
const B = article("featured-b", "二番目の記事");
const C = article("featured-c", "追加候補の記事");

function renderForm(
  over: Partial<FeaturedFormProps> = {},
) {
  const Form = featuredForm();
  return render(
    <Form
      siteSlug="hub"
      selectedArticles={[
        { articleSlug: A.slug, article: A },
        { articleSlug: B.slug, article: B },
      ]}
      candidateArticles={[C]}
      {...over}
    />,
  );
}

function selectedLinkNames(): readonly string[] {
  return screen
    .getAllByRole("link")
    .map((link) => (link.textContent ?? "").trim())
    .filter((name) => [A.title, B.title, C.title].includes(name));
}

function disabled(control: HTMLElement): boolean {
  return control.hasAttribute("disabled");
}

afterEach(() => { cleanup(); saveFeatured.mockReset(); });

describe("おすすめ記事の編集欄", () => {
  it("現在の順と公開URLを見せ、記事名で並べ替え・解除できる", () => {
    renderForm();

    expect(selectedLinkNames()).toEqual([A.title, B.title]);
    expect(screen.getByRole("link", { name: A.title }).getAttribute("href")).toBe(
      "/s/hub/guides/featured-a",
    );
    expect(disabled(screen.getByRole("button", { name: `${A.title}を1つ上へ` }))).toBe(true);
    expect(disabled(screen.getByRole("button", { name: `${A.title}を1つ下へ` }))).toBe(false);
    expect(disabled(screen.getByRole("button", { name: `${B.title}を1つ上へ` }))).toBe(false);
    expect(disabled(screen.getByRole("button", { name: `${B.title}を1つ下へ` }))).toBe(true);
    expect(
      disabled(screen.getByRole("button", { name: `${A.title}をおすすめから外す` })),
    ).toBe(false);
    expect(
      disabled(screen.getByRole("button", { name: `${B.title}をおすすめから外す` })),
    ).toBe(false);
    expect(disabled(screen.getByRole("button", { name: "おすすめ記事の並びを保存" }))).toBe(
      false,
    );
  });

  it("上下移動・解除・公開中候補の追加を画面上で確認してから保存できる", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: `${B.title}を1つ上へ` }));
    expect(selectedLinkNames()).toEqual([B.title, A.title]);

    await user.click(screen.getByRole("button", { name: `${A.title}をおすすめから外す` }));
    await user.selectOptions(screen.getByRole("combobox", { name: "追加する公開済み記事" }), C.slug);
    await user.click(screen.getByRole("button", { name: "おすすめに追加" }));

    expect(selectedLinkNames()).toEqual([B.title, C.title]);
  });

  it("一時非公開の選択は消さず理由を示し、3件選択済みなら追加を止める", () => {
    renderForm({
      selectedArticles: [
        { articleSlug: A.slug, article: A },
        { articleSlug: B.slug, article: B },
        { articleSlug: "temporarily-private", article: null },
      ],
    });

    expect(screen.getByText("temporarily-private")).toBeDefined();
    expect(screen.getByText(/(?:現在|一時的に)公開されていません/)).toBeDefined();
    expect(
      disabled(
        screen.getByRole("button", {
          name: "temporarily-privateをおすすめから外す",
        }),
      ),
    ).toBe(false);
    expect(disabled(screen.getByRole("combobox", { name: "追加する公開済み記事" }))).toBe(true);
    expect(screen.getByText(/3件まで/)).toBeDefined();
  });

  it("まだ選んでいないときは、壊れた空白ではなく次の操作を示す", () => {
    renderForm({ selectedArticles: [] });

    expect(screen.getByText("おすすめ記事はまだ選ばれていません")).toBeDefined();
    const picker = screen.getByRole("combobox", { name: "追加する公開済み記事" });
    expect(within(picker).getByRole("option", { name: C.title })).toBeDefined();
  });

  it("ブログを切り替えたら、編集下書きと送信先を同じブログへ切り替える", async () => {
    const user = userEvent.setup();
    const view = renderForm();
    await user.click(screen.getByRole("button", { name: `${B.title}を1つ上へ` }));
    const Form = featuredForm();
    view.rerender(<Form siteSlug="another" selectedArticles={[{ articleSlug: C.slug, article: C }]} candidateArticles={[]} />);

    expect(selectedLinkNames()).toEqual([C.title]);
    const form = screen.getByRole("button", { name: "おすすめ記事の並びを保存" }).closest("form")!;
    expect(new FormData(form).get("siteSlug")).toBe("another");
    expect(new FormData(form).getAll("articleSlugs")).toEqual([C.slug]);
  });

  it("保存中は並びを変えず、失敗したら下書きを保持して再編集できる", async () => {
    const user = userEvent.setup();
    let finish!: (value: { status: string; message: string }) => void;
    let submittedSlugs: FormDataEntryValue[] = [];
    saveFeatured.mockImplementation((_previous, data: FormData) => {
      submittedSlugs = data.getAll("articleSlugs");
      return new Promise((resolve) => { finish = resolve; });
    });
    renderForm();
    await user.selectOptions(screen.getByRole("combobox", { name: "追加する公開済み記事" }), C.slug);
    await user.click(screen.getByRole("button", { name: "おすすめ記事の並びを保存" }));
    await waitFor(() => expect(submittedSlugs).toEqual([A.slug, B.slug]));

    expect(disabled(screen.getByRole("button", { name: `${B.title}を1つ上へ` }))).toBe(true);
    expect(disabled(screen.getByRole("button", { name: `${A.title}をおすすめから外す` }))).toBe(true);
    expect(disabled(screen.getByRole("button", { name: "おすすめに追加" }))).toBe(true);
    expect(disabled(screen.getByRole("combobox", { name: "追加する公開済み記事" }))).toBe(true);

    finish({ status: "failed", message: "保存できませんでした。もう一度お試しください。" });
    await screen.findByText("保存できませんでした。もう一度お試しください。");
    expect(selectedLinkNames()).toEqual([A.title, B.title]);
    await user.click(screen.getByRole("button", { name: `${B.title}を1つ上へ` }));
    expect(selectedLinkNames()).toEqual([B.title, A.title]);
  });


  it("選択済み記事を外すと候補へ1件だけ戻り、同じ記事を再追加できる", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: `${A.title}をおすすめから外す` }));
    const picker = screen.getByRole("combobox", { name: "追加する公開済み記事" });
    expect(within(picker).getAllByRole("option", { name: A.title })).toHaveLength(1);
    await user.selectOptions(picker, A.slug);
    await user.click(screen.getByRole("button", { name: "おすすめに追加" }));
    expect(selectedLinkNames()).toEqual([B.title, A.title]);
    expect(within(picker).queryByRole("option", { name: A.title })).toBeNull();
  });

});
