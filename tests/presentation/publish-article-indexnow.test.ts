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
  aiSearchHistoryFails: false,
  aiSearchRecords: [] as Array<Record<string, unknown>>,
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
    signedInActor: async () => ({
      kind: "user",
      workspaceId: "ws_sample",
      userId: "u_sample",
      roles: ["owner"],
    }),
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
          ok: true as const,
          value: {
            slug: "quiet-laptop",
            siteSlug: "gadget",
            type: "guide",
            title: "静かなノートパソコンの選び方",
            summary:
              "静かなノートパソコンは、冷却方式・負荷時の騒音・排気口の位置を比べて選びます。用途別の選び方を先にまとめます。",
            categorySlug: "laptop",
            publishedAt: "2026-08-01",
            updatedAt: "2026-08-20",
            author: { slug: "writer", name: "編集部", bio: "実測レビュー歴 5 年。" },
            disclosureRequired: true,
            sections: [{ id: "body", heading: "本文", paragraphs: ["静音性を比べます。"] }],
          },
        }),
      },
    }),
    aiSearchAuditDeps: async () => ({
      ids: { newId: () => "audit-ai-search" },
      now: () => new Date("2026-08-20T12:00:00.000Z"),
      history: {
        record: async (entry: Record<string, unknown>) => {
          actionState.aiSearchRecords.push(entry);
          return actionState.aiSearchHistoryFails
            ? {
                ok: false as const,
                error: {
                  code: "UPSTREAM_UNAVAILABLE",
                  message: "点検履歴を保存できませんでした。",
                  suggestedAction: "管理画面で次回の定期点検を確認してください。",
                },
              }
            : { ok: true as const, value: undefined };
        },
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
  actionState.aiSearchHistoryFails = false;
  actionState.aiSearchRecords = [];
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
        actor: {
          kind: "user",
          workspaceId: "ws_sample",
          userId: "u_sample",
          roles: ["owner"],
        },
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
        actor: {
          kind: "user",
          workspaceId: "ws_sample",
          userId: "u_sample",
          roles: ["owner"],
        },
        origin: null,
        targetPath: "/s/gadget/guides/quiet-laptop",
      },
    ]);
  });

  it("公開画面と同じ記事の点検結果を、公開時履歴へ1回だけ渡す", async () => {
    const result = await publishArticleAction(
      { status: "idle", message: "" },
      publishForm(),
    );

    expect(result.status).toBe("done");
    expect(result.aiSearch).toBeDefined();
    expect(result.aiSearchAuditRecord).toMatchObject({ status: "recorded" });
    expect(actionState.aiSearchRecords).toHaveLength(1);
    expect(actionState.aiSearchRecords[0]).toMatchObject({
      workspaceId: "ws_sample",
      siteSlug: "gadget",
      slug: "quiet-laptop",
      trigger: "publish",
      checks: result.aiSearch,
    });
  });

  it("点検履歴の保存だけ失敗しても公開成功を保ち、失敗を結果へ残す", async () => {
    actionState.aiSearchHistoryFails = true;

    const result = await publishArticleAction(
      { status: "idle", message: "" },
      publishForm(),
    );

    expect(result.status).toBe("done");
    expect(result.aiSearch).toBeDefined();
    expect(result.aiSearchAuditRecord).toMatchObject({ status: "failed" });
    expect(result.aiSearchAuditRecord?.detail).toContain("点検履歴を保存できませんでした");
  });
});
