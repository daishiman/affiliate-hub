/** @tier 2 @req REQ-SEO10 REQ-SEO14 @types db-concurrency, fault-injection, db-constraint, tenant-isolation, boundary */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import type { SeoArticleState } from "@/application/ports/seo-measurement";
import type { PublishedArticle } from "@/application/read-models/published-article";
import type { Finding, PageKey } from "@/domain/seo/aeo-measurement";
import * as schema from "@/db/schema";
import { createD1SeoArticleRevisionRepository } from "@/infrastructure/persistence/d1/seo-article-revision-repository";
import { createD1SeoMeasurementRepositories } from "@/infrastructure/persistence/d1/seo-measurement-repository";
import { createD1PublishedArticleWriter, createD1PublishedArticleAdminRepository, publishedArticleSaveStatements } from "@/infrastructure/persistence/d1/published-article-repository";
import type { WorkspaceId } from "@/domain/shared";
import { migrationStatements } from "../support/migrations";

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
const at = "2026-09-06T12:00:00.000Z";
const created = "2026-09-02T00:00:00.000Z";
const pageKey = "example.test/s/site/guides/article" as PageKey;
const original: PublishedArticle = {
  siteSlug: "site", slug: "article", type: "guide", title: "", summary: "元の導入文",
  categorySlug: "basics", publishedAt: created, updatedAt: created,
  author: { slug: "writer", name: "筆者", bio: "", credentials: [] },
  disclosureRequired: false, sections: [{ id: "one", heading: "承認された題名", paragraphs: ["元の本文"] }],
};
const finding: Finding = { pageKey, code: "missing_title", source: "static_audit", detail: "題名が空です", observedAt: at };
const repos = (workspaceId = "owner") => createD1SeoMeasurementRepositories({ db: drizzle(proxy.env.DB, { schema }), workspaceId });
const revisions = (workspaceId = "owner") => createD1SeoArticleRevisionRepository({ db: drizzle(proxy.env.DB, { schema }), workspaceId });
async function sql(query: string, ...values: (string | number | null)[]) {
  return proxy.env.DB.prepare(query).bind(...values).run();
}
async function seed(sourced = true, createdAt: string | null = created) {
  if (sourced) await sql("INSERT INTO articles (id,workspace_id,site_slug,slug,type,title,lead,status,created_at) VALUES ('source','owner','site','article','guide','','元の導入文','published',?)", Date.parse(createdAt ?? created) / 1000);
  await sql("INSERT INTO published_articles (workspace_id,site_slug,slug,source_article_id,type,title,summary,category_slug,author_slug,author_name,published_at,updated_at,article_json,search_text,created_at) VALUES ('owner','site','article',?,'guide','','元の導入文','basics','writer','筆者',?,?,?,'元の本文',?)", sourced ? "source" : null, created, created, JSON.stringify(original), sourced ? null : createdAt);
  await sql("INSERT INTO seo_measurement_setting (workspace_id,introduced_at) VALUES ('owner',?)", Date.parse("2026-09-01") / 1000);
  await drizzle(proxy.env.DB, { schema }).insert(schema.seoFindings).values({ id: "finding", workspaceId: "owner", siteSlug: "site", articleSlug: "article", ...finding, observedAt: new Date(at) });
}
async function legacyLog() {
  const id = `old_${crypto.randomUUID()}`;
  await drizzle(proxy.env.DB, { schema }).insert(schema.seoAutoApplyLogs).values({ id, workspaceId: "owner", siteSlug: "site", articleSlug: "article", pageKey,
    snapshotJson: JSON.stringify({ pageKey, takenAt: at, articleJson: JSON.stringify(original) }), justifiedByJson: JSON.stringify([finding]), appliedAt: new Date(at), diffSummary: "旧反映" });
  return id;
}
async function state() {
  const result = await revisions().find({ siteSlug: "site", articleSlug: "article" });
  expect(result.ok).toBe(true);
  if (!result.ok || !result.value) throw new Error("記事が取得できません");
  return result.value;
}
async function apply(before?: SeoArticleState) {
  const current = before ?? await state();
  return revisions().applyApproved({
    before: current, after: { ...current.article, title: "承認された題名", updatedAt: at },
    plan: { snapshot: { pageKey, takenAt: at, articleJson: JSON.stringify(current.article) }, justifiedBy: [finding], appliedAt: at },
    appliedCodes: ["missing_title"], diffSummary: "題名を補完", approvedBy: "editor",
  });
}
async function snapshot() {
  return Promise.all(["articles", "published_articles", "seo_auto_apply_log", "seo_finding", "published_article_revision_counter"].map(async table => (await proxy.env.DB.prepare(`SELECT * FROM ${table}`).all()).results));
}
beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: D1Database }>({ configPath: "wrangler.jsonc", environment: "dev", persist: false });
  for (const statement of migrationStatements()) await proxy.env.DB.prepare(statement).run();
  await sql("INSERT INTO workspaces(id,name,plan,owner_user_id,timezone,currency,created_at) VALUES ('owner','owner','solo','owner','Asia/Tokyo','JPY',?)", Date.parse(at) / 1000);
  await sql("INSERT INTO site_blueprints (id,workspace_id,slug,name,pattern,blueprint_json) VALUES ('test-site','owner','site','テスト','specialist','{}')");
}, 60_000);
afterAll(async () => { await proxy?.dispose(); });
beforeEach(async () => {
  for (const table of ["published_articles", "articles", "seo_finding", "seo_finding_site_snapshot", "seo_auto_apply_log", "seo_measurement_setting", "seo_page_metric", "seo_page_observation", "published_article_revision_counter"]) await sql(`DELETE FROM ${table}`);
});

