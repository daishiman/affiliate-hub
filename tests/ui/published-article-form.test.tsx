/**
 * @tier 2
 * @req REQ-R11
 * @types screen-states, a11y
 */
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishedArticle } from "@/application/read-models/published-article";

let updateResult: unknown = { status: "idle", message: "" };
let archiveResult: unknown = { status: "idle", message: "" };

vi.mock("@/presentation/admin/publish/published-article-action", () => ({
  updatePublishedArticleAction: async () => updateResult,
  archivePublishedArticleAction: async () => archiveResult,
}));

const { PublishedArticleForm } = await import("@/presentation/admin/publish/published-article-form");
const { useDraft } = await import("@/presentation/ui/patterns/use-draft");

const ARTICLE: PublishedArticle = {
  slug: "quiet-laptop",
  siteSlug: "video-editing-gear",
  type: "guide",
  title: "静かなノートパソコンの選び方",
  summary: "排気口の位置を先に見ます。",
  categorySlug: "laptops",
  publishedAt: "2026-08-17",
  updatedAt: "2026-08-28",
  author: {
    slug: "author-nakata",
    name: "中田 涼",
    bio: "騒音計を持ち歩いて 4 年。",
    credentials: ["騒音測定の実務経験 4 年"],
  },
  disclosureRequired: true,
  sections: [
    { id: "body", heading: "結論", paragraphs: ["側面排気を選びます。", "温風を避けられます。"] },
    { id: "steps", heading: "確認手順", paragraphs: ["排気口を見ます。"] },
  ],
};

const DRAFT_KEY =
  "affiliate-hub:published-article:video-editing-gear:quiet-laptop:2026-08-28:v1";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  window.localStorage.clear();
  updateResult = { status: "idle", message: "" };
  archiveResult = { status: "idle", message: "" };
});

async function submit(form: HTMLFormElement): Promise<void> {
  await act(async () => {
    fireEvent.submit(form);
  });
}

describe("公開済み記事の編集フォーム", () => {
  it("本文・書き手・節を同じ画面で直し、入力途中を自動保存する", async () => {
    render(<PublishedArticleForm article={ARTICLE} archivedAt={null} />);

    fireEvent.change(screen.getByRole("textbox", { name: "タイトル" }), {
      target: { value: "静音ノートの選び方" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "一覧に出す結論" }), {
      target: { value: "側面排気から選びます。" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "節 2 の見出し" }), {
      target: { value: "3 つの確認手順" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "節 2 の本文" }), {
      target: { value: "1. 排気口を見る\n\n2. 騒音値を見る" },
    });

    expect(screen.getByDisplayValue("静音ノートの選び方")).toBeTruthy();
    expect(screen.getByDisplayValue("3 つの確認手順")).toBeTruthy();
    await waitFor(() => expect(window.localStorage.getItem(DRAFT_KEY)).toContain("静音ノート"));
    expect(screen.getByRole("status").textContent).toContain("自動保存しました");
    expect(screen.getByRole("button", { name: "記事を非表示にする" })).toBeTruthy();
  });

  it("保存済みの下書きを復元し、破棄すると公開中の値へ戻す", async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        at: Date.now(),
        data: {
          title: "入力途中のタイトル",
          summary: "途中の要約",
          authorName: "中田 涼",
          authorBio: "途中の紹介",
          authorCredentials: "騒音測定 4 年",
          reason: "途中の理由",
          sections: ARTICLE.sections.map((section) => ({
            id: section.id,
            heading: section.heading,
            body: section.paragraphs.join("\n\n"),
          })),
        },
      }),
    );

    render(<PublishedArticleForm article={ARTICLE} archivedAt={null} />);

    await waitFor(() => expect(screen.getByDisplayValue("入力途中のタイトル")).toBeTruthy());
    expect(screen.getByText("入力途中の下書きを復元しました")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "復元内容を破棄" }));
    expect(screen.getByDisplayValue(ARTICLE.title)).toBeTruthy();
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("訂正の欄別エラーと、非表示化の理由エラーを操作位置に出す", async () => {
    updateResult = { status: "failed", message: "結論が分かる名前にしてください。", field: "title" };
    archiveResult = { status: "failed", message: "理由を入力してください。", field: "reason" };
    const { container } = render(<PublishedArticleForm article={ARTICLE} archivedAt={null} />);
    const forms = [...container.querySelectorAll("form")];

    await submit(forms[0]);
    expect(screen.getByRole("alert").textContent).toContain("結論が分かる名前");
    expect(screen.getByRole("status").textContent).toContain("結論が分かる名前");

    fireEvent.change(screen.getByRole("textbox", { name: "非表示にする理由" }), {
      target: { value: "情報が古いため" },
    });
    await submit(forms[1]);
    expect(screen.getAllByRole("alert").at(-1)?.textContent).toContain("理由を入力してください");
    expect(screen.getAllByRole("status").at(-1)?.textContent).toContain("理由を入力してください");
  });

  it("非表示の記事では状態を説明し、重ねて非表示にする操作を出さない", () => {
    render(<PublishedArticleForm article={ARTICLE} archivedAt="2026-08-28T09:00:00.000Z" />);

    expect(screen.getByText("この記事は非表示です")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "記事を非表示にする" })).toBeNull();
  });

  it("訂正成功後は自動保存した下書きを消す", async () => {
    const { container } = render(<PublishedArticleForm article={ARTICLE} archivedAt={null} />);
    fireEvent.change(screen.getByRole("textbox", { name: "タイトル" }), {
      target: { value: "保存前のタイトル" },
    });
    await waitFor(() => expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull());

    updateResult = { status: "done", message: "訂正を保存しました。" };
    await submit(container.querySelector("form") as HTMLFormElement);

    await waitFor(() => expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull());
    expect(screen.getByDisplayValue(ARTICLE.title)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("訂正を保存しました");
  });
});

