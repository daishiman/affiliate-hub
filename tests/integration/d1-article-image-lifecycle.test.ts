/** @tier 2 @req REQ-BOPS05, REQ-BOPS14, FRONT-REQ-005 @types db-migration, boundary, tenant-isolation, state-transition */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import { asArticleId, type WorkspaceId } from "@/domain/shared";
import { findArticleImage, isArticleImagePublic, isArticleImageReferenced, listArticleImagesForSweep, ownsImageArticle } from "@/infrastructure/persistence/d1/article-image-repository";
import { runArticleImageReclaim } from "@/infrastructure/platform/article-image-reclaim";
import { migrationStatements } from "../support/migrations";

type Env = { DB: D1Database };
let proxy: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
const workspace = "ws-images" as WorkspaceId;
const now = new Date("2026-09-06T00:00:00Z");
const old = new Date("2026-06-01T00:00:00Z");
const db = () => drizzle(proxy.env.DB, { schema });
const bucket = { put: vi.fn(), get: vi.fn(), delete: vi.fn(), list: vi.fn() };
let sequence = 0;
let imageId = "";
const href = () => `/api/article-images/${imageId}`;
const objectKey = () => `article-images/${workspace}/article-a/${imageId}.png`;
beforeAll(async () => {
  proxy = await getPlatformProxy<Env>({ configPath: "wrangler.jsonc", environment: "dev", persist: false });
  for (const statement of migrationStatements()) await proxy.env.DB.prepare(statement).run();
}, 60_000);
afterAll(async () => { await proxy?.dispose(); });
beforeEach(async () => {
  vi.clearAllMocks();
  imageId = `image-${++sequence}`;
  bucket.list.mockResolvedValue({ objects: [], truncated: false });
  // 永久墓標はfixtureでも解除しない。試験ごとに新しいIDを使う。
  await proxy.env.DB.prepare("DELETE FROM article_image WHERE lifecycle NOT IN ('deleting', 'deleted')").run();
  for (const table of ["article_image_sweep_state", "published_articles", "blog_article_block", "articles", "site_network_node", "site_blueprints"]) await proxy.env.DB.prepare(`DELETE FROM ${table}`).run();
  await db().insert(schema.siteBlueprints).values({ id: "site", workspaceId: workspace, slug: "site", name: "Site", pattern: "A", blueprintJson: "{}" });
  await db().insert(schema.siteNetworkNodes).values({ id: "network", workspaceId: workspace, siteSlug: "site", role: "hub", name: "Site" });
  await db().insert(schema.articles).values({ id: "article-a", workspaceId: workspace, siteSlug: "site", slug: "article-a", type: "guide", title: "A", status: "published" });
  await db().insert(schema.articleImages).values({ id: imageId, workspaceId: workspace, articleId: "article-a", objectKey: objectKey(), mimeType: "image/png", byteSize: 12, createdAt: old });
});
const image = async () => (await findArticleImage(db(), imageId))!;
async function publish(body: string, overrides: Partial<typeof schema.publishedArticles.$inferInsert> = {}) {
  await db().insert(schema.publishedArticles).values({ siteSlug: "site", slug: "article-a", workspaceId: workspace, sourceArticleId: "article-a", type: "guide", title: "A", summary: "A", categorySlug: "guide", authorSlug: "writer", authorName: "Writer", publishedAt: "2026-06-01", updatedAt: "2026-06-01", articleJson: JSON.stringify({ sections: [{ paragraphs: [body] }] }), ...overrides });
}

