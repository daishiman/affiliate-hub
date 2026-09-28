/** @tier 2 @req REQ-SEO15 @types tenant-isolation, boundary */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import { createD1SeoMeasurementRepositories } from "@/infrastructure/persistence/d1/seo-measurement-repository";
import { migrationStatements } from "../support/migrations";

type Env = { DB: D1Database };
let proxy: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;

beforeAll(async () => {
  proxy = await getPlatformProxy<Env>({ configPath: "wrangler.jsonc", environment: "dev", persist: false });
  for (const statement of migrationStatements()) await proxy.env.DB.prepare(statement).run();
  const db = drizzle(proxy.env.DB, { schema });
  for (const site of ["a", "b"]) {
    await db.insert(schema.siteBlueprints).values({ id: site, slug: site, workspaceId: "owner", name: site, pattern: "specialist", blueprintJson: "{}" });
    for (const articleSlug of ["article", "archived"]) await db.insert(schema.publishedArticles).values({
      workspaceId: "owner", siteSlug: site, slug: articleSlug, type: "guide", title: `記事${site}`, summary: "概要",
      categorySlug: "basics", authorSlug: "writer", authorName: "筆者", publishedAt: "2026-09-01", updatedAt: "2026-09-01",
      articleJson: "{}", archivedAt: articleSlug === "archived" ? "2026-09-02" : null,
    });
  }
  const cases = [
    { id: "eligible", siteSlug: "a", code: "missing_title" },
    { id: "other-site", siteSlug: "b", code: "missing_title" },
    { id: "template", siteSlug: "a", code: "missing_canonical" },
    { id: "manual", siteSlug: "a", code: "title_too_long" },
    { id: "index", siteSlug: "a", code: "missing_title", articleSlug: null },
    { id: "applied", siteSlug: "a", code: "missing_title", appliedAt: new Date("2026-09-02") },
    { id: "deleted", siteSlug: "a", articleSlug: "deleted", code: "missing_title", observedAt: new Date("2026-08-01") },
    { id: "archived", siteSlug: "a", articleSlug: "archived", code: "missing_title", observedAt: new Date("2026-08-01") },
    { id: "non-reproducible", siteSlug: "a", code: "missing_title", source: "ai_citation" },
    { id: "foreign", siteSlug: "a", code: "missing_title", workspaceId: "other" },
  ];
  await db.insert(schema.seoFindings).values(cases.map((row) => ({
    workspaceId: "owner", articleSlug: "article", source: "static_audit",
    observedAt: new Date("2026-09-01"), ...row, pageKey: `example.test/${row.id}`,
  })));
}, 60_000);

afterAll(async () => { await proxy?.dispose(); });

describe("SEO反映候補の母集団", () => {
  it("選択ブログ内の、記事を自動修正できる未反映所見だけ数える", async () => {
    const repository = createD1SeoMeasurementRepositories({ db: drizzle(proxy.env.DB, { schema }), workspaceId: "owner" });
    const summary = repository.findings.unappliedSummary;
    expect(await summary({ siteSlug: "a" })).toEqual({ ok: true, value: { count: 1, oldestObservedAt: "2026-09-01T00:00:00.000Z" } });
    expect(await summary({ siteSlug: "empty" })).toEqual({ ok: true, value: { count: 0, oldestObservedAt: null } });
    expect(await summary()).toEqual({ ok: true, value: { count: 2, oldestObservedAt: "2026-09-01T00:00:00.000Z" } });
  });
  it("候補と未反映件数の母集団を揃え、対象外所見が候補枠を使わない", async () => {
    const repository = createD1SeoMeasurementRepositories({ db: drizzle(proxy.env.DB, { schema }), workspaceId: "owner" });
    const result = await repository.findings.groupedByArticle({ siteSlug: "a", limit: 1 });
    expect(result).toMatchObject({ ok: true, value: [{ title: "記事a", articleSlug: "article", findings: [{ pageKey: "example.test/eligible", source: "static_audit", code: "missing_title" }] }] });
    if (!result.ok) throw new Error("候補を読めません");
    expect(result.value[0]?.findings).toHaveLength(1);
    const preview = await repository.findings.groupedByArticle({ siteSlug: "a", articleSlug: "article", limit: 1, includeApplied: true });
    if (!preview.ok) throw new Error("所見を読めません");
    expect(preview.value[0]?.findings.map(finding => finding.code)).toContain("missing_canonical");
  });

});
