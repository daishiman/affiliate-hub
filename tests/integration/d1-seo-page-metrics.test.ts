/** @tier 2 @req REQ-SEO12 REQ-SEO13 @types equivalence, boundary, tenant-isolation, idempotency */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import type { PageKey } from "@/domain/seo/aeo-measurement";
import * as schema from "@/db/schema";
import { createD1SeoMeasurementRepositories } from "@/infrastructure/persistence/d1/seo-measurement-repository";
import { migrationStatements } from "../support/migrations";

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
const pageKey = "example.test/s/site/guides/article" as PageKey;
const metricDate = "2026-09-06";
const repos = (workspaceId = "owner") => createD1SeoMeasurementRepositories({ db: drizzle(proxy.env.DB, { schema }), workspaceId }).metrics;
const read = (workspaceId = "owner") => repos(workspaceId).recent({ pageKey, from: metricDate, to: metricDate });
const gsc = { pageKey, metricDate, impressions: 200, clicks: 3, position: 4.5, aiCitations: null };
beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: D1Database }>({ configPath: "wrangler.jsonc", environment: "dev", persist: false });
  for (const statement of migrationStatements()) await proxy.env.DB.prepare(statement).run();
}, 60_000);
afterAll(async () => { await proxy?.dispose(); });
beforeEach(async () => { await proxy.env.DB.prepare("DELETE FROM seo_page_metric").run(); });

describe("日ごとの検索実績と最新AI確認", () => {
  it("AIだけを確認した日は検索数値を0と偽らず未観測で返す", async () => {
    expect(await repos().upsertAiCitations([{ pageKey, metricDate, aiCitations: 0 }])).toEqual({ ok: true, value: 1 });
    expect(await read()).toEqual({ ok: true, value: [{ pageKey, metricDate, impressions: null, clicks: null, position: null, aiCitations: 0 }] });
    expect(await read("foreign")).toEqual({ ok: true, value: [] });
  });
  it("GSCとAIをどちらの順で保存しても双方を保持し同日の再確認は最新値になる", async () => {
    await repos().upsertMany({ metrics: [gsc], observedAt: "2026-09-06T00:00:00.000Z" });
    await repos().upsertAiCitations([{ pageKey, metricDate, aiCitations: 1 }]);
    expect(await read()).toEqual({ ok: true, value: [{ ...gsc, aiCitations: 1 }] });
    await repos().upsertMany({ metrics: [{ ...gsc, clicks: 4, aiCitations: 99 }], observedAt: "2026-09-06T01:00:00.000Z" });
    expect(await read()).toEqual({ ok: true, value: [{ ...gsc, clicks: 4, aiCitations: 1 }] });
    await repos().upsertAiCitations([{ pageKey, metricDate, aiCitations: 0 }]);
    expect(await read()).toEqual({ ok: true, value: [{ ...gsc, clicks: 4, aiCitations: 0 }] });
  });
  it("AI先行でもGSCの後着実績で未観測が観測済へ切り替わる", async () => {
    await repos().upsertAiCitations([{ pageKey, metricDate, aiCitations: 1 }]);
    await repos().upsertMany({ metrics: [gsc], observedAt: "2026-09-06T00:00:00.000Z" });
    expect(await read()).toEqual({ ok: true, value: [{ ...gsc, aiCitations: 1 }] });
  });
  it("既存形式の行は検索由来として読み、確認していないAIはnullのまま", async () => {
    await proxy.env.DB.prepare("INSERT INTO seo_page_metric(id,workspace_id,page_key,metric_date,impressions,clicks,position) VALUES ('old','owner',?,'2026-09-06',0,0,0)").bind(pageKey).run();
    expect(await read()).toEqual({ ok: true, value: [{ pageKey, metricDate, impressions: 0, clicks: 0, position: 0, aiCitations: null }] });
  });
  it("1001件を超える異なるpageをJSON1 bulkで1行ずつ欠けずに保存する", async () => {
    const metrics = Array.from({ length: 1_201 }, (_, index) => ({
      ...gsc,
      pageKey: `example.test/s/site/guides/page-${index}` as PageKey,
      impressions: index,
    }));
    expect(await repos().upsertMany({ metrics, observedAt: "2026-09-06T02:00:00.000Z" }))
      .toEqual({ ok: true, value: 1_201 });
    expect((await proxy.env.DB.prepare("SELECT count(*) AS count FROM seo_page_metric WHERE workspace_id='owner'").first<{ count: number }>())?.count).toBe(1_201);
  });
  it("AI実績も1001件超をJSON1 bulkで保存し、1行ごとのD1 queryにしない", async () => {
    const metrics = Array.from({ length: 1_201 }, (_, index) => ({
      pageKey: `example.test/s/site/guides/ai-${index}` as PageKey,
      metricDate,
      aiCitations: index % 2,
    }));
    expect(await repos().upsertAiCitations(metrics)).toEqual({ ok: true, value: 1_201 });
    expect((await proxy.env.DB.prepare("SELECT count(*) AS count FROM seo_page_metric WHERE workspace_id='owner'")
      .first<{ count: number }>())?.count).toBe(1_201);
  });
  it("古い取得の後着では同じ日pageの検索実績を巻き戻さない", async () => {
    await repos().upsertMany({ metrics: [{ ...gsc, clicks: 9 }], observedAt: "2026-09-06T02:00:00.000Z" });
    expect(await repos().upsertMany({ metrics: [{ ...gsc, clicks: 1 }], observedAt: "2026-09-06T01:00:00.000Z" }))
      .toEqual({ ok: true, value: 0 });
    expect(await read()).toEqual({ ok: true, value: [{ ...gsc, clicks: 9 }] });
  });
});