describe("承認されたSEO差分の確定と取消", () => {
  it("実作成日時を編集元から読み、旧standaloneの不明日時を公開日で補わない", async () => {
    await seed();
    expect(await state()).toMatchObject({ createdAt: created, revision: 1, sourceRevision: 1 });
    expect((await revisions("foreign").find({ siteSlug: "site", articleSlug: "article" }))).toEqual({ ok: true, value: null });
    await sql("DELETE FROM published_articles"); await sql("DELETE FROM articles"); await sql("DELETE FROM seo_finding"); await sql("DELETE FROM seo_measurement_setting");
    await seed(false, null);
    expect(await state()).toMatchObject({ createdAt: null, sourceArticleId: null, sourceRevision: null });
    const before = await snapshot();
    expect((await apply()).ok).toBe(false);
    expect(await snapshot()).toEqual(before);
  });
  it("編集元・公開本文・検索索引・履歴・所見をまとめて確定し、二重反映を拒否する", async () => {
    await seed(); const before = await state();
    const result = await apply(before);
    expect(result).toMatchObject({ ok: true, value: { approvedBy: "editor", afterRevision: 2, revertedAt: null } });
    expect(await state()).toMatchObject({ revision: 2, sourceRevision: 2, article: { title: "承認された題名" } });
    expect(await proxy.env.DB.prepare("SELECT title FROM articles WHERE id='source'").first()).toEqual({ title: "承認された題名" });
    expect((await proxy.env.DB.prepare("SELECT title FROM published_article_search WHERE published_article_search MATCH '承認された' ").all()).results).toHaveLength(1);
    const saved = await snapshot();
    expect((await apply(before)).ok).toBe(false);
    expect(await snapshot()).toEqual(saved);
  });
  it.each(["log", "finding"])("%s保存の途中障害で編集元も含め全体を戻す", async (target) => {
    await seed(); const before = await snapshot();
    const trigger = target === "log" ? "BEFORE INSERT ON seo_auto_apply_log" : "BEFORE UPDATE ON seo_finding";
    await sql(`CREATE TRIGGER injected_failure ${trigger} BEGIN SELECT RAISE(ABORT, 'injected_failure'); END`);
    try { expect((await apply()).ok).toBe(false); expect(await snapshot()).toEqual(before); }
    finally { await sql("DROP TRIGGER injected_failure"); }
  });
  it.each(["public", "source"])("%s手編集後に古いプレビューを承認しても内容を失わない", async target => {
    await seed(); const before = await state();
    if (target === "public") await sql("UPDATE published_articles SET title='手編集' WHERE workspace_id='owner'");
    else await sql("UPDATE articles SET title='手編集',revision=revision+1 WHERE workspace_id='owner'");
    const saved = await snapshot(); expect(await apply(before)).toMatchObject({ ok: false, error: { code: "CONFLICT" } }); expect(await snapshot()).toEqual(saved);
  });
  it.each(["detail", "observed_at", "source"])("同じコードでも所見の%sが変われば再確認を求める", async column => {
    await seed(); const before = await state();
    await sql(`UPDATE seo_finding SET ${column}=? WHERE workspace_id='owner'`, column === "observed_at" ? Date.parse(at) / 1000 + 1 : "changed");
    const saved = await snapshot(); expect(await apply(before)).toMatchObject({ ok: false, error: { code: "CONFLICT" } }); expect(await snapshot()).toEqual(saved);
  });
  it.each(["paused", "introduced"])("承認直前の%s境界を保存時にも検査する", async change => {
    await seed(); const before = await state();
    await sql(change === "paused" ? "UPDATE seo_measurement_setting SET auto_apply_paused=1" : "UPDATE seo_measurement_setting SET introduced_at=9999999999");
    const saved = await snapshot(); expect(await apply(before)).toMatchObject({ ok: false, error: { code: "CONFLICT" } }); expect(await snapshot()).toEqual(saved);
  });
  it("承認直後だけ取消でき、編集元と公開内容を元へ戻し、所見は次回計測を待つ", async () => {
    await seed(); const applied = await apply(); if (!applied.ok) throw new Error("反映失敗");
    const result = await revisions().revert({ logId: applied.value.id, at: "2026-09-06T13:00:00.000Z", revertedBy: "editor" });
    expect(result).toMatchObject({ ok: true, value: { revertedAt: "2026-09-06T13:00:00.000Z" } });
    expect(await state()).toMatchObject({ revision: 3, sourceRevision: 3, article: original });
    expect(await proxy.env.DB.prepare("SELECT title,lead FROM articles WHERE id='source'").first()).toEqual({ title: "", lead: "元の導入文" });
    expect(await proxy.env.DB.prepare("SELECT applied_at FROM seo_finding WHERE id='finding'").first()).toEqual({ applied_at: Date.parse(at) / 1000 });
    const saved = await snapshot();
    expect((await revisions().revert({ logId: applied.value.id, at, revertedBy: "editor" })).ok).toBe(false);
    expect(await snapshot()).toEqual(saved);
  });
  it.each(["public", "source"])("%s手編集後の取消を拒否して新しい変更と履歴を保つ", async target => {
    await seed(); const applied = await apply(); if (!applied.ok) throw new Error("反映失敗");
    await sql(target === "public" ? "UPDATE published_articles SET title='後の編集' WHERE workspace_id='owner'" : "UPDATE articles SET lead='後の編集',revision=revision+1 WHERE workspace_id='owner'");
    const saved = await snapshot();
    expect((await revisions().revert({ logId: applied.value.id, at, revertedBy: "editor" })).ok).toBe(false);
    expect(await snapshot()).toEqual(saved);
  });
  it("版の証拠の無い旧履歴からは取消せない", async () => {
    await seed(); const oldId = await legacyLog();
    const saved = await snapshot();
    expect(await revisions().revert({ logId: oldId, at, revertedBy: "editor" })).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(await snapshot()).toEqual(saved);
  });
  it("通常の再公開でも実作成日時を変えず公開版を進める", async () => {
    await seed(false);
    const writer = createD1PublishedArticleWriter(drizzle(proxy.env.DB, { schema }));
    expect((await writer.save("owner" as WorkspaceId, { ...original, title: "手編集", createdAt: at })).ok).toBe(true);
    expect(await state()).toMatchObject({ createdAt: created, revision: 2, article: { createdAt: created } });
  });

  it("取消の途中障害でも本文・編集元・履歴の取消印をまとめて戻す", async () => {
    await seed(); const applied = await apply(); if (!applied.ok) throw new Error("反映失敗");
    const saved = await snapshot();
    await sql("CREATE TRIGGER injected_revert_failure BEFORE UPDATE ON published_articles BEGIN SELECT RAISE(ABORT, 'injected_failure'); END");
    try {
      expect((await revisions().revert({ logId: applied.value.id, at, revertedBy: "editor" })).ok).toBe(false);
      expect(await snapshot()).toEqual(saved);
    } finally { await sql("DROP TRIGGER injected_revert_failure"); }
  });
  it("他の作業場所と差分外の本文変更を拒否し、承認対象の内容を保つ", async () => {
    await seed(); const before = await state(); const saved = await snapshot();
    const input = { before, after: { ...before.article, title: "承認された題名", updatedAt: at }, plan: { snapshot: { pageKey, takenAt: at, articleJson: JSON.stringify(before.article) }, justifiedBy: [finding], appliedAt: at }, appliedCodes: ["missing_title"] as const, diffSummary: "題名を補完", approvedBy: "editor" };
    expect((await revisions("foreign").applyApproved(input)).ok).toBe(false);
    expect((await revisions().applyApproved({ ...input, after: { ...input.after, sections: [] } })).ok).toBe(false);
    expect(await snapshot()).toEqual(saved);
  });
  it("同時承認の勝者は1回だけ、後から入った冷却期間も保存時に確認する", async () => {
    await seed(false); const before = await state();
    const results = await Promise.all([apply(before), apply(before)]);
    expect(results.filter(result => result.ok)).toHaveLength(1);
    expect(await proxy.env.DB.prepare("SELECT count(*) AS count FROM seo_auto_apply_log").first()).toEqual({ count: 1 });
  });
  it("プレビュー後に別の反映履歴が入れば冷却期間の競合を拒否する", async () => {
    await seed(); const before = await state();
    await legacyLog();
    const saved = await snapshot();
    expect(await apply(before)).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(await snapshot()).toEqual(saved);
  });
  it("SEO反映後に古い通常編集画面を保存しても承認内容を上書きしない", async () => {
    await seed(false);
    const editor = createD1PublishedArticleAdminRepository(drizzle(proxy.env.DB, { schema }));
    const before = await state(); expect((await apply(before)).ok).toBe(true);
    const saved = await snapshot();
    expect(await editor.replace("owner" as WorkspaceId, { ...original, title: "古い画面の手編集" }, before.revision)).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(await snapshot()).toEqual(saved);
    expect(await editor.find("owner" as WorkspaceId, "site", "article")).toMatchObject({ ok: true, value: { revision: 2 } });
  });
  it("同じ版からの通常編集の同時保存は1回だけ成功する", async () => {
    await seed(false);
    const editor = createD1PublishedArticleAdminRepository(drizzle(proxy.env.DB, { schema }));
    const results = await Promise.all(["変更A", "変更B"].map(title => editor.replace("owner" as WorkspaceId, { ...original, title }, 1)));
    expect(results.filter(result => result.ok && result.value)).toHaveLength(1);
    expect(results.filter(result => !result.ok && result.error.code === "CONFLICT")).toHaveLength(1);
  });
  it("測定記事は他ブログの100件より先に所属を絞り、編集元の有無で落とさない", async () => {
    await seed();
    await sql("INSERT OR IGNORE INTO site_blueprints (id,workspace_id,slug,name,pattern,blueprint_json) VALUES ('other','owner','other','他ブログ','specialist','{}')");
    const rows = Array.from({ length: 106 }, (_, index) => ({ ...original, siteSlug: "other", slug: `other-${index}`, updatedAt: at }));
    rows.push({ ...original, slug: "standalone" });
    for (const article of rows) await drizzle(proxy.env.DB, { schema }).insert(schema.publishedArticles).values({
      workspaceId: "owner", siteSlug: article.siteSlug, slug: article.slug, type: article.type, title: article.title, summary: article.summary,
      categorySlug: article.categorySlug, authorSlug: article.author.slug, authorName: article.author.name,
      publishedAt: article.publishedAt, updatedAt: article.updatedAt, articleJson: JSON.stringify(article),
    });
    const result = await repos().measurementArticles.list({ siteSlug: "site", limit: 2, source: "static_audit" });
    expect(result.ok && result.value.map(article => article.slug)).toEqual(["article", "standalone"]);
    expect(await repos("foreign").measurementArticles.list({ siteSlug: "site", limit: 2, source: "static_audit" })).toEqual({ ok: true, value: [] });
    await sql("UPDATE published_articles SET archived_at=? WHERE workspace_id='owner' AND site_slug='site' AND slug='standalone'", at);
    const publicOnly = await repos().measurementArticles.list({ siteSlug: "site", limit: 2, source: "static_audit" });
    expect(publicOnly.ok && publicOnly.value.map(article => article.slug)).toEqual(["article"]);
  });
  it("所見0件の成功記事も次へ送り、系統ごとに未観測→最古の順番を保つ", async () => {
    await seed(false);
    for (const slug of ["second", "third"]) {
      const article = { ...original, slug };
      await drizzle(proxy.env.DB, { schema }).insert(schema.publishedArticles).values({
        workspaceId: "owner", siteSlug: "site", slug, type: "guide", title: "", summary: article.summary,
        categorySlug: article.categorySlug, authorSlug: "writer", authorName: "筆者", publishedAt: created, updatedAt: created, articleJson: JSON.stringify(article),
      });
    }
    const list = () => repos().measurementArticles.list({ siteSlug: "site", limit: 1, source: "static_audit" });
    for (const slug of ["article", "second", "third"]) {
      const next = await list(); expect(next.ok && next.value.map(article => article.slug)).toEqual([slug]);
      expect(await repos().findings.replaceForPages({ source: "static_audit", observedAt: at, pages: [{ pageKey: `example.test/${slug}` as PageKey, siteSlug: "site", articleSlug: slug }], findings: [] })).toMatchObject({ ok: true, value: { added: 0 } });
    }
    const oldest = await list(); expect(oldest.ok && oldest.value[0]?.slug).toBe("article");
    await repos().findings.replaceForPages({ source: "static_audit", observedAt: "2026-09-07T12:00:00.000Z", pages: [{ pageKey: "example.test/article" as PageKey, siteSlug: "site", articleSlug: "article" }], findings: [] });
    const nextOldest = await list(); expect(nextOldest.ok && nextOldest.value[0]?.slug).toBe("second");
    const ai = await repos().measurementArticles.list({ siteSlug: "site", limit: 1, source: "ai_citation" });
    expect(ai.ok && ai.value[0]?.slug).toBe("article");
  });
  it("所見の入れ替え失敗では元の根拠も成功観測印も変えない", async () => {
    await seed(false); const saved = await snapshot();
    await sql("CREATE TRIGGER injected_observation_failure BEFORE INSERT ON seo_finding BEGIN SELECT RAISE(ABORT, 'injected_failure'); END");
    try {
      expect((await repos().findings.replaceForPages({ source: "static_audit", observedAt: at, pages: [{ pageKey, siteSlug: "site", articleSlug: "article" }], findings: [finding] })).ok).toBe(false);
      expect(await snapshot()).toEqual(saved);
      expect((await proxy.env.DB.prepare("SELECT * FROM seo_page_observation").all()).results).toEqual([]);
    } finally { await sql("DROP TRIGGER injected_observation_failure"); }
  });
  it("後から完了した古い収集が、新しい所見と観測日時を巻き戻さない", async () => {
    await seed(false);
    const pages = [{ pageKey, siteSlug: "site", articleSlug: "article" }];
    const newer = "2026-09-08T12:00:00.000Z";
    expect((await repos().findings.replaceForPages({ source: "static_audit", observedAt: newer, pages, findings: [{ ...finding, observedAt: newer, detail: "新しい観測" }] })).ok).toBe(true);
    const saved = await snapshot();
    const observed = (await proxy.env.DB.prepare("SELECT * FROM seo_page_observation").all()).results;
    expect(await repos().findings.replaceForPages({ source: "static_audit", observedAt: at, pages, findings: [finding] })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(await snapshot()).toEqual(saved);
    expect((await proxy.env.DB.prepare("SELECT * FROM seo_page_observation").all()).results).toEqual(observed);
  });
  it("page観測を持たないGSCもsite cursorでlimited/completeの後着を原子的に拒む", async () => {
    await seed(false);
    const newer = "2026-09-08T12:00:00.000Z";
    const recentPage = "example.test/s/site/guides/recent" as PageKey;
    const oldPage = "example.test/s/site/guides/old" as PageKey;
    const queryFinding = (target: PageKey, observedAt: string): Finding => ({
      pageKey: target, source: "search_console", code: "high_impressions_low_ctr",
      detail: observedAt, observedAt,
    });
    const first = await repos().findings.replaceForPages({
      source: "search_console", observedAt: newer,
      pages: [{ pageKey: recentPage, siteSlug: "site", articleSlug: null }],
      findings: [queryFinding(recentPage, newer)], siteSnapshotSlug: "site",
      completeSiteSlug: "site", recordPageObservations: false,
    });
    expect(first.ok, first.ok ? "" : first.error.message).toBe(true);
    const cursorOnly = await repos().findings.replaceForPages({
      source: "search_console", observedAt: "2026-09-09T12:00:00.000Z",
      pages: [], findings: [], siteSnapshotSlug: "site", recordPageObservations: false,
    });
    expect(cursorOnly.ok).toBe(true);
    const saved = (await repos().findings.list({ siteSlug: "site", source: "search_console", limit: 10 }));

    const stale = await repos().findings.replaceForPages({
      source: "search_console", observedAt: at,
      pages: [{ pageKey: oldPage, siteSlug: "site", articleSlug: null }],
      findings: [queryFinding(oldPage, at)], siteSnapshotSlug: "site",
      recordPageObservations: false,
    });
    expect(stale).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(await repos().findings.list({ siteSlug: "site", source: "search_console", limit: 10 })).toEqual(saved);
  });
  it("所見0件でも最新の観測URLを読み、未観測の旧記事だけ同記事の履歴から補う", async () => {
    await seed(false);
    await repos().findings.replaceForPages({ source: "static_audit", observedAt: at, pages: [{ pageKey, siteSlug: "site", articleSlug: "article" }], findings: [] });
    expect(await repos().findings.observedPageKey({ siteSlug: "site", articleSlug: "article" })).toEqual({ ok: true, value: pageKey });
    expect(await repos("foreign").findings.observedPageKey({ siteSlug: "site", articleSlug: "article" })).toEqual({ ok: true, value: null });
    const latest = "example.test/latest-article" as PageKey;
    await repos().findings.replaceForPages({ source: "ai_citation", observedAt: "2026-09-07T12:00:00.000Z", pages: [{ pageKey: latest, siteSlug: "site", articleSlug: "article" }], findings: [] });
    expect(await repos().findings.observedPageKey({ siteSlug: "site", articleSlug: "article" })).toEqual({ ok: true, value: latest });
    await sql("DELETE FROM seo_page_observation"); await legacyLog();
    expect(await repos().findings.observedPageKey({ siteSlug: "site", articleSlug: "article" })).toEqual({ ok: true, value: pageKey });
    expect(await repos().findings.observedPageKey({ siteSlug: "site", articleSlug: "absent" })).toEqual({ ok: true, value: null });
  });
  it("取り下げ前の通常編集画面は、同URLの再公開記事を上書きできない", async () => {
    await seed(false); const before = await state();
    const db = drizzle(proxy.env.DB, { schema });
    const writer = createD1PublishedArticleWriter(db);
    expect((await writer.unpublish("owner" as WorkspaceId, "site", "article")).ok).toBe(true);
    expect((await writer.save("owner" as WorkspaceId, { ...original, title: "再公開した新しい内容" })).ok).toBe(true);
    const saved = await snapshot();
    expect(await createD1PublishedArticleAdminRepository(db).replace("owner" as WorkspaceId, { ...original, title: "古い画面の内容" }, before.revision)).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(await snapshot()).toEqual(saved);
    expect((await state()).revision).toBeGreaterThan(before.revision);
  });
  it.each([false, true])("同じJSONを再公開しても旧SEO取消の版へ戻らない（編集元あり=%s）", async sourced => {
    await seed(sourced); const applied = await apply(); if (!applied.ok) throw new Error("反映失敗");
    const after = await state(); const db = drizzle(proxy.env.DB, { schema });
    if (sourced) {
      await sql("DELETE FROM published_articles WHERE workspace_id='owner'");
      await db.batch(publishedArticleSaveStatements(db, "owner" as WorkspaceId, after.article, "source"));
      await db.batch(publishedArticleSaveStatements(db, "owner" as WorkspaceId, after.article, "source"));
    } else {
      const writer = createD1PublishedArticleWriter(db);
      expect((await writer.unpublish("owner" as WorkspaceId, "site", "article")).ok).toBe(true);
      expect((await writer.save("owner" as WorkspaceId, after.article)).ok).toBe(true);
      expect((await writer.save("owner" as WorkspaceId, after.article)).ok).toBe(true);
    }
    const saved = await snapshot();
    expect(await revisions().revert({ logId: applied.value.id, at, revertedBy: "editor" })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(await snapshot()).toEqual(saved);
    expect((await state()).revision).toBeGreaterThan(after.revision);
  });
  it("実績の観測日を両端込みで絞り、対象記事をexact指定して題名を返す", async () => {
    await seed();
    await repos().metrics.upsertMany({
      metrics: ["2026-08-01", "2026-09-01", "2026-09-06", "2026-09-07"].map(metricDate => ({ pageKey, metricDate, impressions: 1, clicks: 0, position: 1, aiCitations: null })),
      observedAt: "2026-09-07T12:00:00.000Z",
    });
    const metrics = await repos().metrics.recent({ pageKey, from: "2026-09-01", to: "2026-09-06" });
    expect(metrics.ok && metrics.value.map(row => row.metricDate)).toEqual(["2026-09-01", "2026-09-06"]);
    expect(await repos().findings.groupedByArticle({ siteSlug: "site", articleSlug: "absent", limit: 1 })).toEqual({ ok: true, value: [] });
    expect(await repos().findings.groupedByArticle({ siteSlug: "site", articleSlug: "article", limit: 1 })).toMatchObject({ ok: true, value: [{ title: "", articleSlug: "article" }] });
  });
});
