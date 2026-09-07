/** @tier 2 @req REQ-BOPS05, REQ-BOPS14 @types db-migration, tenant-isolation, state-transition, error */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import { articleImageHref, articleImageKey, ARTICLE_IMAGE_UPLOAD_GRACE_MS } from "@/domain/blogops/article-image-policy";
import { asArticleId, type WorkspaceId } from "@/domain/shared";
import {
  claimArticleImageDeletion, finalizeArticleImage, findArticleImage, findArticleImageForCleanup,
  reserveArticleImage, readArticleImageSweepState, advanceArticleImageSweepState, markArticleImagesReferenced,
} from "@/infrastructure/persistence/d1/article-image-repository";
import { runArticleImageReclaim, ARTICLE_IMAGE_ORPHAN_PAGE_LIMIT } from "@/infrastructure/platform/article-image-reclaim";
import type { ArticleImageBucket } from "@/infrastructure/platform/article-image-r2";
import { storageFailure } from "@/infrastructure/persistence/d1/storage-failure";
import { migrationStatements } from "../support/migrations";

type Env = { DB: D1Database; BUCKET: R2Bucket };
let proxy: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
const workspaceId = "ws-image-safety" as WorkspaceId;
const articleId = asArticleId("image-safety-article");
const old = new Date("2020-01-01T00:00:00Z");
const now = () => new Date();
const future = () => new Date(Date.now() + ARTICLE_IMAGE_UPLOAD_GRACE_MS * 2);
const db = () => drizzle(proxy.env.DB, { schema });
const bucket = (): ArticleImageBucket => ({
  put: (key, body, options) => proxy.env.BUCKET.put(key, body, options),
  get: (key) => proxy.env.BUCKET.get(key),
  delete: (key) => proxy.env.BUCKET.delete(key),
  list: (options) => proxy.env.BUCKET.list(options),
});

beforeAll(async () => {
  // persist:falseのD1/R2だけ。既存previewデータ・リモートには触れない。
  proxy = await getPlatformProxy<Env>({ configPath: "wrangler.jsonc", environment: "dev", persist: false });
  for (const statement of migrationStatements()) await proxy.env.DB.prepare(statement).run();
}, 60_000);
afterAll(async () => { await proxy?.dispose(); });
beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM article_image WHERE lifecycle NOT IN ('deleting', 'deleted')").run();
  for (const table of ["article_image_sweep_state", "published_articles", "blog_article_block", "articles", "site_network_node", "site_blueprints"]) {
    await proxy.env.DB.prepare(`DELETE FROM ${table}`).run();
  }
  // 全てこのテストが作った隔離bucket内のfixture。墓標はD1に残す。
  for (const object of (await proxy.env.BUCKET.list()).objects) await proxy.env.BUCKET.delete(object.key);
  await db().insert(schema.siteBlueprints).values({ id: "image-site", workspaceId, slug: "image-site", name: "Site", pattern: "A", blueprintJson: "{}" });
  await db().insert(schema.articles).values({ id: articleId, workspaceId, siteSlug: "image-site", slug: "article", type: "guide", title: "Image", status: "published" });
});

