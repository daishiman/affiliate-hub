/** @tier 2 @req REQ-SEO12 REQ-SEO13 @types db-concurrency, boundary, tenant-isolation, idempotency */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import type { SearchQueryMetric, SeoSearchQueryMetricPort } from "@/application/ports/seo-measurement";
import * as schema from "@/db/schema";
import type { PageKey } from "@/domain/seo/aeo-measurement";
import { createD1SeoMeasurementRepositories } from "@/infrastructure/persistence/d1/seo-measurement-repository";
import { createD1SeoSearchQueryReaderRepository } from "@/infrastructure/persistence/d1/seo-search-query-reader-repository";
import { migrationStatements, statementsOf } from "../support/migrations";

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
const SITE = "creator-tools";
const DATE = "2026-08-15";
const PAGE = "example.com/s/creator-tools/guides/quiet-laptop" as PageKey;
const AT = "2026-09-06T00:00:00.000Z";

const repository = (workspaceId = "query-owner"): SeoSearchQueryMetricPort => {
  const deps = { db: drizzle(proxy.env.DB, { schema }), workspaceId };
  return {
    ...createD1SeoMeasurementRepositories(deps).queryMetrics,
    ...createD1SeoSearchQueryReaderRepository(deps),
  };
};

function metric(index: number, over: Partial<SearchQueryMetric> = {}): SearchQueryMetric {
  return {
    siteSlug: SITE,
    pageKey: PAGE,
    metricDate: DATE,
    query: index === 0 ? "  静かな PC 日本語  " : `Query ${index}`,
    impressions: index + 1,
    clicks: index % 3,
    position: 4.5,
    ...over,
  };
}

async function insertWorkspace(id: string) {
  await proxy.env.DB.prepare(`INSERT INTO workspaces
    (id,name,plan,owner_user_id,timezone,currency,created_at,suspended_at)
    VALUES (?,?,'solo',?,'Asia/Tokyo','JPY',?,NULL)`)
    .bind(id, id, `owner-${id}`, Math.floor(Date.parse(AT) / 1_000)).run();
}

beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  for (const statement of migrationStatements()) await proxy.env.DB.prepare(statement).run();
  await insertWorkspace("query-owner");
  await insertWorkspace("query-foreign");
}, 60_000);

afterAll(async () => { await proxy?.dispose(); });

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM seo_search_query_metric").run();
  await proxy.env.DB.prepare("DELETE FROM seo_search_query_sync").run();
});

