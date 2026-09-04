/** @tier 1 @req REQ-SEO07 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asWorkspaceId, domainError, err, ok } from "@/domain/shared";
import { runScheduledAiSearchReaudit } from "@/infrastructure/platform/ai-search-reaudit-scheduler";

const mocked = vi.hoisted(() => ({
  drizzle: vi.fn(),
  createHistory: vi.fn(),
  createRuns: vi.fn(),
  reaudit: vi.fn(),
}));

vi.mock("drizzle-orm/d1", () => ({ drizzle: mocked.drizzle }));
vi.mock("@/infrastructure/persistence/d1/ai-search-audit-history-repository", () => ({
  createD1AiSearchAuditHistoryRepository: mocked.createHistory,
}));
vi.mock("@/infrastructure/persistence/d1/ai-search-reaudit-run-repository", () => ({
  createD1AiSearchReauditRunRepository: mocked.createRuns,
}));
vi.mock("@/application/usecases/seo/reaudit-stale-articles", () => ({
  reauditStaleArticlesByWorkspace: mocked.reaudit,
}));

const NOW = new Date("2026-09-04T00:00:00.000Z");
const COMPLETED_AT = new Date("2026-09-04T00:00:02.000Z");
const WORKSPACE = asWorkspaceId("ws_reaudit");
const binding = {} as D1Database;

function runs(over: Record<string, unknown> = {}) {
  return {
    listKnownWorkspaceIds: vi.fn().mockResolvedValue(ok([WORKSPACE])),
    save: vi.fn().mockResolvedValue(ok(undefined)),
    getLatest: vi.fn().mockResolvedValue(ok(null)),
    ...over,
  };
}

describe("AI 検索適合の定期再点検 scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.drizzle.mockReturnValue({});
    mocked.createHistory.mockReturnValue({});
    mocked.createRuns.mockReturnValue(runs());
  });

  it("対象一覧を取得できないとき、既知 workspace へ failed を残して入口へ失敗を伝える", async () => {
    const repository = runs();
    mocked.createRuns.mockReturnValue(repository);
    mocked.reaudit.mockResolvedValue(
      err(domainError("UPSTREAM_UNAVAILABLE", "再点検する記事を取得できませんでした。")),
    );

    await expect(
      runScheduledAiSearchReaudit(binding, NOW, () => COMPLETED_AT),
    ).rejects.toThrow();
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE,
        status: "failed",
        scanned: 0,
        failureCode: "target_list_unavailable",
      }),
    );
  });

  it("対象 0 件も succeeded として workspace 単位に残す", async () => {
    const repository = runs();
    mocked.createRuns.mockReturnValue(repository);
    mocked.reaudit.mockResolvedValue(
      ok({
        total: { scanned: 0, recorded: 0, failed: 0 },
        byWorkspace: [],
      }),
    );

    await expect(
      runScheduledAiSearchReaudit(binding, NOW, () => COMPLETED_AT),
    ).resolves.toEqual({ scanned: 0, recorded: 0, failed: 0 });
    expect(repository.save).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      status: "succeeded",
      startedAt: NOW,
      completedAt: COMPLETED_AT,
      scanned: 0,
      recorded: 0,
      failed: 0,
      failureCode: null,
    });
  });

  it("workspace 別の成功・失敗件数を partial として残す", async () => {
    const repository = runs();
    mocked.createRuns.mockReturnValue(repository);
    mocked.reaudit.mockResolvedValue(
      ok({
        total: { scanned: 3, recorded: 2, failed: 1 },
        byWorkspace: [
          { workspaceId: WORKSPACE, scanned: 3, recorded: 2, failed: 1 },
        ],
      }),
    );

    await expect(
      runScheduledAiSearchReaudit(binding, NOW, () => COMPLETED_AT),
    ).resolves.toEqual({
      scanned: 3,
      recorded: 2,
      failed: 1,
    });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE,
        status: "partial",
        failureCode: "article_audit_failed",
      }),
    );
  });

  it("全記事の記録失敗は article_audit_failed の failed として残す", async () => {
    const repository = runs();
    mocked.createRuns.mockReturnValue(repository);
    mocked.reaudit.mockResolvedValue(
      ok({
        total: { scanned: 2, recorded: 0, failed: 2 },
        byWorkspace: [
          { workspaceId: WORKSPACE, scanned: 2, recorded: 0, failed: 2 },
        ],
      }),
    );

    await runScheduledAiSearchReaudit(binding, NOW, () => COMPLETED_AT);

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        failureCode: "article_audit_failed",
      }),
    );
  });

  it("run-state の保存失敗を再点検の成功に潰さない", async () => {
    const repository = runs({
      save: vi.fn().mockResolvedValue(
        err(domainError("UPSTREAM_UNAVAILABLE", "run-state を保存できません。")),
      ),
    });
    mocked.createRuns.mockReturnValue(repository);
    mocked.reaudit.mockResolvedValue(
      ok({
        total: { scanned: 0, recorded: 0, failed: 0 },
        byWorkspace: [],
      }),
    );

    await expect(
      runScheduledAiSearchReaudit(binding, NOW, () => COMPLETED_AT),
    ).rejects.toThrow("run-state");
  });
});
