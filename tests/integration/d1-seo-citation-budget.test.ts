/** @tier 2 @req REQ-SEO12 @types db-concurrency, boundary, tenant-isolation, state-transition */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import type { PageKey } from "@/domain/seo/aeo-measurement";
import { createD1SeoMeasurementRepositories } from "@/infrastructure/persistence/d1/seo-measurement-repository";
import { migrationStatements } from "../support/migrations";

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
const SEPTEMBER = "2026-09-07T00:00:00.000Z";
const OCTOBER = "2026-10-01T00:00:00.000Z";

const repos = (workspaceId = "budget-owner") => createD1SeoMeasurementRepositories({
  db: drizzle(proxy.env.DB, { schema }), workspaceId,
});

async function insertWorkspace(id: string) {
  await proxy.env.DB.prepare(`INSERT INTO workspaces
    (id,name,plan,owner_user_id,timezone,currency,created_at,suspended_at)
    VALUES (?,?,'solo',?,'Asia/Tokyo','JPY',?,NULL)`)
    .bind(id, id, `owner-${id}`, Math.floor(Date.parse(SEPTEMBER) / 1_000)).run();
}

async function setMonthlyLimit(limit: number, workspaceId = "budget-owner") {
  await proxy.env.DB.prepare(`INSERT INTO seo_measurement_setting
    (workspace_id,introduced_at,citation_monthly_search_limit) VALUES (?,?,?)
    ON CONFLICT(workspace_id) DO UPDATE SET citation_monthly_search_limit=excluded.citation_monthly_search_limit`)
    .bind(workspaceId, Math.floor(Date.parse(SEPTEMBER) / 1_000), limit).run();
}

beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: "wrangler.jsonc", environment: "dev", persist: false,
  });
  for (const statement of migrationStatements()) await proxy.env.DB.prepare(statement).run();
  await insertWorkspace("budget-owner");
  await insertWorkspace("budget-foreign");
  await proxy.env.DB.prepare(`INSERT INTO site_blueprints
    (id,workspace_id,slug,name,pattern,blueprint_json)
    VALUES ('budget-alpha','budget-owner','alpha','Alpha','specialist','{}')`).run();
}, 60_000);

afterAll(async () => { await proxy?.dispose(); });

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM seo_ai_citation_attempt").run();
  await proxy.env.DB.prepare("DELETE FROM seo_ai_citation_monthly_usage").run();
  await proxy.env.DB.prepare("DELETE FROM seo_measurement_setting WHERE workspace_id IN ('budget-owner','budget-foreign')").run();
  await proxy.env.DB.prepare("DELETE FROM published_articles WHERE workspace_id IN ('budget-owner','budget-foreign')").run();
});

