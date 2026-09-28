/** @tier 2 @req REQ-SEO12 @types db-concurrency, boundary, tenant-isolation, state-transition */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import type { StaticAuditClaim, StaticAuditInventory } from "@/application/ports/seo-static-audit";
import type { PageKey, PageObservation } from "@/domain/seo/aeo-measurement";
import type { DomainError, Result } from "@/domain/shared";
import { createD1SeoStaticAuditRepository } from "@/infrastructure/persistence/d1/seo-static-audit-repository";
import { listSeoCollectionTargets } from "@/infrastructure/platform/seo-measurement-scheduler";
import { migrationStatements } from "../support/migrations";

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
const AT = "2026-09-07T00:00:00.000Z";
const later = (seconds: number) => new Date(Date.parse(AT) + seconds * 1_000).toISOString();
const repos = (workspaceId = "static-owner") => createD1SeoStaticAuditRepository({ db: drizzle(proxy.env.DB, { schema }), workspaceId });
function value<T>(result: Result<T, DomainError>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}
function inventory(count: number, siteSlug = "alpha", version = "1"): StaticAuditInventory {
  return { siteSlug, total: count, complete: true, emitLlmsTxt: true,
    targets: Array.from({ length: count }, (_, index) => {
      const slug = `p-${String(index).padStart(4, "0")}`;
      return { pageKey: `example.test/s/${siteSlug}/blog/${slug}` as PageKey,
        url: `https://example.test/s/${siteSlug}/blog/${slug}`, articleSlug: slug, updatedAt: version === "1" ? null : later(Number(version)) };
    }),
  };
}
function observation(target: StaticAuditClaim["targets"][number]): PageObservation {
  return { pageKey: target.pageKey, url: target.url, title: target.articleSlug,
    metaDescription: "観測した説明文", canonical: target.url, ogImage: "https://example.test/image.png",
    jsonLdTypes: ["Article"], headingLevels: [1, 2], internalLinkCount: 1, images: [] };
}
async function claim(inv: StaticAuditInventory, at = AT, limit = 25) {
  const result = value(await repos().beginOrResume({ inventory: inv, at, limit }));
  if (!result.claim) throw new Error(result.skippedReason ?? "claim missing");
  return result.claim;
}
async function succeed(input: StaticAuditClaim, at = later(1)) {
  return repos().stage({ claim: input, at, attempts: input.targets.map(target => ({
    pageKey: target.pageKey, ok: true as const, observation: observation(target),
  })) });
}
async function ready(inv = inventory(1)) {
  if (inv.targets.length === 0) value(await repos().beginOrResume({ inventory: inv, at: AT, limit: 25 }));
  else value(await succeed(await claim(inv)));
  const loaded = value(await repos().loadCompleteCandidate({ siteSlug: inv.siteSlug, at: later(2) }));
  if (!loaded.candidate) throw new Error("candidate missing");
  return loaded.candidate;
}
async function oldFinding(source = "static_audit", observedAt = 1) {
  await proxy.env.DB.prepare(`INSERT INTO seo_finding
    (id,workspace_id,site_slug,page_key,article_slug,source,code,detail,observed_at)
    VALUES (?, 'static-owner','alpha','example.test/s/alpha/old',NULL,?,'missing_title','old',?)`)
    .bind(`old-${source}`, source, observedAt).run();
}
async function publicSite(siteSlug = "alpha", workspaceId = "static-owner") {
  await proxy.env.DB.prepare(`INSERT OR IGNORE INTO site_blueprints (id,workspace_id,slug,name,pattern,blueprint_json)
    VALUES (?,?,?,'Public','specialist',?)`).bind(`site-${siteSlug}`, workspaceId, siteSlug,
      JSON.stringify({ pages: ["home", "category", "authors", "experts", "review", "privacy"], emitLlmsTxt: true, categories: [] })).run();
  await proxy.env.DB.prepare(`INSERT OR IGNORE INTO site_network_node (id,workspace_id,site_slug,role,name)
    VALUES (?,?,?,'hub','Public')`).bind(`node-${siteSlug}`, workspaceId, siteSlug).run();
  await proxy.env.DB.prepare(`INSERT OR IGNORE INTO legal_page
    (id,workspace_id,site_slug,kind,title,body,status,updated_at)
    VALUES (?,?,?,'privacy_policy','Privacy','Published privacy','published',?)`)
    .bind(`privacy-${workspaceId}-${siteSlug}`, workspaceId, siteSlug, Math.floor(Date.parse(AT) / 1_000)).run();
}
async function publicArticle(slug: string, siteSlug = "alpha", workspaceId = "static-owner", archived = false) {
  const article = { siteSlug, slug, type: "review", title: `Article ${slug}`, summary: "Summary", categorySlug: "category-a",
    author: { slug: "writer" }, reviewedBy: { slug: "expert" }, updatedAt: AT, body: [{ secretFixture: "not-in-inventory" }] };
  await proxy.env.DB.prepare(`INSERT INTO published_articles
    (site_slug,slug,workspace_id,type,title,summary,category_slug,author_slug,author_name,published_at,updated_at,article_json,archived_at)
    VALUES (?,?,?,'review',?,'Summary','category-a','writer','Writer',?,?,?,?)`).bind(siteSlug, slug, workspaceId,
      article.title, AT, AT, JSON.stringify(article), archived ? AT : null).run();
}

beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: D1Database }>({ configPath: "wrangler.jsonc", environment: "dev", persist: false });
  for (const statement of migrationStatements()) await proxy.env.DB.prepare(statement).run();
  for (const id of ["static-owner", "static-foreign"]) await proxy.env.DB.prepare(`INSERT INTO workspaces
    (id,name,plan,owner_user_id,timezone,currency,created_at,suspended_at)
    VALUES (?,?,'solo',?,'Asia/Tokyo','JPY',1,NULL)`).bind(id, id, id).run();
}, 60_000);
afterAll(async () => { await proxy?.dispose(); });
beforeEach(async () => {
  for (const table of ["seo_static_audit_target", "seo_static_audit_scan", "seo_finding", "seo_page_observation", "seo_finding_site_snapshot", "seo_source_collection"])
    await proxy.env.DB.prepare(`DELETE FROM ${table}`).run();
  for (const table of ["legal_page", "published_articles", "site_retirements", "site_network_node", "site_blueprints"])
    await proxy.env.DB.prepare(`DELETE FROM ${table} WHERE workspace_id IN ('static-owner','static-foreign')`).run();
  await publicSite();
});

describe("公開ページの静的監査をD1で巡回する", () => {
  it("定期収集は公開記事0件でも読者向けに公開中のブログを対象にする", async () => {
    expect(await listSeoCollectionTargets(drizzle(proxy.env.DB, { schema }))).toContainEqual({
      workspaceId: "static-owner",
      siteSlug: "alpha",
    });
    await proxy.env.DB.prepare("UPDATE site_network_node SET status='hidden' WHERE site_slug='alpha'").run();
    expect(await listSeoCollectionTargets(drizzle(proxy.env.DB, { schema }))).toContainEqual({
      workspaceId: "static-owner",
      siteSlug: "alpha",
    });
  });
  it("全ブログ表示では監査未開始の公開ブログも分母から落とさない", async () => {
    await publicSite();
    await publicSite("beta");
    await oldFinding();
    const rows = value(await repos().coverage({ staleBefore: AT }));
    expect(rows.map(row => ({ siteSlug: row.siteSlug, status: row.status }))).toEqual([
      { siteSlug: "alpha", status: "not_started" },
      { siteSlug: "beta", status: "not_started" },
    ]);
    expect(value(await repos().coverage({ siteSlug: "alpha", staleBefore: AT }))[0])
      .toMatchObject({ siteSlug: "alpha", status: "not_started", total: 0, inventoryComplete: false, currentFindingCount: 1 });
  });
  it("記事0件でも公開blueprintの入口を返し、本文やsampleを混ぜない", async () => {
    await publicSite();
    const result = value(await repos().inventory({ siteSlug: "alpha", origin: "https://example.test", basePath: "/s/alpha" }));
    expect(result.targets.some(target => target.url === "https://example.test/s/alpha")).toBe(true);
    expect(result.targets.some(target => target.url.endsWith("/privacy"))).toBe(true);
    await proxy.env.DB.prepare(`INSERT INTO legal_page
      (id,workspace_id,site_slug,kind,title,body,status,updated_at)
      VALUES ('terms-static-owner-alpha','static-owner','alpha','site_policy','Terms','Published terms','published',?)`)
      .bind(Math.floor(Date.parse(AT) / 1_000)).run();
    expect(value(await repos().inventory({ siteSlug: "alpha", origin: "https://example.test", basePath: "/s/alpha" }))
      .targets.some(target => target.url.endsWith("/terms"))).toBe(true);
    expect(result.targets.every(target => target.articleSlug === null)).toBe(true);
    expect(result.complete).toBe(true);
    await proxy.env.DB.prepare("UPDATE legal_page SET status='draft' WHERE workspace_id='static-owner' AND site_slug='alpha'").run();
    expect(value(await repos().inventory({ siteSlug: "alpha", origin: "https://example.test", basePath: "/s/alpha" }))
      .targets.some(target => target.url.endsWith("/privacy"))).toBe(false);
    await proxy.env.DB.prepare("UPDATE legal_page SET status='published',deleted_at=1 WHERE workspace_id='static-owner' AND site_slug='alpha'").run();
    expect(value(await repos().inventory({ siteSlug: "alpha", origin: "https://example.test", basePath: "/s/alpha" }))
      .targets.some(target => target.url.endsWith("/privacy"))).toBe(false);
  });

  it("公開projectionから全記事・人物・カテゴリー・後続一覧を作り、非公開/foreignを除外する", async () => {
    await publicSite();
    for (let index = 0; index < 31; index++) await publicArticle(`public-${index}`);
    await publicArticle("archived", "alpha", "static-owner", true);
    await publicSite("beta", "static-foreign");
    await publicArticle("foreign", "beta", "static-foreign");
    const result = value(await repos().inventory({ siteSlug: "alpha", origin: "https://example.test", basePath: "/s/alpha" }));
    expect(result.targets.filter(target => target.articleSlug !== null)).toHaveLength(31);
    expect(result.targets.map(target => target.url)).toEqual(expect.arrayContaining([
      "https://example.test/s/alpha/blog?page=2", "https://example.test/s/alpha/reviews?page=2",
      "https://example.test/s/alpha/categories/category-a", "https://example.test/s/alpha/authors/writer",
      "https://example.test/s/alpha/experts/expert",
    ]));
    expect(JSON.stringify(result)).not.toContain("not-in-inventory");
  });

  it("サイト網の表示状態から公開資格を推測せず、retiredと別workspaceだけを除く", async () => {
    await publicSite();
    const input = { siteSlug: "alpha", origin: "https://example.test", basePath: "/s/alpha" };
    expect(await repos("static-foreign").inventory(input)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    for (const change of ["status='hidden'", "deleted_at=1"]) {
      await proxy.env.DB.prepare(`UPDATE site_network_node SET ${change} WHERE site_slug='alpha'`).run();
      expect(await repos().inventory(input)).toMatchObject({ ok: true });
      await proxy.env.DB.prepare("UPDATE site_network_node SET status='active',deleted_at=NULL WHERE site_slug='alpha'").run();
    }
    await proxy.env.DB.prepare("INSERT INTO site_retirements (slug,workspace_id,retired_at) VALUES ('alpha','static-owner',1)").run();
    expect(await repos().inventory(input)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    await proxy.env.DB.prepare("DELETE FROM site_retirements WHERE slug='alpha'").run();
    await proxy.env.DB.prepare("INSERT INTO site_network_node (id,workspace_id,site_slug,role,name) VALUES ('collision','static-foreign','alpha','hub','Other')").run();
    expect(await repos().inventory(input)).toMatchObject({ ok: true });
  });

  it("26件を25件と1件へ分け、全成功するまで完了候補を返さない", async () => {
    const inv = inventory(26);
    const first = await claim(inv);
    expect(first.targets).toHaveLength(25);
    value(await succeed(first));
    expect(value(await repos().loadCompleteCandidate({ siteSlug: "alpha", at: later(2) })).candidate).toBeNull();
    const next = await claim(inv, later(3));
    expect(next.runId).toBe(first.runId);
    expect(next.targets.map(target => target.articleSlug)).toEqual(["p-0025"]);
    value(await succeed(next, later(4)));
    const candidate = value(await repos().loadCompleteCandidate({ siteSlug: "alpha", at: later(5) })).candidate;
    expect(candidate?.pages).toHaveLength(26);
  });

  it("先頭25件が失敗しても26件目を先に試し、失敗がある間は所見を解消しない", async () => {
    const inv = inventory(26);
    const first = await claim(inv);
    await oldFinding();
    value(await repos().stage({ claim: first, at: later(1), attempts: first.targets.map(target => ({
      pageKey: target.pageKey, ok: false as const, errorCode: "http_error" as const,
    })) }));
    const next = await claim(inv, later(2));
    expect(next.targets[0]?.articleSlug).toBe("p-0025");
    value(await succeed(next, later(3)));
    expect(value(await repos().loadCompleteCandidate({ siteSlug: "alpha", at: later(4) })).candidate).toBeNull();
    expect(await proxy.env.DB.prepare("SELECT count(*) AS n FROM seo_finding").first("n")).toBe(1);
    value(await succeed(await claim(inv, later(5)), later(6)));
    expect(value(await repos().loadCompleteCandidate({ siteSlug: "alpha", at: later(7) })).candidate?.pages).toHaveLength(26);
  });

  it("同時起動では一つだけが取得権を持つ", async () => {
    const results = await Promise.all([1, 2].map(() => repos().beginOrResume({ inventory: inventory(3), at: AT, limit: 2 })));
    expect(results.filter(result => result.ok && result.value.claim !== null)).toHaveLength(1);
  });

  it("期限切れ後に再予約でき、旧leaseのstageは保存しない", async () => {
    const inv = inventory(2);
    const old = await claim(inv);
    const nextAt = new Date(Date.parse(old.leaseExpiresAt) + 1).toISOString();
    const next = await claim(inv, nextAt);
    expect(next.leaseId).not.toBe(old.leaseId);
    expect(await succeed(old, nextAt)).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(value(await repos().coverage({ staleBefore: AT }))[0]).toMatchObject({ never: 2, current: 0 });
    value(await succeed(next, nextAt));
  });

  it("inventoryの変更は新世代となり、旧stageと旧完了候補を拒否する", async () => {
    const candidate = await ready();
    const newClaim = await claim(inventory(2, "alpha", "2"), later(3));
    expect(newClaim.runId).not.toBe(candidate.scan.runId);
    expect(await repos().markPublished({ candidate, findings: [], at: later(4) }))
      .toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const old = newClaim;
    await claim(inventory(3, "alpha", "3"), later(5));
    expect(await succeed(old, later(6))).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("別workspaceのstage/publishと改ざんsiteを拒否し、対象一覧も分離する", async () => {
    const acquired = await claim(inventory(1));
    expect(await repos("static-foreign").stage({ claim: acquired, at: later(1), attempts: [] })).toMatchObject({ ok: false });
    expect(await succeed({ ...acquired, siteSlug: "beta" })).toMatchObject({ ok: false });
    value(await succeed(acquired));
    const candidate = value(await repos().loadCompleteCandidate({ siteSlug: "alpha", at: later(2) })).candidate!;
    expect(await repos("static-foreign").markPublished({ candidate, findings: [], at: later(3) })).toMatchObject({ ok: false });
    expect(value(await repos("static-foreign").coverage({ staleBefore: AT }))).toEqual([]);
    expect(value(await repos().coverage({ siteSlug: "beta", staleBefore: AT }))).toEqual([]);
  });

  it("0件の完全な公開集合は旧staticだけを解消し、別source/site/workspaceを保持する", async () => {
    await oldFinding();
    await proxy.env.DB.prepare(`INSERT INTO seo_finding
      (id,workspace_id,site_slug,page_key,source,code,observed_at)
      VALUES ('gsc','static-owner','alpha','gsc-page','search_console','high_impressions_low_ctr',1),
      ('beta','static-owner','beta','beta-page','static_audit','missing_title',1),
      ('foreign','static-foreign','alpha','foreign-page','static_audit','missing_title',1)`).run();
    const candidate = await ready(inventory(0));
    expect(value(await repos().markPublished({ candidate, findings: [], at: later(3) }))).toMatchObject({ scan: { status: "published" }, added: 0, resolved: 1 });
    const rows = await proxy.env.DB.prepare("SELECT id FROM seo_finding ORDER BY id").all<{ id: string }>();
    expect(rows.results.map(row => row.id)).toEqual(["beta", "foreign", "gsc"]);
    expect(await repos().markPublished({ candidate, findings: [], at: later(4) })).toMatchObject({ ok: false });
  });

  it("上限で切られたinventoryは部分取得せず、完全な候補にしない", async () => {
    const inv = { ...inventory(1), total: 1001, complete: false };
    expect(value(await repos().beginOrResume({ inventory: inv, at: AT, limit: 25 }))).toMatchObject({
      scan: { status: "limited" }, claim: null, skippedReason: expect.stringContaining("上限1,000件"),
    });
    expect(value(await repos().loadCompleteCandidate({ siteSlug: "alpha", at: later(2) })).candidate).toBeNull();
    expect(value(await repos().coverage({ staleBefore: AT }))[0]).toMatchObject({ total: 1001, current: 0, never: 1001, inventoryComplete: false });
  });

  it("1000件を超える入力と26件の取得要求、重複targetを保存前に断る", async () => {
    for (const input of [
      { inventory: inventory(1001), limit: 25 }, { inventory: inventory(1), limit: 26 },
      { inventory: { ...inventory(2), targets: [inventory(1).targets[0]!, inventory(1).targets[0]!] }, limit: 25 },
    ]) expect(await repos().beginOrResume({ ...input, at: AT })).toMatchObject({ ok: false });
    expect(value(await repos().coverage({ staleBefore: AT }))[0]).toMatchObject({
      siteSlug: "alpha", status: "not_started", inventoryComplete: false,
    });
  });

  it("stageの途中SQL失敗では観測・実行権・checkpointをまとめて保持する", async () => {
    const acquired = await claim(inventory(2));
    await proxy.env.DB.prepare(`CREATE TRIGGER fail_static_stage BEFORE UPDATE ON seo_static_audit_target
      WHEN NEW.position=1 BEGIN SELECT RAISE(ABORT,'fixture'); END`).run();
    try { expect(await succeed(acquired)).toMatchObject({ ok: false }); }
    finally { await proxy.env.DB.prepare("DROP TRIGGER fail_static_stage").run(); }
    expect(value(await repos().coverage({ staleBefore: AT }))[0]).toMatchObject({ never: 2, current: 0 });
    value(await succeed(acquired));
  });

  it("所見INSERT失敗では旧所見・観測stamp・run完了を一括rollbackする", async () => {
    await oldFinding();
    const candidate = await ready();
    const findings = [{ source: "static_audit" as const, pageKey: candidate.pages[0]!.target.pageKey,
      code: "missing_title" as const, detail: "new", observedAt: later(2) }];
    await proxy.env.DB.prepare(`CREATE TRIGGER fail_static_publish BEFORE INSERT ON seo_finding
      WHEN NEW.detail='new' BEGIN SELECT RAISE(ABORT,'fixture'); END`).run();
    try { expect(await repos().markPublished({ candidate, findings, at: later(3) })).toMatchObject({ ok: false }); }
    finally { await proxy.env.DB.prepare("DROP TRIGGER fail_static_publish").run(); }
    expect(await proxy.env.DB.prepare("SELECT detail FROM seo_finding").first("detail")).toBe("old");
    expect(await proxy.env.DB.prepare("SELECT count(*) AS n FROM seo_page_observation").first("n")).toBe(0);
    expect(value(await repos().markPublished({ candidate, findings, at: later(3) }))).toMatchObject({ scan: { status: "published" }, added: 1, resolved: 1 });
    expect(await proxy.env.DB.prepare("SELECT detail FROM seo_finding").first("detail")).toBe("new");
    expect(value(await repos().coverage({ staleBefore: AT }))[0]?.currentFindingCount).toBe(1);
  });

  it("未所属page/別sourceの所見と、古い時刻からの完了で新しい所見を巻き戻さない", async () => {
    const candidate = await ready();
    expect(await repos().markPublished({ candidate, at: later(3), findings: [{ source: "static_audit", code: "missing_title",
      pageKey: "example.test/s/beta/foreign" as PageKey, detail: "foreign", observedAt: later(2) }] })).toMatchObject({ ok: false });
    expect(await repos().markPublished({ candidate, at: later(3), findings: [{ source: "ai_citation", code: "not_cited_by_ai_search",
      pageKey: candidate.pages[0]!.target.pageKey, detail: "foreign", observedAt: later(2) }] })).toMatchObject({ ok: false });
    await oldFinding("static_audit", Math.floor(Date.parse(later(500)) / 1000));
    expect(await repos().markPublished({ candidate, findings: [], at: later(3) })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(await proxy.env.DB.prepare("SELECT detail FROM seo_finding").first("detail")).toBe("old");
  });

  it("coverageは未試行/失敗/鮮度切れ/現行を重複なく数え、次世代も前回完了を保持する", async () => {
    const candidate = await ready(inventory(4));
    value(await repos().markPublished({ candidate, findings: [], at: later(3) }));
    await claim(inventory(4), later(4), 1);
    await proxy.env.DB.prepare(`UPDATE seo_static_audit_target SET
      last_success_at=CASE position WHEN 0 THEN ? WHEN 1 THEN ? ELSE NULL END,
      last_attempt_at=CASE position WHEN 2 THEN ? ELSE NULL END,
      failure_code=CASE position WHEN 2 THEN 'http_error' ELSE NULL END`).bind(Date.parse(later(10)), Date.parse(AT), Date.parse(later(10))).run();
    expect(value(await repos().coverage({ staleBefore: later(5) }))[0]).toMatchObject({
      total: 4, current: 1, stale: 1, failed: 1, never: 1, lastCompletedAt: later(3),
    });
  });

  it("同じ対象の並び替えでは世代を変えず、llms設定変更では世代を更新する", async () => {
    const inv = inventory(2);
    const first = await claim(inv, AT, 1);
    value(await succeed(first));
    const next = await claim({ ...inv, targets: [...inv.targets].reverse() }, later(2), 1);
    expect(next.runId).toBe(first.runId);
    const changed = await claim({ ...inv, emitLlmsTxt: false }, later(3), 1);
    expect(changed.runId).not.toBe(first.runId);
  });

  it("取得対象の不足/重複/異なるURLは拒否し、大きすぎる1件だけ失敗として次へ進む", async () => {
    const acquired = await claim(inventory(2));
    const target = acquired.targets[0]!;
    const attempt = { pageKey: target.pageKey, ok: true as const, observation: observation(target) };
    expect(await repos().stage({ claim: acquired, at: later(1), attempts: [attempt] })).toMatchObject({ ok: false });
    expect(await repos().stage({ claim: acquired, at: later(1), attempts: [attempt, attempt] })).toMatchObject({ ok: false });
    const attempts = acquired.targets.map(target => ({ pageKey: target.pageKey, ok: true as const, observation: observation(target) }));
    expect(await repos().stage({ claim: acquired, at: later(1), attempts: attempts.map((item, index) => index === 0
      ? { ...item, observation: { ...item.observation, url: "https://example.test/s/beta/other" } } : item) })).toMatchObject({ ok: false });
    expect(value(await repos().stage({ claim: acquired, at: later(1), attempts: attempts.map((item, index) => index === 0
      ? { ...item, observation: { ...item.observation, title: "x".repeat(150_000) } } : item) }))).toMatchObject({
        scan: { status: "collecting" }, resourceLimitFailures: 1,
      });
    expect(value(await repos().coverage({ staleBefore: AT }))[0]).toMatchObject({ current: 1, failed: 1, never: 0 });
    const retry = value(await repos().beginOrResume({ inventory: inventory(2), at: later(2), limit: 25 }));
    expect(retry.claim?.targets.map(target => target.pageKey)).toEqual([acquired.targets[0]?.pageKey]);
  });

  it("追加された自由フィールドやHTML本文を保存せず、古い時刻のstageを拒否する", async () => {
    const acquired = await claim(inventory(1));
    expect(await succeed(acquired, later(-1))).toMatchObject({ ok: false });
    const target = acquired.targets[0]!;
    value(await repos().stage({ claim: acquired, at: later(1), attempts: [{ pageKey: target.pageKey, ok: true,
      observation: { ...observation(target), htmlBody: "secret-fixture", requestHeaders: { authorization: "secret-fixture" } } as PageObservation,
    }] }));
    const stored = await proxy.env.DB.prepare("SELECT observation_json FROM seo_static_audit_target").first<string>("observation_json");
    expect(stored).not.toContain("secret-fixture");
  });

  it("完了所見と最終成功stampを同時に確定し、stamp失敗なら全体を戻す", async () => {
    const candidate = await ready();
    await oldFinding();
    await proxy.env.DB.prepare(`INSERT INTO seo_source_collection
      (id,workspace_id,source,last_collected_at,last_failed_at,last_failure_reason)
      VALUES ('existing-source','static-owner','static_audit',1,2,'old failure')`).run();
    await proxy.env.DB.prepare(`CREATE TRIGGER fail_source_stamp BEFORE UPDATE ON seo_source_collection
      BEGIN SELECT RAISE(ABORT,'fixture'); END`).run();
    try { expect(await repos().markPublished({ candidate, findings: [], at: later(3) })).toMatchObject({ ok: false }); }
    finally { await proxy.env.DB.prepare("DROP TRIGGER fail_source_stamp").run(); }
    expect(await proxy.env.DB.prepare("SELECT detail FROM seo_finding").first("detail")).toBe("old");
    expect(await proxy.env.DB.prepare("SELECT last_failure_reason FROM seo_source_collection").first("last_failure_reason")).toBe("old failure");
    value(await repos().markPublished({ candidate, findings: [], at: later(3) }));
    expect(await proxy.env.DB.prepare("SELECT last_collected_at,last_failed_at,last_failure_reason FROM seo_source_collection").first())
      .toEqual({ last_collected_at: Math.floor(Date.parse(later(3)) / 1000), last_failed_at: null, last_failure_reason: "" });
  });

  it("同じpage/codeの継続所見は追加/解消件数に含めない", async () => {
    const candidate = await ready();
    const pageKey = candidate.pages[0]!.target.pageKey;
    await proxy.env.DB.prepare(`INSERT INTO seo_finding (id,workspace_id,site_slug,page_key,source,code,observed_at)
      VALUES ('same','static-owner','alpha',?,'static_audit','missing_title',1)`).bind(pageKey).run();
    expect(value(await repos().markPublished({ candidate, findings: [{ pageKey, source: "static_audit", code: "missing_title", detail: "changed explanation", observedAt: later(2) }], at: later(3) })))
      .toMatchObject({ added: 0, resolved: 0 });
  });

  it("公開記事1001件では未開始に見せず、上限超過の世代と理由を返す", async () => {
    await publicSite();
    const slugs = Array.from({ length: 1001 }, (_, index) => `large-${index}`);
    await proxy.env.DB.prepare(`INSERT INTO published_articles
      (site_slug,slug,workspace_id,type,title,summary,category_slug,author_slug,author_name,published_at,updated_at,article_json)
      SELECT 'alpha',value,'static-owner','review','Title','Summary','category-a','writer','Writer',?,?,
        json_object('siteSlug','alpha','slug',value,'type','review','title','Title','summary','Summary',
          'updatedAt',?,'categorySlug','category-a','author',json_object('slug','writer')) FROM json_each(?)`)
      .bind(AT, AT, AT, JSON.stringify(slugs)).run();
    const inv = value(await repos().inventory({ siteSlug: "alpha", origin: "https://example.test", basePath: "/s/alpha" }));
    expect(inv).toMatchObject({ total: 1001, targets: [], complete: false });
    expect(value(await repos().beginOrResume({ inventory: inv, at: AT, limit: 25 }))).toMatchObject({
      scan: { status: "limited", inventoryComplete: false }, claim: null,
      skippedReason: expect.stringContaining("上限1,000件"),
    });
    expect(value(await repos().coverage({ staleBefore: AT }))[0]).toMatchObject({
      siteSlug: "alpha", status: "limited", total: 1001, never: 1001, inventoryComplete: false,
    });
  });

  it("全観測JSONの容量超過を永続的な上限状態にして、前回所見を保持し14日後に再試行する", async () => {
    const first = await claim(inventory(70));
    await oldFinding();
    await proxy.env.DB.prepare("UPDATE seo_static_audit_target SET observation_json=?,last_success_at=?")
      .bind(JSON.stringify({ title: "x".repeat(128_000) }), Date.parse(later(1))).run();
    await proxy.env.DB.prepare("UPDATE seo_static_audit_scan SET status='ready',lease_id=NULL,lease_expires_at=NULL").run();
    expect(value(await repos().loadCompleteCandidate({ siteSlug: "alpha", at: later(2) }))).toMatchObject({
      candidate: null, limitedReason: expect.stringContaining("14日後に再試行"),
    });
    expect(await proxy.env.DB.prepare("SELECT detail FROM seo_finding").first("detail")).toBe("old");
    expect(value(await repos().coverage({ staleBefore: AT }))[0]).toMatchObject({ status: "limited", current: 70, currentFindingCount: 1 });
    expect(value(await repos().beginOrResume({ inventory: inventory(70), at: later(3), limit: 25 }))).toMatchObject({
      claim: null, skippedReason: expect.stringContaining("一括確認容量"),
    });
    const retried = value(await repos().beginOrResume({
      inventory: inventory(70), at: later(14 * 24 * 60 * 60 + 3), limit: 25,
    }));
    expect(retried.claim?.runId).not.toBe(first.runId);
  });
});
