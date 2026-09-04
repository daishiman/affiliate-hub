/** @tier 1 @req REQ-FB08 REQ-TM09 REQ-SEO07 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scheduleMaintenanceJobs } from "@/infrastructure/platform/scheduled-maintenance";

const mocked = vi.hoisted(() => ({
  sweep: vi.fn(),
  purge: vi.fn(),
  auditFlush: vi.fn(),
  distribution: vi.fn(),
  reaudit: vi.fn(),
}));

vi.mock("@/infrastructure/platform/feedback-capture-r2", () => ({
  sweepExpiredCaptures: mocked.sweep,
}));
vi.mock("@/infrastructure/platform/feedback-diagnostics-purge", () => ({
  runFeedbackDiagnosticsPurge: mocked.purge,
}));
vi.mock("@/infrastructure/platform/distribution-scheduler", () => ({
  runPublicationDeliveryAuditFlush: mocked.auditFlush,
  runScheduledDistribution: mocked.distribution,
}));
vi.mock("@/infrastructure/platform/ai-search-reaudit-scheduler", () => ({
  runScheduledAiSearchReaudit: mocked.reaudit,
}));

const NOW = new Date("2026-09-04T00:00:00.000Z");
const DB = {} as D1Database;
const BUCKET = {} as R2Bucket;

function schedule(env: Readonly<Record<string, unknown>>): readonly Promise<unknown>[] {
  const promises: Promise<unknown>[] = [];
  scheduleMaintenanceJobs(
    env,
    { waitUntil: (promise) => promises.push(promise) },
    NOW,
  );
  return promises;
}

describe("Worker の定期メンテナンス配線", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocked.sweep.mockResolvedValue({ deleted: 0, finished: true });
    mocked.auditFlush.mockResolvedValue({ processed: 0 });
    mocked.distribution.mockResolvedValue({
      scanned: 0,
      claimed: 0,
      published: 0,
      retryScheduled: 0,
      failed: 0,
      skipped: 0,
    });
    mocked.purge.mockResolvedValue({ workspaces: 0, purged: 0, unfinished: [], failures: [] });
    mocked.reaudit.mockResolvedValue({ scanned: 0, recorded: 0, failed: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("5 つの仕事を独立した Promise として登録し、同じ起動時刻を渡す", async () => {
    const promises = schedule({ DB, BUCKET });

    expect(promises).toHaveLength(5);
    await Promise.all(promises);
    expect(mocked.sweep).toHaveBeenCalledWith(BUCKET, NOW);
    expect(mocked.auditFlush).toHaveBeenCalledWith(DB);
    expect(mocked.distribution).toHaveBeenCalledWith(DB, { DB, BUCKET }, NOW);
    expect(mocked.purge).toHaveBeenCalledWith(DB, NOW);
    expect(mocked.reaudit).toHaveBeenCalledWith(DB, NOW);
  });

  it("再点検対象の取得に失敗しても retry を要求せず、成功ログを残さない", async () => {
    mocked.reaudit.mockRejectedValue(new Error("DB response must not be logged"));

    await expect(Promise.all(schedule({ DB, BUCKET }))).resolves.toHaveLength(5);
    expect(mocked.sweep).toHaveBeenCalledOnce();
    expect(mocked.auditFlush).toHaveBeenCalledOnce();
    expect(mocked.distribution).toHaveBeenCalledOnce();
    expect(mocked.purge).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith("[ai-search-reaudit] 再点検に失敗しました");
    expect(console.log).not.toHaveBeenCalledWith(
      "[ai-search-reaudit] 記事を再点検しました",
      expect.anything(),
    );
  });

  it("binding が無い仕事だけを固有の警告で見送り、ほかへ影響させない", async () => {
    await Promise.all(schedule({}));

    expect(mocked.sweep).not.toHaveBeenCalled();
    expect(mocked.reaudit).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(5);
    expect(vi.mocked(console.warn).mock.calls.map(([message]) => message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("[sweep]"),
        expect.stringContaining("[distribution-audit]"),
        expect.stringContaining("[distribution]"),
        expect.stringContaining("[retention]"),
        expect.stringContaining("[ai-search-reaudit]"),
      ]),
    );
  });
});
