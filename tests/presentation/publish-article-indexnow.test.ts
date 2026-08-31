/**
 * @tier 1
 * @req REQ-SEO04
 * @types scenario, regression
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ host: "blog.example.com", "x-forwarded-proto": "https" }),
}));

const actionState = vi.hoisted(() => ({
  skipped: [] as readonly { readonly label: string; readonly reason: string }[],
  notices: [] as Array<{ readonly origin: string; readonly urls: readonly string[] }>,
  noticeStatus: "sent" as "sent" | "skipped" | "failed",
}));

vi.mock("@/presentation/composition", () => ({
  signedInActor: async () => ({ kind: "user", roles: ["owner"] }),
  readerActor: () => ({ kind: "anonymous" }),
  distributionUseCases: async () => ({
    publishArticle: {
      execute: async () => ({
        ok: true as const,
        value: {
          url: "/s/gadget/guides/quiet-laptop",
          skipped: actionState.skipped,
        },
      }),
    },
  }),
  notifyIndexNowOfPublish: async (origin: string, urls: readonly string[]) => {
    actionState.notices.push({ origin, urls });
    return {
      status: actionState.noticeStatus,
      detail:
        actionState.noticeStatus === "sent"
          ? "1 件を通知しました。"
          : actionState.noticeStatus === "skipped"
            ? "INDEXNOW_KEY が設定されていません。"
            : "IndexNow が 500 を返しました。",
    };
  },
  siteUseCases: async () => ({
    getArticle: {
      execute: async () => ({
        ok: false as const,
        error: { code: "NOT_FOUND", message: "記事が見つかりません。" },
      }),
    },
  }),
}));

const { publishArticleAction } = await import("@/presentation/admin/publish/publish-article-action");

function publishForm(): FormData {
  const data = new FormData();
  data.set("publicationId", "pub-ready");
  data.set("siteSlug", "gadget");
  data.set("slug", "quiet-laptop");
  return data;
}

beforeEach(() => {
  actionState.skipped = [];
  actionState.notices = [];
  actionState.noticeStatus = "sent";
  vi.restoreAllMocks();
});

describe("記事公開後の IndexNow 通知", () => {
  it("公開ゲートの未確認項目があっても、公開成功後は通知を試行する", async () => {
    actionState.skipped = [
      { label: "モバイル確認", reason: "確認手段がつながっていません。" },
    ];

    const result = await publishArticleAction(
      { status: "idle", message: "" },
      publishForm(),
    );

    expect(result.status).toBe("done");
    expect(actionState.notices).toEqual([
      {
        origin: "https://blog.example.com",
        urls: ["https://blog.example.com/s/gadget/guides/quiet-laptop"],
      },
    ]);
  });

  it.each(["sent", "skipped", "failed"] as const)(
    "IndexNow が %s でも公開成功を失敗に言い換えない",
    async (noticeStatus) => {
      actionState.noticeStatus = noticeStatus;
      vi.spyOn(console, "info").mockImplementation(() => undefined);

      const result = await publishArticleAction(
        { status: "idle", message: "" },
        publishForm(),
      );

      expect(actionState.notices).toHaveLength(1);
      expect(result.status).toBe("done");
    },
  );
});