async function fixture(lifecycle: "pending" | "ready" = "ready") {
  const id = crypto.randomUUID();
  const objectKey = articleImageKey(workspaceId, articleId, id, "png");
  await db().insert(schema.articleImages).values({ id, workspaceId, articleId, objectKey, mimeType: "image/png", byteSize: 3, lifecycle, createdAt: old });
  return { id, objectKey, href: articleImageHref(id) };
}
async function record(image: { objectKey: string }) {
  return (await findArticleImageForCleanup(db(), workspaceId, image.objectKey))!;
}
async function block(body: string, id = crypto.randomUUID()) {
  await db().insert(schema.blogArticleBlocks).values({ id, workspaceId, articleId, kind: "summary-section", body });
  return id;
}
async function publication(body: string, archivedAt: string | null = null) {
  await db().insert(schema.publishedArticles).values({
    workspaceId, siteSlug: "image-site", slug: crypto.randomUUID(), sourceArticleId: null,
    type: "guide", title: "Image", summary: "Image", categorySlug: "guide", authorSlug: "writer", authorName: "Writer",
    publishedAt: "2026-09-06", updatedAt: "2026-09-06", articleJson: body, archivedAt,
  });
}
function latch() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("画像の不可逆claimと保存の競合（実D1/R2）", () => {
  it("pendingは非公開で、R2保存後のfinalizeだけがreadyへ移せる", async () => {
    const id = crypto.randomUUID();
    const objectKey = articleImageKey(workspaceId, articleId, id, "png");
    await reserveArticleImage(db(), { id, workspaceId, articleId, objectKey, mimeType: "image/png", byteSize: 3 });
    expect(await findArticleImage(db(), id)).toBeNull();
    await expect(block(articleImageHref(id))).rejects.toThrow();
    await proxy.env.BUCKET.put(objectKey, "png");
    expect(await finalizeArticleImage(db(), workspaceId, id)).toBe(true);
    expect((await findArticleImage(db(), id))?.lifecycle).toBe("ready");
  });

  it("先に保存された別記事/復元JSONの参照をclaimが保護し、JSON escapeも復号する", async () => {
    const image = await fixture();
    await proxy.env.BUCKET.put(image.objectKey, "png");
    const staleSnapshot = await record(image);
    // UUID全体をUnicode escapeへ変え、raw substringだけでは見つからなくする。
    const encodedId = [...image.id].map((letter) => `\\u${letter.charCodeAt(0).toString(16).padStart(4, "0")}`).join("");
    await publication(`{"src":"/api/article-images/${encodedId}"}`, "2026-09-06");
    expect(await claimArticleImageDeletion(db(), staleSnapshot, future())).toBe(false);
    await runArticleImageReclaim(proxy.env.DB, bucket(), future());
    expect(await proxy.env.BUCKET.get(image.objectKey)).not.toBeNull();
  });

  it("claim後のINSERT/UPDATEを拒否し、二重cronと遅延delete後にも再利用できない", async () => {
    const image = await fixture();
    await proxy.env.BUCKET.put(image.objectKey, "png");
    const existingBlock = await block("元の本文");
    await publication('{"src":""}');
    const started = latch();
    const release = latch();
    const first = runArticleImageReclaim(proxy.env.DB, {
      ...bucket(), delete: async (key) => { started.resolve(); await release.promise; await proxy.env.BUCKET.delete(key); },
    }, now());
    await started.promise;
    try {
      expect((await record(image)).lifecycle).toBe("deleting");
      let rejection: unknown;
      try { await block(image.href); } catch (cause) { rejection = cause; }
      expect(rejection).toBeDefined();
      const mapped = storageFailure("画像付き記事の保存", rejection);
      const leaf = (rejection as { cause?: { cause?: unknown; message?: string } }).cause;
      expect(mapped, String(leaf?.cause ?? leaf?.message)).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED", field: "blocks", retryable: false } });
      await expect(proxy.env.DB.prepare("UPDATE blog_article_block SET body = ? WHERE id = ?").bind(image.href, existingBlock).run()).rejects.toThrow();
      await expect(publication(JSON.stringify({ src: image.href }))).rejects.toThrow();
      await expect(proxy.env.DB.prepare("UPDATE published_articles SET article_json = ?").bind(JSON.stringify({ src: image.href })).run()).rejects.toThrow();
      // 2人目は同じ永久claimを使い、安全に削除/完了を再試行できる。
      await runArticleImageReclaim(proxy.env.DB, bucket(), future());
      expect((await record(image)).lifecycle).toBe("deleted");
      expect(await finalizeArticleImage(db(), workspaceId, image.id)).toBe(false);
      await expect(proxy.env.DB.prepare("UPDATE article_image SET lifecycle = 'ready' WHERE id = ?").bind(image.id).run()).rejects.toThrow();
      await expect(proxy.env.DB.prepare("DELETE FROM article_image WHERE id = ?").bind(image.id).run()).rejects.toThrow();
      await expect(proxy.env.DB.prepare("UPDATE article_image SET object_key = 'article-images/reused.png' WHERE id = ?").bind(image.id).run()).rejects.toThrow();
    } finally { release.resolve(); }
    await first;
    await expect(block(image.href)).rejects.toThrow();
    expect(await proxy.env.BUCKET.get(image.objectKey)).toBeNull();
  }, 60_000);

  it("R2削除失敗でもclaimを解除せず、次回安全に再試行する", async () => {
    const image = await fixture();
    await proxy.env.BUCKET.put(image.objectKey, "png");
    await runArticleImageReclaim(proxy.env.DB, { ...bucket(), delete: async () => { throw new Error("R2 unavailable"); } }, now());
    expect((await record(image)).lifecycle).toBe("deleting");
    await expect(block(image.href)).rejects.toThrow();
    await runArticleImageReclaim(proxy.env.DB, bucket(), now());
    expect((await record(image)).lifecycle).toBe("deleted");
    expect(await proxy.env.BUCKET.get(image.objectKey)).toBeNull();
  });

  it("R2削除後のD1完了記録に失敗してもdeletingを保持して再試行する", async () => {
    const image = await fixture();
    await proxy.env.BUCKET.put(image.objectKey, "png");
    await proxy.env.DB.prepare("CREATE TRIGGER test_image_complete_failure BEFORE UPDATE OF lifecycle ON article_image WHEN NEW.lifecycle = 'deleted' BEGIN SELECT RAISE(ABORT, 'test_completion_failed'); END").run();
    try {
      await runArticleImageReclaim(proxy.env.DB, bucket(), now());
      expect((await record(image)).lifecycle).toBe("deleting");
      expect(await proxy.env.BUCKET.get(image.objectKey)).toBeNull();
    } finally { await proxy.env.DB.prepare("DROP TRIGGER test_image_complete_failure").run(); }
    await runArticleImageReclaim(proxy.env.DB, bucket(), now());
    expect((await record(image)).lifecycle).toBe("deleted");
  });

  it("最後の参照を外した直後は、古い画像でも30日の復元猶予が始まる", async () => {
    const image = await fixture();
    const id = await block(image.href);
    await proxy.env.DB.prepare("UPDATE article_image SET last_referenced_at = 1 WHERE id = ?").bind(image.id).run();
    await proxy.env.DB.prepare("DELETE FROM blog_article_block WHERE id = ?").bind(id).run();
    expect(await claimArticleImageDeletion(db(), await record(image), future())).toBe(false);
  });

  it("古い点検結果で参照時刻を巻き戻さず、猶予を短縮しない", async () => {
    const image = await fixture();
    const latest = future();
    await markArticleImagesReferenced(db(), workspaceId, [image.id], latest);
    await markArticleImagesReferenced(db(), workspaceId, [image.id], old);
    await block(image.href);
    expect((await record(image)).lastReferencedAt?.getTime()).toBe(Math.floor(latest.getTime() / 1000) * 1000);
  });
});

