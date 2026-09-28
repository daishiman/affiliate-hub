/** @tier 1 @req REQ-FB08 REQ-TM09 REQ-SEO07 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scheduleMaintenanceJobs } from "@/infrastructure/platform/scheduled-maintenance";

const mocked = vi.hoisted(() => ({
  sweep: vi.fn(),
  purge: vi.fn(),
  auditFlush: vi.fn(),
  distribution: vi.fn(),
  reaudit: vi.fn(),
  rollup: vi.fn(),
  seoAssessment: vi.fn(),
  imageReclaim: vi.fn(),
  seoMeasurement: vi.fn(),
  thumbnailSweep: vi.fn(),
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
vi.mock("@/infrastructure/platform/reader-metrics-scheduler", () => ({
  runReaderMetricsRollup: mocked.rollup,
}));
vi.mock("@/infrastructure/platform/seo-assessment-scheduler", () => ({
  runScheduledSeoAssessment: mocked.seoAssessment,
}));
vi.mock("@/infrastructure/platform/article-image-reclaim", () => ({
  runArticleImageReclaim: mocked.imageReclaim,
}));
vi.mock("@/infrastructure/platform/seo-measurement-scheduler", () => ({
  runSeoMeasurementCollection: mocked.seoMeasurement,
}));
vi.mock("@/infrastructure/platform/blog-thumbnail-sweeper", () => ({
  sweepUnreferencedThumbnails: mocked.thumbnailSweep,
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
    mocked.rollup.mockResolvedValue({ rolled: 0, purged: 0, failed: 0, truncated: false });
    mocked.seoAssessment.mockResolvedValue({
      scanned: 0,
      completed: 0,
      failed: 0,
      truncated: false,
    });
    mocked.imageReclaim.mockResolvedValue({ scanned: 0, reclaimed: 0, kept: 0, failed: 0 });
    mocked.seoMeasurement.mockResolvedValue({ sites: 0, outcomes: [], failures: [] });
    mocked.thumbnailSweep.mockResolvedValue({
      skipped: null,
      deleted: 0,
      referenced: 0,
      finished: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 2026-09-05: 5 → 7。ブログ運営コンソールが cron に 2 つ足した。
  // 読者の生の記録を日次へたたむ集計 (reader-metrics) と、SEO の月次再診断
  // (seo-assessment) である。**数を 7 に書き換えるだけでは足りない。**
  // この検査の要点は「因果のない仕事が互いへ波及しない」ことなので、
  // 足した 2 つも独立した Promise として登録され、同じ起動時刻を受け取り、
  // binding が無いときは自分の名札で警告することを、下の 3 つで揃えて見る。
  //
  // 2026-09-06: 7 → 8。ブロックエディターが記事へ画像を貼れるようになったので、
  // 記事から外れた画像を置き場から回収する仕事 (article-image) が加わった。
  // ここも同じで、数だけ 8 にしても検査にならない。この仕事は「消す」側なので、
  // 置き場 (BUCKET) と台帳 (DB) の両方を受け取ること、どちらか欠けたら
  // 自分の名札で見送ること、他の仕事の失敗に巻き込まれないことを揃えて見る。
  //
  // 2026-09-08: 8 → 10。SEO/AEO の計測 (seo) と、参照の外れた表紙の掃除
  // (thumbnail-sweep) が加わった。**ここも数を 10 にするだけでは足りない。**
  // 計測は外向きの読み取りを含むので一番落ちやすく、掃除は「消す」側で
  // 置き場と台帳の両方を要る——どちらも他の仕事を巻き添えにしうる形なので、
  // 独立した Promise・同じ起動時刻・自分の名札での見送り、を下の 3 つで揃えて見る。
  //
  // 併せて、binding 欠如時の名札の検査を**部分一致から全件一致へ**変えた。
  // `arrayContaining` は仕事が増えても黙って通る——実際そうなって、
  // 気づいたのは件数の 8 が割れたからだった。名札の集合そのものを固定すれば、
  // 件数と名札の**どちらか一方が緩んでも**もう一方が捕まえる。
  it("10 の仕事を独立した Promise として登録し、同じ起動時刻を渡す", async () => {
    const promises = schedule({ DB, BUCKET });

    expect(promises).toHaveLength(10);
    await Promise.all(promises);
    expect(mocked.seoMeasurement).toHaveBeenCalledWith(DB, { DB, BUCKET }, NOW);
    expect(mocked.thumbnailSweep).toHaveBeenCalledWith(BUCKET, DB, NOW);
    expect(mocked.sweep).toHaveBeenCalledWith(BUCKET, NOW);
    expect(mocked.auditFlush).toHaveBeenCalledWith(DB);
    expect(mocked.distribution).toHaveBeenCalledWith(DB, { DB, BUCKET }, NOW);
    expect(mocked.purge).toHaveBeenCalledWith(DB, NOW);
    expect(mocked.reaudit).toHaveBeenCalledWith(DB, NOW);
    expect(mocked.rollup).toHaveBeenCalledWith(DB, NOW);
    expect(mocked.seoAssessment).toHaveBeenCalledWith(DB, NOW);
    expect(mocked.imageReclaim).toHaveBeenCalledWith(DB, BUCKET, NOW);
  });

  it("再点検対象の取得に失敗しても retry を要求せず、成功ログを残さない", async () => {
    mocked.reaudit.mockRejectedValue(new Error("DB response must not be logged"));

    await expect(Promise.all(schedule({ DB, BUCKET }))).resolves.toHaveLength(10);
    expect(mocked.sweep).toHaveBeenCalledOnce();
    expect(mocked.auditFlush).toHaveBeenCalledOnce();
    expect(mocked.distribution).toHaveBeenCalledOnce();
    expect(mocked.purge).toHaveBeenCalledOnce();
    expect(mocked.rollup).toHaveBeenCalledOnce();
    expect(mocked.seoAssessment).toHaveBeenCalledOnce();
    expect(mocked.imageReclaim).toHaveBeenCalledOnce();
    expect(mocked.seoMeasurement).toHaveBeenCalledOnce();
    expect(mocked.thumbnailSweep).toHaveBeenCalledOnce();
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
    expect(mocked.rollup).not.toHaveBeenCalled();
    expect(mocked.seoAssessment).not.toHaveBeenCalled();
    expect(mocked.imageReclaim).not.toHaveBeenCalled();
    expect(mocked.seoMeasurement).not.toHaveBeenCalled();
    expect(mocked.thumbnailSweep).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(10);

    // **全件一致。**名札を 1 つ増やしても減らしても割れる。
    // 名札は先頭の `[...]` だけを取る——文言の言い回しはここの主題ではなく、
    // 「どの仕事が自分の名前で見送ったか」だけが主題である。
    const labels = vi
      .mocked(console.warn)
      .mock.calls.map(([message]) => /^\[[a-z-]+\]/.exec(String(message))?.[0])
      .sort();
    expect(labels).toEqual(
      [
        "[ai-search-reaudit]",
        "[article-image]",
        "[distribution-audit]",
        "[distribution]",
        "[reader-metrics]",
        "[retention]",
        "[seo-assessment]",
        "[seo]",
        "[sweep]",
        "[thumbnail-sweep]",
      ].sort(),
    );
  });
});