function DraftHarness({ draftKey, ttl = 1_000 }: { draftKey: string; ttl?: number }) {
  const draft = useDraft({ title: "", note: "" }, { key: draftKey, delay: 10, ttl });
  return (
    <>
      <label>
        題名
        <input
          value={draft.values.title}
          onChange={(event) => draft.update({ title: event.target.value })}
        />
      </label>
      <button type="button" onClick={draft.clear}>消す</button>
      <output>{draft.restored ? "復元" : "初期"}</output>
      <output>{draft.draftSavedAt === null ? "未保存" : "保存済み"}</output>
    </>
  );
}

describe("ブラウザ下書きの壊れ方", () => {
  it("期限切れと壊れた JSON は復元せず、保存物だけ片づける", () => {
    window.localStorage.setItem("expired-draft", JSON.stringify({ at: Date.now() - 2_000, data: { title: "古い" } }));
    const expired = render(<DraftHarness draftKey="expired-draft" ttl={10} />);
    expect(window.localStorage.getItem("expired-draft")).toBeNull();
    expect(screen.getByText("初期")).toBeTruthy();

    expired.unmount();
    window.localStorage.setItem("broken-draft", "{broken");
    render(<DraftHarness draftKey="broken-draft" />);
    expect(window.localStorage.getItem("broken-draft")).toBeNull();
  });

  it("入力が空へ戻ったら保存物と保存時刻を消す", async () => {
    render(<DraftHarness draftKey="empty-draft" />);
    const field = screen.getByRole("textbox", { name: "題名" });

    fireEvent.change(field, { target: { value: "途中" } });
    await waitFor(() => expect(window.localStorage.getItem("empty-draft")).toContain("途中"));
    expect(screen.getByText("保存済み")).toBeTruthy();

    fireEvent.change(field, { target: { value: "" } });
    await waitFor(() => expect(window.localStorage.getItem("empty-draft")).toBeNull());
    expect(screen.getByText("未保存")).toBeTruthy();
  });
});
