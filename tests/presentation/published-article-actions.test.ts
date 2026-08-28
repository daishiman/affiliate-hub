/**
 * @tier 1
 * @req REQ-R11, REQ-SEC01, REQ-SEC09
 * @types authorization, audit-log, tenant-isolation
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";

const mocks = vi.hoisted(() => ({
  signedInActor: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/presentation/composition", () => ({
  signedInActor: mocks.signedInActor,
  publishedArticleAdminUseCases: async () => ({
    update: { execute: mocks.update },
    archive: { execute: mocks.archive },
  }),
}));

const { archivePublishedArticleAction, updatePublishedArticleAction } = await import(
  "@/presentation/admin/published-article-action"
);

const IDLE = { status: "idle", message: "" } as const;

function form(entries: Record<string, string | readonly string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) for (const item of value) data.append(key, item);
    else data.set(key, value as string);
  }
  return data;
}

function updateForm(): FormData {
  return form({
    siteSlug: "video-editing-gear",
    slug: "quiet laptop/2026",
    title: "静かなノートパソコン",
    summary: "排気口から選びます。",
    authorName: "中田 涼",
    authorBio: "実測を続けています。",
    authorCredentials: " 騒音測定 4 年 \n\n 編集経験 ",
    sectionId: ["body", "steps"],
    sectionHeading: ["結論"],
    sectionBody: ["側面排気を見ます。", "1. 排気口を見る"],
    reason: "実測結果を反映するため",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signedInActor.mockResolvedValue(SAMPLE_ACTOR);
});

describe("公開済み記事を訂正するサーバー操作", () => {
  it("ログインしていなければ保存先を呼ばず、理由を返す", async () => {
    mocks.signedInActor.mockResolvedValue(null);

    const state = await updatePublishedArticleAction(IDLE, updateForm());

    expect(state.status).toBe("failed");
    expect(state.message).toContain("ログイン");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("複数行と節を画面の並びのまま渡し、読者画面まで作り直す", async () => {
    mocks.update.mockResolvedValue({
      ok: true,
      value: { type: "guide", slug: "quiet laptop/2026" },
    });

    const state = await updatePublishedArticleAction(IDLE, updateForm());

    expect(mocks.update).toHaveBeenCalledWith(SAMPLE_ACTOR, {
      siteSlug: "video-editing-gear",
      slug: "quiet laptop/2026",
      title: "静かなノートパソコン",
      summary: "排気口から選びます。",
      authorName: "中田 涼",
      authorBio: "実測を続けています。",
      authorCredentials: ["騒音測定 4 年", "編集経験"],
      sections: [
        { id: "body", heading: "結論", body: "側面排気を見ます。" },
        { id: "steps", heading: "", body: "1. 排気口を見る" },
      ],
      reason: "実測結果を反映するため",
    });
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/admin/content/published",
      "/admin/content/published/video-editing-gear/quiet%20laptop%2F2026/edit",
      "/s/video-editing-gear/guides/quiet laptop/2026",
    ]);
    expect(state).toEqual({
      status: "done",
      message: "訂正を保存しました。公開画面の更新日にも反映されます。",
    });
  });

  it("保存先の指摘は次の操作と欄を失わず返す", async () => {
    mocks.update.mockResolvedValue({
      ok: false,
      error: {
        message: "タイトルが短すぎます。",
        suggestedAction: "結論が分かる名前に直してください。",
        field: "title",
      },
    });

    const state = await updatePublishedArticleAction(IDLE, updateForm());

    expect(state).toEqual({
      status: "failed",
      message: "タイトルが短すぎます。 結論が分かる名前に直してください。",
      field: "title",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("公開済み記事を非表示にするサーバー操作", () => {
  const archiveForm = () =>
    form({
      siteSlug: "video-editing-gear",
      slug: "quiet laptop/2026",
      archiveReason: "情報が古くなったため",
    });

  it("ログインしていなければ非表示化しない", async () => {
    mocks.signedInActor.mockResolvedValue(null);

    const state = await archivePublishedArticleAction(IDLE, archiveForm());

    expect(state.status).toBe("failed");
    expect(state.message).toContain("ログイン");
    expect(mocks.archive).not.toHaveBeenCalled();
  });

  it("理由を渡し、管理一覧・編集画面・ブログ入口を作り直す", async () => {
    mocks.archive.mockResolvedValue({ ok: true, value: true });

    const state = await archivePublishedArticleAction(IDLE, archiveForm());

    expect(mocks.archive).toHaveBeenCalledWith(SAMPLE_ACTOR, {
      siteSlug: "video-editing-gear",
      slug: "quiet laptop/2026",
      reason: "情報が古くなったため",
    });
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/admin/content/published",
      "/admin/content/published/video-editing-gear/quiet%20laptop%2F2026/edit",
      "/s/video-editing-gear",
    ]);
    expect(state).toEqual({
      status: "done",
      message: "記事を非表示にしました。データは削除せず、管理一覧に残っています。",
    });
  });

  it("保存先が断った理由と欄をそのまま返す", async () => {
    mocks.archive.mockResolvedValue({
      ok: false,
      error: { message: "理由を入力してください。", field: "reason" },
    });

    const state = await archivePublishedArticleAction(IDLE, archiveForm());

    expect(state).toEqual({
      status: "failed",
      message: "理由を入力してください。",
      field: "reason",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