describe("AI被引用チェックの月次検索予算", () => {
  it("予約した上限ではなく提供元が返した実検索数だけ確定し、翌UTC月は0から始める", async () => {
    await setMonthlyLimit(10);
    const budget = repos().citationBudgets;
    const reserved = await budget.reserve({ siteSlug: "alpha", at: SEPTEMBER,
      monthlyLimit: 10, siteMonthlyLimit: 10, requestedSearches: 3 });
    expect(reserved).toMatchObject({ ok: true, value: { reservation: { reservedSearches: 3 } } });
    if (!reserved.ok || reserved.value.reservation === null) throw new Error("reserve failed");
    expect(await budget.settle({ reservation: reserved.value.reservation, usedSearches: 1, unconfirmedSearches: 0, at: OCTOBER,
      attempted: [{ siteSlug: "alpha", articleSlug: "article-a", pageKey: "example.test/s/alpha/a" as PageKey, attemptedAt: SEPTEMBER }],
    })).toMatchObject({ ok: true, value: { monthKey: "2026-09", usedSearches: 1, unconfirmedSearches: 0, reservedSearches: 0, remainingSearches: 9 } });

    expect(await budget.current({ at: OCTOBER, monthlyLimit: 10 }))
      .toEqual({ ok: true, value: { monthKey: "2026-10", limitSearches: 10,
        usedSearches: 0, unconfirmedSearches: 0, reservedSearches: 0, remainingSearches: 10, reached: false } });
  });

  it("同じworkspaceの並行予約を直列化し、siteが違っても月次総枠を二重消費しない", async () => {
    await setMonthlyLimit(3);
    const budget = repos().citationBudgets;
    const results = await Promise.all(["alpha", "beta"].map((siteSlug) => budget.reserve({
      siteSlug, at: SEPTEMBER, monthlyLimit: 3, siteMonthlyLimit: 3, requestedSearches: 3,
    })));
    const granted = results.flatMap((result) => result.ok && result.value.reservation
      ? [result.value.reservation.reservedSearches] : []);
    expect(granted.reduce((sum, value) => sum + value, 0)).toBe(3);
    expect(await budget.current({ at: SEPTEMBER, monthlyLimit: 3 }))
      .toMatchObject({ ok: true, value: { reservedSearches: 3, remainingSearches: 0, reached: true } });
  });

  it("site月内割当を越えて先頭siteだけが共有枠を使い切らない", async () => {
    await setMonthlyLimit(10);
    const budget = repos().citationBudgets;
    const first = await budget.reserve({ siteSlug: "alpha", at: SEPTEMBER,
      monthlyLimit: 10, siteMonthlyLimit: 3, requestedSearches: 9 });
    expect(first).toMatchObject({ ok: true, value: { reservation: { reservedSearches: 3 } } });
    if (!first.ok || first.value.reservation === null) throw new Error("reserve failed");
    await budget.settle({ reservation: first.value.reservation, usedSearches: 3, unconfirmedSearches: 0, attempted: [], at: SEPTEMBER });
    expect(await budget.reserve({ siteSlug: "alpha", at: "2026-09-14T00:00:00.000Z",
      monthlyLimit: 10, siteMonthlyLimit: 3, requestedSearches: 3 }))
      .toMatchObject({ ok: true, value: { reservation: null, unavailableReason: "site_exhausted" } });
    expect(await budget.reserve({ siteSlug: "beta", at: "2026-09-14T00:00:00.000Z",
      monthlyLimit: 10, siteMonthlyLimit: 3, requestedSearches: 3 }))
      .toMatchObject({ ok: true, value: { reservation: { reservedSearches: 3 } } });
  });

  it("送信後に孤児化した予約は再利用せず、lease期限後に全量を消費へ移す", async () => {
    await setMonthlyLimit(6);
    const budget = repos().citationBudgets;
    expect(await budget.reserve({ siteSlug: "alpha", at: SEPTEMBER,
      monthlyLimit: 6, siteMonthlyLimit: 6, requestedSearches: 3 }))
      .toMatchObject({ ok: true, value: { reservation: { reservedSearches: 3 } } });
    expect(await budget.reserve({ siteSlug: "alpha", at: "2026-09-07T02:00:00.000Z",
      monthlyLimit: 6, siteMonthlyLimit: 6, requestedSearches: 3 }))
      .toMatchObject({ ok: true, value: {
        reservation: { reservedSearches: 3 }, status: { usedSearches: 0, unconfirmedSearches: 3, reservedSearches: 3, remainingSearches: 0 },
      } });
  });

  it("settleは予約IDへ束縛し、別workspaceと遅延した二重確定を拒否する", async () => {
    await setMonthlyLimit(10);
    const owner = repos().citationBudgets;
    const reserved = await owner.reserve({ siteSlug: "alpha", at: SEPTEMBER,
      monthlyLimit: 10, siteMonthlyLimit: 10, requestedSearches: 3 });
    if (!reserved.ok || reserved.value.reservation === null) throw new Error("reserve failed");
    const input = { reservation: reserved.value.reservation, usedSearches: 2, unconfirmedSearches: 0, attempted: [], at: SEPTEMBER };
    expect(await repos("budget-foreign").citationBudgets.settle(input))
      .toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect((await owner.settle(input)).ok).toBe(true);
    expect(await owner.settle(input)).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("失敗を含む試行時刻をpage本文なしでupsertし、古い後着では巻き戻さない", async () => {
    await setMonthlyLimit(10);
    const budget = repos().citationBudgets;
    const reserved = await budget.reserve({ siteSlug: "alpha", at: SEPTEMBER,
      monthlyLimit: 10, siteMonthlyLimit: 10, requestedSearches: 3 });
    if (!reserved.ok || reserved.value.reservation === null) throw new Error("reserve failed");
    await budget.settle({ reservation: reserved.value.reservation, usedSearches: 0, unconfirmedSearches: 3, at: SEPTEMBER,
      attempted: [{ siteSlug: "alpha", articleSlug: "failed-article", pageKey: "example.test/s/alpha/failed" as PageKey, attemptedAt: "2026-09-07T01:00:00.000Z" }],
    });
    const next = await budget.reserve({ siteSlug: "alpha", at: "2026-09-07T02:00:00.000Z",
      monthlyLimit: 10, siteMonthlyLimit: 10, requestedSearches: 3 });
    if (!next.ok || next.value.reservation === null) throw new Error("second reserve failed");
    await budget.settle({ reservation: next.value.reservation, usedSearches: 0, unconfirmedSearches: 0,
      at: "2026-09-07T02:00:00.000Z",
      attempted: [{ siteSlug: "alpha", articleSlug: "failed-article",
        pageKey: "example.test/s/alpha/old" as PageKey, attemptedAt: "2026-09-07T00:30:00.000Z" }],
    });
    const row = await proxy.env.DB.prepare("SELECT article_slug,page_key,last_attempted_at FROM seo_ai_citation_attempt WHERE workspace_id='budget-owner'").first();
    expect(row).toEqual({ article_slug: "failed-article", page_key: "example.test/s/alpha/failed", last_attempted_at: Date.parse("2026-09-07T01:00:00.000Z") / 1_000 });
  });

  it("失敗した記事も試行済みとして巡回末尾へ送り、未試行記事を次に選ぶ", async () => {
    await setMonthlyLimit(10);
    for (const slug of ["article-a", "article-b"]) {
      await proxy.env.DB.prepare(`INSERT INTO published_articles
        (workspace_id,site_slug,slug,type,title,summary,category_slug,author_slug,author_name,published_at,updated_at,article_json)
        VALUES ('budget-owner','alpha',?,'guide',?,'summary','cat','author','Author','2026-09-01','2026-09-01',?)`)
        .bind(slug, slug, JSON.stringify({ siteSlug: "alpha", slug })).run();
    }
    const budget = repos().citationBudgets;
    const reserved = await budget.reserve({ siteSlug: "alpha", at: SEPTEMBER,
      monthlyLimit: 10, siteMonthlyLimit: 10, requestedSearches: 3 });
    if (!reserved.ok || reserved.value.reservation === null) throw new Error("reserve failed");
    await budget.settle({ reservation: reserved.value.reservation, usedSearches: 0, unconfirmedSearches: 3, at: SEPTEMBER,
      attempted: [{ siteSlug: "alpha", articleSlug: "article-a", pageKey: "example.test/s/alpha/a" as PageKey, attemptedAt: SEPTEMBER }],
    });
    expect(await repos().measurementArticles.list({ siteSlug: "alpha", source: "ai_citation", limit: 1 }))
      .toMatchObject({ ok: true, value: [{ slug: "article-b" }] });
  });

  it("負数・小数・予約超過を外部使用数として確定しない", async () => {
    await setMonthlyLimit(10);
    const budget = repos().citationBudgets;
    expect(await budget.reserve({ siteSlug: "alpha", at: SEPTEMBER,
      monthlyLimit: -1, siteMonthlyLimit: 1, requestedSearches: 1 }))
      .toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(await budget.reserve({ siteSlug: "alpha", at: SEPTEMBER,
      monthlyLimit: 10, siteMonthlyLimit: 1.5, requestedSearches: 1 }))
      .toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(await budget.reserve({ siteSlug: "alpha", at: SEPTEMBER,
      monthlyLimit: 10, siteMonthlyLimit: 10, requestedSearches: 0 }))
      .toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    const reserved = await budget.reserve({ siteSlug: "alpha", at: SEPTEMBER,
      monthlyLimit: 10, siteMonthlyLimit: 10, requestedSearches: 3 });
    if (!reserved.ok || reserved.value.reservation === null) throw new Error("reserve failed");
    for (const values of [[-1, 0], [0.5, 0], [4, 0], [2, 2]] as const) {
      expect(await budget.settle({ reservation: reserved.value.reservation,
        usedSearches: values[0], unconfirmedSearches: values[1], attempted: [], at: SEPTEMBER }))
        .toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    }
  });

  it("読込後に月次設定が変わった古いrunは新規予約を取れない", async () => {
    await setMonthlyLimit(100);
    await setMonthlyLimit(0);
    expect(await repos().citationBudgets.reserve({ siteSlug: "alpha", at: SEPTEMBER,
      monthlyLimit: 100, siteMonthlyLimit: 100, requestedSearches: 3 }))
      .toMatchObject({ ok: true, value: { reservation: null, unavailableReason: "setting_changed" } });
    await setMonthlyLimit(200);
    expect(await repos().citationBudgets.reserve({ siteSlug: "alpha", at: SEPTEMBER,
      monthlyLimit: 100, siteMonthlyLimit: 100, requestedSearches: 3 }))
      .toMatchObject({ ok: true, value: { reservation: null, unavailableReason: "setting_changed" } });
  });
});