describe("R2孤児の公平な回収（実D1/R2）", () => {
  it("古いcronの完了通知でcursorを巻き戻さない", async () => {
    const initial = await readArticleImageSweepState(db());
    await advanceArticleImageSweepState(db(), initial.version, "new-cursor");
    await advanceArticleImageSweepState(db(), initial.version, "stale-cursor");
    expect(await readArticleImageSweepState(db())).toMatchObject({ cursor: "new-cursor", version: initial.version + 1 });
  });
  it("pendingの回収完了後に遅延putが戻っても、deleted行あり孤児を次回消す", async () => {
    const image = await fixture("pending");
    await runArticleImageReclaim(proxy.env.DB, bucket(), now());
    expect((await record(image)).lifecycle).toBe("deleted");
    // putがここで遅れて完了し、呼出元がfinalize前に落ちたケース。
    await proxy.env.BUCKET.put(image.objectKey, "late png");
    expect(await finalizeArticleImage(db(), workspaceId, image.id)).toBe(false);
    const result = await runArticleImageReclaim(proxy.env.DB, bucket(), now());
    expect(result.orphanReclaimed).toBeGreaterThan(0);
    expect(await proxy.env.BUCKET.get(image.objectKey)).toBeNull();
  });

  it("R2がlimit未満のページを返してもcursorで進み、削除失敗した先頭の後ろも回収する", async () => {
    const keys = Array.from({ length: 3 }, () => articleImageKey(workspaceId, articleId, crypto.randomUUID(), "png")).sort();
    for (const key of keys) await proxy.env.BUCKET.put(key, "png");
    const pages: (string | undefined)[] = [];
    const limited = {
      ...bucket(),
      list: async (options: Parameters<ArticleImageBucket["list"]>[0]) => {
        expect(options.prefix).toBe("article-images/");
        expect(options.limit).toBe(ARTICLE_IMAGE_ORPHAN_PAGE_LIMIT);
        pages.push(options.cursor);
        return proxy.env.BUCKET.list({ ...options, limit: 2 });
      },
      delete: async (key: string) => {
        if (key === keys[0]) throw new Error("one object temporarily unavailable");
        await proxy.env.BUCKET.delete(key);
      },
    };
    await runArticleImageReclaim(proxy.env.DB, limited, future());
    expect((await readArticleImageSweepState(db())).cursor).not.toBeNull();
    await runArticleImageReclaim(proxy.env.DB, limited, future());
    expect(pages[1]).toBeTruthy();
    expect(await proxy.env.BUCKET.get(keys[2])).toBeNull();
    expect(await proxy.env.BUCKET.get(keys[0])).not.toBeNull();
    await runArticleImageReclaim(proxy.env.DB, bucket(), future());
    expect(await proxy.env.BUCKET.get(keys[0])).toBeNull();
  }, 60_000);

  it("新しい孤児・不正階層・保存prefix外・壊れた台帳キーは削除しない", async () => {
    const young = articleImageKey(workspaceId, articleId, crypto.randomUUID(), "png");
    const malformed = "article-images/../private.png";
    const other = "feedback-captures/private.png";
    for (const key of [young, malformed, other]) await proxy.env.BUCKET.put(key, "png");
    const image = await fixture();
    // identityを変えず、最初から不正な保存先を持つ旧行をfixtureにする。
    await db().insert(schema.articleImages).values({ id: crypto.randomUUID(), workspaceId, articleId, objectKey: other, mimeType: "image/png", byteSize: 3, createdAt: old });
    await runArticleImageReclaim(proxy.env.DB, bucket(), now());
    for (const key of [young, malformed, other]) expect(await proxy.env.BUCKET.get(key)).not.toBeNull();
    expect(await findArticleImage(db(), image.id)).toBeNull();
  });
});