describe("Search Console query snapshot", () => {
  it("1001件超をJSON1 bulkで保存し、完成まで旧snapshotを見せない", async () => {
    const repo = repository();
    const started = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: AT });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const firstPage = Array.from({ length: 1_201 }, (_, index) =>
      metric(index, index === 0 ? { impressions: 99_999 } : {}));
    expect(await repo.stagePage({
      target: started.value,
      rows: firstPage,
      nextStartRow: 1_201,
      complete: false,
      mayBeLimited: false,
      observedAt: AT,
    })).toEqual({ ok: true, value: 1_201 });
    expect(await repo.recent({ siteSlug: SITE, pageKey: PAGE, from: DATE, to: DATE, limit: 100 })).toMatchObject({ ok: true, value: { rows: [] } });

    const resumed = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: "2026-09-06T00:01:00.000Z" });
    expect(resumed).toMatchObject({ ok: true, value: { runId: started.value.runId, startRow: 1_201, revision: 2 } });
    if (!resumed.ok) return;
    expect(await repo.stagePage({
      target: resumed.value,
      rows: [metric(1_201)],
      nextStartRow: 1_202,
      complete: true,
      mayBeLimited: false,
      observedAt: "2026-09-06T00:01:00.000Z",
    })).toEqual({ ok: true, value: 1 });

    const visible = await repo.recent({ siteSlug: SITE, pageKey: PAGE, from: DATE, to: DATE, limit: 100 });
    expect(visible.ok && visible.value.rows).toHaveLength(100);
    expect(visible.ok && visible.value.rows.some((row) => row.query === "  静かな PC 日本語  ")).toBe(true);
    expect((await proxy.env.DB.prepare("SELECT count(*) AS count FROM seo_search_query_metric").first<{ count: number }>())?.count).toBe(1_202);
  });

  it("未完成runは旧snapshotを維持し、完成時だけpointerを切り替える", async () => {
    const repo = repository();
    const first = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: AT });
    if (!first.ok) throw new Error("start failed");
    await repo.stagePage({ target: first.value, rows: [metric(1)], nextStartRow: 1, complete: true, mayBeLimited: false, observedAt: AT });

    const replacement = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: "2026-09-06T01:00:00.000Z" });
    if (!replacement.ok) throw new Error("replacement failed");
    const staleTarget = replacement.value;
    await repo.stagePage({ target: replacement.value, rows: [metric(2)], nextStartRow: 1, complete: false, mayBeLimited: false, observedAt: "2026-09-06T01:00:00.000Z" });
    expect(await repo.recent({ siteSlug: SITE, pageKey: PAGE, from: DATE, to: DATE, limit: 10 }))
      .toMatchObject({ ok: true, value: { rows: [{ query: "Query 1" }] } });

    const resumed = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: "2026-09-06T01:01:00.000Z" });
    if (!resumed.ok) throw new Error("resume failed");
    await repo.stagePage({ target: resumed.value, rows: [], nextStartRow: 1, complete: true, mayBeLimited: false, observedAt: "2026-09-06T01:01:00.000Z" });
    expect(await repo.recent({ siteSlug: SITE, pageKey: PAGE, from: DATE, to: DATE, limit: 10 }))
      .toMatchObject({ ok: true, value: { rows: [{ query: "Query 2" }] } });

    const stale = await repo.stagePage({
      target: staleTarget, rows: [metric(99)], nextStartRow: 1,
      complete: true, mayBeLimited: false, observedAt: "2026-09-06T01:00:00.000Z",
    });
    expect(stale).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(await repo.recent({ siteSlug: SITE, pageKey: PAGE, from: DATE, to: DATE, limit: 10 }))
      .toMatchObject({ ok: true, value: { rows: [{ query: "Query 2" }] } });

    const correction = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: "2026-09-06T02:00:00.000Z" });
    if (!correction.ok) throw new Error("correction failed");
    await repo.stagePage({ target: correction.value, rows: [], nextStartRow: 0, complete: true, mayBeLimited: false, observedAt: "2026-09-06T02:00:00.000Z" });
    expect(await repo.recent({ siteSlug: SITE, pageKey: PAGE, from: DATE, to: DATE, limit: 10 })).toMatchObject({ ok: true, value: { rows: [] } });
  });

  it("同じrun/revisionの並行完了では敗者の行がactive snapshotへ混ざらない", async () => {
    const repo = repository();
    const started = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: AT });
    if (!started.ok) throw new Error("start failed");

    const results = await Promise.all([
      repo.stagePage({ target: started.value, rows: [metric(1)], nextStartRow: 1, complete: true, mayBeLimited: false, observedAt: AT }),
      repo.stagePage({ target: started.value, rows: [metric(2)], nextStartRow: 1, complete: true, mayBeLimited: false, observedAt: AT }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    const visible = await repo.recent({ siteSlug: SITE, pageKey: PAGE, from: DATE, to: DATE, limit: 10 });
    expect(visible.ok && visible.value.rows).toHaveLength(1);
    if (!visible.ok) return;
    expect(["Query 1", "Query 2"]).toContain(visible.value.rows[0]?.query);
  });

  it("新しいcomplete後に届いた古いbeginはrunとactive pointerを巻き戻さない", async () => {
    const repo = repository();
    const current = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: "2026-09-06T02:00:00.000Z" });
    if (!current.ok) throw new Error("start failed");
    await repo.stagePage({ target: current.value, rows: [metric(2)], nextStartRow: 1,
      complete: true, mayBeLimited: false, observedAt: "2026-09-06T02:00:00.000Z" });

    expect(await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: "2026-09-06T01:00:00.000Z" }))
      .toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(await repo.recent({ siteSlug: SITE, pageKey: PAGE, from: DATE, to: DATE, limit: 10 }))
      .toMatchObject({ ok: true, value: { rows: [{ query: "Query 2" }] } });
  });

  it("workspace/siteを越えて読まず、read limitは100以下に制限する", async () => {
    const repo = repository();
    const started = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: AT });
    if (!started.ok) throw new Error("start failed");
    await repo.stagePage({ target: started.value, rows: [metric(0)], nextStartRow: 1, complete: true, mayBeLimited: false, observedAt: AT });

    expect(await repository("query-foreign").recent({ siteSlug: SITE, pageKey: PAGE, from: DATE, to: DATE, limit: 10 })).toMatchObject({ ok: true, value: { rows: [] } });
    expect(await repo.recent({ siteSlug: "another", pageKey: PAGE, from: DATE, to: DATE, limit: 10 })).toMatchObject({ ok: true, value: { rows: [] } });
    expect(await repo.recent({ siteSlug: SITE, pageKey: PAGE, from: DATE, to: DATE, limit: 101 })).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
  });

  it("recentは範囲の最古辞書順ではなく最新日・表示回数順から返す", async () => {
    const repo = repository();
    const nextDate = "2026-08-16";
    const first = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: nextDate, observedAt: AT });
    if (!first.ok) throw new Error("start failed");
    await repo.stagePage({ target: first.value, rows: [metric(1)], nextStartRow: 1,
      complete: true, mayBeLimited: false, observedAt: AT });
    const second = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: nextDate, observedAt: "2026-09-06T01:00:00.000Z" });
    if (!second.ok) throw new Error("second failed");
    await repo.stagePage({ target: second.value, rows: [metric(2, { metricDate: nextDate, impressions: 50 }), metric(3, { metricDate: nextDate, impressions: 500 })],
      nextStartRow: 2, complete: true, mayBeLimited: false, observedAt: "2026-09-06T01:00:00.000Z" });

    expect(await repo.recent({ siteSlug: SITE, pageKey: PAGE, from: DATE, to: nextDate, limit: 1 }))
      .toMatchObject({ ok: true, value: { rows: [{ metricDate: nextDate, query: "Query 3", impressions: 500 }] } });
  });

  it("mayBeLimited snapshotは公開50k到達が確認できたときだけpointerを切り替える", async () => {
    const repo = repository();
    const first = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: AT });
    if (!first.ok) throw new Error("start failed");
    await repo.stagePage({ target: first.value, rows: [metric(1)], nextStartRow: 1, complete: true, mayBeLimited: false, observedAt: AT });
    const next = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: "2026-09-06T01:00:00.000Z" });
    if (!next.ok) throw new Error("replacement failed");

    expect(await repo.stagePage({ target: next.value, rows: [], nextStartRow: 40_000,
      complete: true, mayBeLimited: true, observedAt: "2026-09-06T01:00:00.000Z" }))
      .toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(await repo.recent({ siteSlug: SITE, pageKey: PAGE, from: DATE, to: DATE, limit: 10 }))
      .toMatchObject({ ok: true, value: { rows: [{ query: "Query 1" }] } });

    expect(await repo.stagePage({ target: next.value, rows: [], nextStartRow: 50_000,
      complete: true, mayBeLimited: true, observedAt: "2026-09-06T01:00:00.000Z" }))
      .toEqual({ ok: true, value: 0 });
    expect(await repo.recent({ siteSlug: SITE, pageKey: PAGE, from: DATE, to: DATE, limit: 10 })).toMatchObject({ ok: true, value: { rows: [] } });
  });

  it("bulk JSON bindの失敗でもquery本文をerrorへ出さない", async () => {
    const repo = repository();
    const started = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: AT });
    if (!started.ok) throw new Error("start failed");
    const secretQuery = "PRIVATE SEARCH QUERY 日本語";
    await proxy.env.DB.prepare("CREATE TRIGGER fail_query_metric BEFORE INSERT ON seo_search_query_metric BEGIN SELECT RAISE(ABORT, 'insert failed'); END").run();
    try {
      const result = await repo.stagePage({ target: started.value, rows: [metric(1, { query: secretQuery })],
        nextStartRow: 1, complete: false, mayBeLimited: false, observedAt: AT });
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain(secretQuery);
    } finally {
      await proxy.env.DB.prepare("DROP TRIGGER fail_query_metric").run();
    }
  });

  it("48時間まったく進んでいないpendingだけを新runへ回収する", async () => {
    const repo = repository();
    const first = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: AT });
    if (!first.ok) throw new Error("start failed");

    const restarted = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: "2026-09-09T00:00:00.000Z" });
    expect(restarted.ok && restarted.value.runId).not.toBe(first.value.runId);
  });

  it("pending日が10日後のrolling window外でも保存済み続きから再開する", async () => {
    const repo = repository();
    const first = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: AT });
    if (!first.ok) throw new Error("start failed");
    await repo.stagePage({ target: first.value, rows: [metric(1)], nextStartRow: 1,
      complete: false, mayBeLimited: false, observedAt: AT });

    const resumed = await repo.beginOrResume({
      siteSlug: SITE, from: "2026-08-25", to: "2026-08-31", observedAt: "2026-09-16T00:00:00.000Z",
    });
    expect(resumed).toMatchObject({ ok: true, value: { metricDate: DATE, startRow: 1, runId: first.value.runId } });
  });

  it("3site日次rotationで72時間空いても40kの続き10kを完成できる", async () => {
    const repo = repository();
    const first = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: AT });
    if (!first.ok) throw new Error("start failed");
    await repo.stagePage({ target: first.value, rows: [metric(1)], nextStartRow: 40_000,
      complete: false, mayBeLimited: false, observedAt: AT });

    const resumed = await repo.beginOrResume({ siteSlug: SITE, from: "2026-08-18", to: "2026-08-24", observedAt: "2026-09-09T00:00:00.000Z" });
    expect(resumed).toMatchObject({ ok: true, value: { runId: first.value.runId, metricDate: DATE, startRow: 40_000 } });
    if (!resumed.ok) return;
    expect(await repo.stagePage({ target: resumed.value, rows: [metric(2)], nextStartRow: 50_000,
      complete: true, mayBeLimited: true, observedAt: "2026-09-09T00:00:00.000Z" }))
      .toEqual({ ok: true, value: 1 });
    expect(await repo.recent({ siteSlug: SITE, pageKey: PAGE, from: DATE, to: DATE, limit: 10 }))
      .toMatchObject({ ok: true, value: { rows: [{ query: "Query 2" }, { query: "Query 1" }] } });
  });

  it("pointer切替後48時間を過ぎた旧runをbounded cleanupする", async () => {
    const repo = repository();
    const first = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: AT });
    if (!first.ok) throw new Error("start failed");
    await repo.stagePage({ target: first.value, rows: [metric(1)], nextStartRow: 1,
      complete: true, mayBeLimited: false, observedAt: AT });
    const replacement = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: "2026-09-06T01:00:00.000Z" });
    if (!replacement.ok) throw new Error("replacement failed");
    await repo.stagePage({ target: replacement.value, rows: [], nextStartRow: 0,
      complete: true, mayBeLimited: false, observedAt: "2026-09-06T01:00:00.000Z" });
    await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: "2026-09-09T01:00:00.000Z" });
    expect((await proxy.env.DB.prepare("SELECT count(*) AS count FROM seo_search_query_metric WHERE run_id=?").bind(first.value.runId).first<{ count: number }>())?.count).toBe(0);
  });

  it("sliding 7日windowは最古の未観測日から埋め、新しい日だけへ偏らない", async () => {
    const repo = repository("query-foreign");
    const base = Date.parse("2026-08-01T00:00:00.000Z");
    const day = (index: number) => new Date(base + index * 86_400_000).toISOString().slice(0, 10);
    const selected: string[] = [];
    for (let run = 0; run < 8; run += 1) {
      const observedAt = new Date(Date.parse(AT) + run * 60_000).toISOString();
      const target = await repo.beginOrResume({ siteSlug: SITE, from: day(run), to: day(run + 6), observedAt });
      if (!target.ok) throw new Error("start failed");
      selected.push(target.value.metricDate);
      await repo.stagePage({ target: target.value, rows: [], nextStartRow: 0, complete: true, mayBeLimited: false, observedAt });
    }
    expect(selected).toEqual(Array.from({ length: 8 }, (_, index) => day(index)));
  });
});


