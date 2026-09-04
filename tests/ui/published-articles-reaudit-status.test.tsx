/**
 * @tier 2
 * @req REQ-SEO07
 * @types screen-states, fault-injection
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOW } from "../support/clock";
import { renderDom } from "../support/render";

type Run = {
  readonly workspaceId: string;
  readonly status: "succeeded" | "partial" | "failed";
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly scanned: number;
  readonly recorded: number;
  readonly failed: number;
  readonly failureCode: "target_list_unavailable" | "article_audit_failed" | null;
};

let latestRun: Run | null = null;
let latestRunReadFails = false;

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    currentActor: async () => ({
      workspaceId: "ws_sample",
      userId: "u_sample",
      roles: ["owner"],
      isAiServiceAccount: false,
      identified: true,
    }),
    publishedArticleAdminUseCases: async () => ({
      list: { execute: async () => ({ ok: true, value: [] }) },
      listFailingAudits: {
        execute: async () => ({
          ok: true,
          value: {
            rows: [],
            truncated: false,
            coverage: { publishedCount: 0, auditedCount: 0, uncheckedCount: 0 },
          },
        }),
      },
      getLatestReauditRun: {
        execute: async () =>
          latestRunReadFails
            ? {
                ok: false,
                error: {
                  code: "UPSTREAM_UNAVAILABLE",
                  message: "定期再点検の実行履歴を読み取れませんでした。",
                  suggestedAction: "時間をおいて開き直してください。",
                },
              }
            : { ok: true, value: latestRun },
      },
    }),
  };
});

const Page = (await import("@/app/admin/content/published/page")).default;

beforeEach(() => {
  latestRun = null;
  latestRunReadFails = false;
});

function aRun(over: Partial<Run> = {}): Run {
  return {
    workspaceId: "ws_sample",
    status: "succeeded",
    startedAt: NOW,
    completedAt: new Date(NOW.getTime() + 2_000),
    scanned: 4,
    recorded: 4,
    failed: 0,
    failureCode: null,
    ...over,
  };
}

async function pageText(): Promise<string> {
  const { document, cleanup } = await renderDom(
    await Page({ searchParams: Promise.resolve({}) }),
  );
  const text = document.body.textContent ?? "";
  cleanup();
  return text;
}

describe("公開済み記事の定期再点検状態", () => {
  it("実行履歴が無いときも節を出し、未実行と明示する", async () => {
    const text = await pageText();

    expect(text).toContain("定期再点検: 未実行");
    expect(text).toContain("定期再点検はまだ実行されていません");
  });

  it("対象 0 件で成功した実行を、未実行と混同しない", async () => {
    latestRun = aRun({ scanned: 0, recorded: 0, failed: 0 });

    const text = await pageText();

    expect(text).toContain("定期再点検: 成功");
    expect(text).toContain("対象 0 件");
    expect(text).toContain("この回で再点検した記事はありませんでした");
    expect(text).not.toContain("定期再点検: 未実行");
  });

  it("成功は対象数と開始・最終完了時刻を出す", async () => {
    latestRun = aRun();

    const { document, cleanup } = await renderDom(
      await Page({ searchParams: Promise.resolve({}) }),
    );
    try {
      const text = document.body.textContent ?? "";
      expect(text).toContain("定期再点検: 成功");
      expect(text).toContain("対象 4 件");
      expect(text).toContain("開始時刻");
      expect(text).toContain("最終完了時刻");
      expect(document.querySelector(`time[datetime="${NOW.toISOString()}"]`)).not.toBeNull();
      expect(
        document.querySelector(
          `time[datetime="${new Date(NOW.getTime() + 2_000).toISOString()}"]`,
        ),
      ).not.toBeNull();
    } finally {
      cleanup();
    }
  });

  it("一部失敗は失敗数とともに明示する", async () => {
    latestRun = aRun({
      status: "partial",
      scanned: 5,
      recorded: 3,
      failed: 2,
      failureCode: "article_audit_failed",
    });

    const text = await pageText();

    expect(text).toContain("定期再点検: 一部失敗");
    expect(text).toContain("失敗 2 件");
    expect(text).not.toContain("定期再点検: 成功");
  });

  it("全対象の記録に失敗した実行を、一部失敗ではなく失敗と示す", async () => {
    latestRun = aRun({
      status: "failed",
      scanned: 3,
      recorded: 0,
      failed: 3,
      failureCode: "article_audit_failed",
    });

    const text = await pageText();

    expect(text).toContain("定期再点検: 失敗");
    expect(text).toContain("対象 3 件／記録 0 件／失敗 3 件");
    expect(text).not.toContain("定期再点検: 一部失敗");
  });

  it("対象取得失敗は実行の失敗として明示する", async () => {
    latestRun = aRun({
      status: "failed",
      scanned: 0,
      recorded: 0,
      failed: 0,
      failureCode: "target_list_unavailable",
    });

    const text = await pageText();

    expect(text).toContain("定期再点検: 失敗");
    expect(text).toContain("再点検の対象を取得できませんでした");
    expect(text).not.toContain("定期再点検: 成功");
  });

  it("実行履歴自体の取得失敗を成功表示にしない", async () => {
    latestRunReadFails = true;

    const text = await pageText();

    expect(text).toContain("定期再点検: 取得不能");
    expect(text).toContain("定期再点検の実行履歴を読み取れませんでした");
    expect(text).not.toContain("定期再点検: 成功");
  });
});