describe("画像と記事の公開状態", () => {
  it("同workspaceの現存記事だけに紐づけられる", async () => {
    expect(await ownsImageArticle(db(), workspace, "article-a")).toBe(true);
    expect(await ownsImageArticle(db(), "other" as WorkspaceId, "article-a")).toBe(false);
    expect(await ownsImageArticle(db(), workspace, "missing")).toBe(false);
  });
  it("台帳だけ・別画像への言及だけでは匿名公開しない", async () => {
    expect(await isArticleImagePublic(db(), await image())).toBe(false);
    await publish("/api/article-images/other");
    expect(await isArticleImagePublic(db(), await image())).toBe(false);
  });
  it("現行の公開参照だけを公開し、公開停止とサイト停止が反映される", async () => {
    await publish(href());
    expect(await isArticleImagePublic(db(), await image())).toBe(true);
    await proxy.env.DB.prepare("UPDATE published_articles SET archived_at = '2026-09-06'").run();
    expect(await isArticleImagePublic(db(), await image())).toBe(false);
    await proxy.env.DB.prepare("UPDATE published_articles SET archived_at = NULL").run();
    await proxy.env.DB.prepare("UPDATE site_network_node SET status = 'hidden'").run();
    expect(await isArticleImagePublic(db(), await image())).toBe(false);
  });
  it("他workspaceの本文では画像が公開されない", async () => {
    await db().insert(schema.siteBlueprints).values({ id: "other-site", workspaceId: "other", slug: "other-site", name: "Other", pattern: "A", blueprintJson: "{}" });
    await db().insert(schema.siteNetworkNodes).values({ id: "other-network", workspaceId: "other", siteSlug: "other-site", role: "hub", name: "Other" });
    await publish(href(), { workspaceId: "other", sourceArticleId: null, siteSlug: "other-site" });
    expect(await isArticleImagePublic(db(), await image())).toBe(false);
  });
});

describe("画像の参照点検", () => {
  it("別記事へのコピーも保持し、他workspaceのコピーは参照にしない", async () => {
    await db().insert(schema.blogArticleBlocks).values({ id: "copy", workspaceId: "other", articleId: "article-b", kind: "summary-section", body: href() });
    expect(await isArticleImageReferenced(db(), await image())).toBe(false);
    await proxy.env.DB.prepare("UPDATE blog_article_block SET workspace_id = ?").bind(workspace).run();
    expect(await isArticleImageReferenced(db(), await image())).toBe(true);
    await runArticleImageReclaim(proxy.env.DB, bucket, now);
    expect(bucket.delete).not.toHaveBeenCalled();
    expect((await image()).referenced).toBe(true);
  });
  it("復元対象の公開JSONも保持する", async () => {
    await publish(href(), { archivedAt: "2026-09-01" });
    expect(await isArticleImageReferenced(db(), await image())).toBe(true);
    await runArticleImageReclaim(proxy.env.DB, bucket, now);
    expect(bucket.delete).not.toHaveBeenCalled();
  });
  it("古い500枚を点検したあと、501枚目が次の回に進む", async () => {
    for (let n = 0; n < 50; n++) await db().insert(schema.articleImages).values(Array.from({ length: 10 }, (_, i) => ({ id: `extra-${n * 10 + i}`, workspaceId: workspace, articleId: asArticleId("article-a"), objectKey: `article-images/${workspace}/article-a/extra-${n * 10 + i}.png`, mimeType: "image/png", byteSize: 12, createdAt: old })));
    await db().insert(schema.blogArticleBlocks).values({ id: "used-500", workspaceId: workspace, articleId: "article-a", kind: "summary-section", body: Array.from({ length: 500 }, (_, i) => `/api/article-images/extra-${i}`).join(" ") });
    await runArticleImageReclaim(proxy.env.DB, bucket, now);
    const rest = await listArticleImagesForSweep(db(), now, 1);
    expect(rest[0]?.id).toBe(imageId);
    await runArticleImageReclaim(proxy.env.DB, bucket, new Date(now.getTime() + 1000));
    const checked = await proxy.env.DB.prepare("SELECT last_checked_at FROM article_image WHERE id = ?").bind(imageId).first<{ last_checked_at: number }>();
    expect(checked?.last_checked_at).toBe(now.getTime() / 1000 + 1);
  });
  it("未参照画像を原子的に閉じてから物理回収し、公開経路へ戻さない", async () => {
    const result = await runArticleImageReclaim(proxy.env.DB, bucket, now);
    expect(result).toMatchObject({ reclaimed: 1, deferred: 0 });
    expect(bucket.delete).toHaveBeenCalledWith(objectKey());
    expect(await findArticleImage(db(), imageId)).toBeNull();
  });
});
