/**
 * @tier 1
 * @req REQ-SEO04
 * @types scenario, regression
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const actionState = vi.hoisted(() => ({
  skipped: [] as readonly { readonly label: string; readonly reason: string }[],
  notices: [] as Array<{
    readonly actor: unknown;
    readonly origin: string | null;
    readonly targetPath: string;
  }>,
  noticeStatus: "sent" as "sent" | "skipped" | "failed",
  auditStatus: "recorded" as "recorded" | "failed",
  requestHeaders: new Headers({ host: "blog.example.com", "x-forwarded-proto": "https" }),
}));

vi.mock("next/headers", () => ({
  headers: async () => actionState.requestHeaders,
}));

vi.mock("@/presentation/composition", async () => {
  const { resolveRequestOrigin } = await import("@/infrastructure/http/request-origin");
  return {
    requestOriginFromNextHeaders: async () =>
      resolveRequestOrigin({
        host: actionState.requestHeaders.get("host"),
        forwardedHost: actionState.requestHeaders.get("x-forwarded-host"),
        forwardedProtocol: actionState.requestHeaders.get("x-forwarded-proto"),
        defaultProtocol: "https",
      }),
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
    notifyIndexNowOfPublish: async (
      actor: unknown,
      origin: string | null,
      targetPath: string,
    ) => {
      actionState.notices.push({ actor, origin, targetPath });
      const status = origin === null ? "skipped" : actionState.noticeStatus;
      return {
        status,
        auditStatus: actionState.auditStatus,
        detail:
          actionState.auditStatus === "failed"
            ? "1 件を通知しました。 ただし、通知結果の記録を保存できませんでした。"
            : status === "sent"
            ? "1 件を通知しました。"
            : status === "skipped"
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
  };
});

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
  actionState.auditStatus = "recorded";
  actionState.requestHeaders = new Headers({
    host: "blog.example.com",
    "x-forwarded-proto": "https",
  });
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
        actor: { kind: "user", roles: ["owner"] },
        origin: "https://blog.example.com",
        targetPath: "/s/gadget/guides/quiet-laptop",
      },
    ]);
  });

  it.each(["sent", "skipped", "failed"] as const)(
    "IndexNow が %s でも公開成功を失敗に言い換えない",
    async (noticeStatus) => {
      actionState.noticeStatus = noticeStatus;
      const result = await publishArticleAction(
        { status: "idle", message: "" },
        publishForm(),
      );

      expect(actionState.notices).toHaveLength(1);
      expect(result.status).toBe("done");
      expect(result.indexNow).toMatchObject({ status: noticeStatus, auditStatus: "recorded" });
    },
  );

  it("通知結果の監査だけ失敗しても公開成功を保ち、記録失敗を結果 detail に残す", async () => {
    actionState.auditStatus = "failed";

    const result = await publishArticleAction(
      { status: "idle", message: "" },
      publishForm(),
    );

    expect(result.status).toBe("done");
    expect(result.indexNow).toMatchObject({ status: "sent", auditStatus: "failed" });
    expect(result.indexNow?.detail).toContain("記録を保存できません");
  });

  it("不正なforwarded hostでは、公開を戻さずIndexNow通知だけを安全側に止める", async () => {
    actionState.requestHeaders = new Headers({
      host: "internal.example",
      "x-forwarded-host": "blog.example.com, attacker.example",
      "x-forwarded-proto": "https",
    });

    const result = await publishArticleAction(
      { status: "idle", message: "" },
      publishForm(),
    );

    expect(result.status).toBe("done");
    expect(result.indexNow).toMatchObject({ status: "skipped", auditStatus: "recorded" });
    expect(actionState.notices).toEqual([
      {
        actor: { kind: "user", roles: ["owner"] },
        origin: null,
        targetPath: "/s/gadget/guides/quiet-laptop",
      },
    ]);
  });
});