describe("検索語内訳の表示範囲と取得状態", () => {
  it("未取得・初回途中・完了空を、同じ空配列でも区別する", async () => {
    const repo = repository();
    const input = { siteSlug: SITE, pageKey: PAGE, from: DATE, to: DATE, limit: 100 };
    expect(await repo.recent(input)).toEqual({ ok: true, value: {
      rows: [], truncated: false, dates: [{ metricDate: DATE, active: false, refreshing: false,
        activeMayBeLimited: null, activeCompletedAt: null }],
    } });
    const target = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: AT });
    if (!target.ok) throw new Error("start failed");
    expect(await repo.recent(input)).toEqual({ ok: true, value: {
      rows: [], truncated: false, dates: [{ metricDate: DATE, active: false, refreshing: true,
        activeMayBeLimited: null, activeCompletedAt: null }],
    } });
    await repo.stagePage({ target: target.value, rows: [], nextStartRow: 0, complete: true,
      mayBeLimited: false, observedAt: AT });
    expect(await repo.recent(input)).toEqual({ ok: true, value: {
      rows: [], truncated: false, dates: [{ metricDate: DATE, active: true, refreshing: false,
        activeMayBeLimited: false, activeCompletedAt: AT }],
    } });
  });

  it.each([100, 101])("%i行あるとき100件表示の打切りを正確に返す", async (count) => {
    const repo = repository();
    const target = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: AT });
    if (!target.ok) throw new Error("start failed");
    await repo.stagePage({ target: target.value, rows: Array.from({ length: count }, (_, index) => metric(index)),
      nextStartRow: count, complete: true, mayBeLimited: false, observedAt: AT });
    const result = await repo.recent({ siteSlug: SITE, pageKey: PAGE, from: DATE, to: DATE, limit: 100 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows).toHaveLength(100);
    expect(result.value.truncated).toBe(count > 100);
    expect(result.value.dates).toEqual([{ metricDate: DATE, active: true, refreshing: false,
      activeMayBeLimited: false, activeCompletedAt: AT }]);
  });

  it("上限に達した旧完了分の日時と上限を再取得途中でも保持する", async () => {
    const repo = repository();
    const input = { siteSlug: SITE, pageKey: PAGE, from: DATE, to: DATE, limit: 100 };
    const first = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: AT });
    if (!first.ok) throw new Error("start failed");
    await repo.stagePage({ target: first.value, rows: [metric(1)], nextStartRow: 50_000,
      complete: true, mayBeLimited: true, observedAt: AT });
    const later = "2026-09-06T01:00:00.000Z";
    const replacement = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: later });
    if (!replacement.ok) throw new Error("replacement failed");
    const expected = { ok: true, value: { rows: [metric(1)], truncated: false,
      dates: [{ metricDate: DATE, active: true, refreshing: true,
        activeMayBeLimited: true, activeCompletedAt: AT }] } };
    expect(await repo.recent(input)).toEqual(expected);
    await repo.stagePage({ target: replacement.value, rows: [metric(2)], nextStartRow: 1,
      complete: false, mayBeLimited: false, observedAt: later });
    expect(await repo.recent(input)).toEqual(expected);
    const resumed = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: later });
    if (!resumed.ok) throw new Error("resume failed");
    await repo.stagePage({ target: resumed.value, rows: [], nextStartRow: 1,
      complete: true, mayBeLimited: false, observedAt: later });
    expect(await repo.recent(input)).toEqual({ ok: true, value: { rows: [metric(2)], truncated: false,
      dates: [{ metricDate: DATE, active: true, refreshing: false,
        activeMayBeLimited: false, activeCompletedAt: later }] } });
  });

  it("28日の両端・空の日と同一検索語の別日を残し、範囲外や他ページを混ぜない", async () => {
    const repo = repository();
    const from = "2026-08-01";
    const to = "2026-08-28";
    for (const metricDate of ["2026-07-31", from, to, "2026-08-29"]) {
      const target = await repo.beginOrResume({ siteSlug: SITE, from: metricDate, to: metricDate, observedAt: AT });
      if (!target.ok) throw new Error("start failed");
      await repo.stagePage({ target: target.value, rows: [metric(1, { metricDate }),
        metric(2, { metricDate, pageKey: `${PAGE}-other` as PageKey })],
        nextStartRow: 2, complete: true, mayBeLimited: false, observedAt: AT });
    }
    const result = await repo.recent({ siteSlug: SITE, pageKey: PAGE, from, to, limit: 100 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows).toEqual([metric(1, { metricDate: to }), metric(1, { metricDate: from })]);
    expect(result.value.dates).toHaveLength(28);
    expect(result.value.dates[0]?.metricDate).toBe(to);
    expect(result.value.dates.at(-1)?.metricDate).toBe(from);
    expect(result.value.dates.filter((date) => date.active)).toHaveLength(2);
    expect(result.value.dates.filter((date) => !date.active)).toHaveLength(26);
  });

  it("同じpageKeyでも別workspace・ブログの明細と取得状態を返さない", async () => {
    const repo = repository();
    const started = await repo.beginOrResume({ siteSlug: SITE, from: DATE, to: DATE, observedAt: AT });
    if (!started.ok) throw new Error("start failed");
    await repo.stagePage({ target: started.value, rows: [metric(1)], nextStartRow: 50_000,
      complete: true, mayBeLimited: true, observedAt: AT });
    const expected = { ok: true, value: { rows: [], truncated: false,
      dates: [{ metricDate: DATE, active: false, refreshing: false,
        activeMayBeLimited: null, activeCompletedAt: null }] } };
    expect(await repository("query-foreign").recent({ siteSlug: SITE, pageKey: PAGE, from: DATE, to: DATE, limit: 100 })).toEqual(expected);
    expect(await repo.recent({ siteSlug: "another", pageKey: PAGE, from: DATE, to: DATE, limit: 100 })).toEqual(expected);
  });

  it.each([
    { from: "2026-02-30", to: "2026-03-02" },
    { from: "2026-08-1" },
    { from: "2026-08-16", to: "2026-08-15" },
    { from: "2026-08-01", to: "2026-09-01" },
    { siteSlug: "" },
    { siteSlug: " creator-tools " },
    { siteSlug: "creator/tools" },
    { pageKey: "" },
    { pageKey: "https://example.com/article" },
    { pageKey: "example.com/article?secret=value" },
    { limit: 0 },
    { limit: 101 },
    { limit: 1.5 },
  ])("不正な読取条件を空データとせず拒否する: %j", async (invalid) => {
    expect(await repository().recent({ siteSlug: SITE, pageKey: PAGE, from: DATE, to: DATE,
      limit: 100, ...invalid } as Parameters<ReturnType<typeof repository>["recent"]>[0]))
      .toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
  });

  it("31日の上限内は実在する全日を返す", async () => {
    const result = await repository().recent({ siteSlug: SITE, pageKey: PAGE,
      from: "2026-08-01", to: "2026-08-31", limit: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.dates).toHaveLength(31);
  });

  it("0054移行は現在完了runだけを補完し、旧activeの不明情報を捏造しない", async () => {
    await proxy.env.DB.prepare("ALTER TABLE seo_search_query_sync DROP COLUMN active_may_be_limited").run();
    await proxy.env.DB.prepare("ALTER TABLE seo_search_query_sync DROP COLUMN active_completed_at").run();
    const at = Math.floor(Date.parse(AT) / 1_000);
    for (const [site, activeRun, run, status, limited] of [
      ["limited", "a", "a", "complete", 1],
      ["unlimited", "b", "b", "complete", 0],
      ["refreshing", "old", "new", "collecting", 0],
      ["initial", null, "first", "collecting", 0],
    ] as const) {
      await proxy.env.DB.prepare(`INSERT INTO seo_search_query_sync
        (workspace_id,site_slug,metric_date,active_run_id,run_id,status,may_be_limited,started_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?)`).bind("query-owner", site, DATE, activeRun, run, status, limited, at, at).run();
    }
    for (const statement of statementsOf("0061_seo_query_snapshot_state.sql")) {
      await proxy.env.DB.prepare(statement).run();
    }
    for (const [siteSlug, active, refreshing, limited, completedAt] of [
      ["limited", true, false, true, AT],
      ["unlimited", true, false, false, AT],
      ["refreshing", true, true, null, null],
      ["initial", false, true, null, null],
    ] as const) {
      expect(await repository().recent({ siteSlug, pageKey: PAGE, from: DATE, to: DATE, limit: 100 }))
        .toEqual({ ok: true, value: { rows: [], truncated: false, dates: [{
          metricDate: DATE, active, refreshing, activeMayBeLimited: limited, activeCompletedAt: completedAt,
        }] } });
    }
  });
});
