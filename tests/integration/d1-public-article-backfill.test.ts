/**
 * @tier 2
 * @req REQ-BOPS11
 * @types db-migration, db-concurrency, idempotency, tenant-isolation
 *
 * `articles` から canonical public projection への forward backfill。
 * 公開側の既存値・墓標・archive・tenant 境界を推測で上書きしない。
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import type { WorkspaceId } from "@/domain/shared";
import { createD1BlogOpsRepository } from "@/infrastructure/persistence/d1/blog-ops-repository";

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

let proxy: Proxy;
const OWNER = "ws_backfill_owner";
const OUTSIDER = "ws_backfill_outsider";
const SITE = "backfill-site";
const DRIZZLE_DIR = path.resolve(process.cwd(), "drizzle");

function statements(file: string): readonly string[] {
  return readFileSync(file, "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement !== "");
}

async function openBeforeCanonical(): Promise<Proxy> {
  const target = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  const beforeCanonical = readdirSync(DRIZZLE_DIR)
    .filter((file) => file.endsWith(".sql") && file < "0042_")
    .sort();
  for (const file of beforeCanonical) {
    for (const statement of statements(path.join(DRIZZLE_DIR, file))) {
      await target.env.DB.prepare(statement).run();
    }
  }
  return target;
}

async function applyCanonical(target: Proxy): Promise<void> {
  for (const statement of statements(path.join(DRIZZLE_DIR, "0043_canonical_public_articles.sql"))) {
    await target.env.DB.prepare(statement).run();
  }
}

beforeAll(async () => {
  proxy = await openBeforeCanonical();

  await proxy.env.DB.prepare(
    `INSERT INTO site_blueprints
      (id, workspace_id, slug, name, pattern, blueprint_json)
     VALUES ('sb_backfill', ?, ?, '移行サイト', 'specialist_review', '{}')`,
  )
    .bind(OWNER, SITE)
    .run();
  await proxy.env.DB.prepare(
    "INSERT INTO categories (id, slug, name) VALUES ('cat_backfill', 'guide', 'ガイド')",
  ).run();

  const insertArticle = async (input: {
    id: string;
    slug: string;
    workspace?: string;
    status?: string;
    deleted?: boolean;
    title?: string;
  }) => {
    await proxy.env.DB.prepare(
      `INSERT INTO articles
        (id, workspace_id, site_slug, slug, article_template, type, title, summary, lead,
         status, category_id, author_name, published_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, 'T3', 'guide', ?, ?, ?, ?, 'cat_backfill', '移行著者',
         unixepoch('2026-08-31'), unixepoch('2026-09-01'), ?)`,
    )
      .bind(
        input.id,
        input.workspace ?? OWNER,
        SITE,
        input.slug,
        input.title ?? input.slug,
        `${input.slug}の要約`,
        `${input.slug}の導入`,
        input.status ?? "published",
        input.deleted ? Math.floor(new Date("2026-09-01T01:00:00Z").getTime() / 1000) : null,
      )
      .run();
  };

  await insertArticle({ id: "article_only", slug: "article-only", title: "編集側のみ" });
  await proxy.env.DB.prepare(
    `INSERT INTO blog_article_block
      (id, workspace_id, article_id, kind, heading, body, position)
     VALUES ('block_only', ?, 'article_only', 'summary-section', '引き継いだ見出し', '失わない本文', 0)`,
  )
    .bind(OWNER)
    .run();
  await insertArticle({ id: "article_conflict", slug: "both-conflict", title: "編集側の異なる題名" });
  await insertArticle({ id: "article_tombstone", slug: "tombstoned" });
  await insertArticle({ id: "article_archived", slug: "archived", status: "archived" });
  await insertArticle({ id: "article_deleted", slug: "deleted", deleted: true });
  await proxy.env.DB.prepare(
    "UPDATE articles SET author_name = '', category_id = NULL WHERE id = 'article_deleted'",
  ).run();
  await insertArticle({ id: "article_legacy_empty", slug: "legacy-empty" });
  await proxy.env.DB.prepare(
    "UPDATE articles SET author_name = '', category_id = NULL WHERE id = 'article_legacy_empty'",
  ).run();

  const existing = {
    slug: "both-conflict",
    siteSlug: SITE,
    type: "guide",
    title: "既存公開projectionが勝つ",
    summary: "既存要約",
    categorySlug: "guide",
    publishedAt: "2026-08-20",
    updatedAt: "2026-08-20",
    author: { slug: "existing", name: "既存著者", bio: "", credentials: [] },
    disclosureRequired: false,
    sections: [{ id: "existing", heading: "既存本文", paragraphs: ["上書き禁止"] }],
  };
  await proxy.env.DB.prepare(
    `INSERT INTO published_articles
      (site_slug, slug, workspace_id, type, title, summary, category_slug, author_slug,
       author_name, published_at, updated_at, article_json)
     VALUES (?, ?, ?, 'guide', ?, ?, 'guide', 'existing', '既存著者', '2026-08-20', '2026-08-20', ?)`,
  )
    .bind(SITE, existing.slug, OWNER, existing.title, existing.summary, JSON.stringify(existing))
    .run();
  await proxy.env.DB.prepare(
    `INSERT INTO published_article_tombstones
      (site_slug, slug, workspace_id, unpublished_at)
     VALUES (?, 'tombstoned', ?, unixepoch())`,
  )
    .bind(SITE, OWNER)
    .run();

  await applyCanonical(proxy);
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

describe("canonical public article forward backfill", () => {
  it("編集側のみの公開記事は由来と本文を保ってprojection化する", async () => {
    const row = await proxy.env.DB.prepare(
      `SELECT source_article_id AS sourceArticleId, article_json AS articleJson
       FROM published_articles WHERE site_slug = ? AND slug = 'article-only'`,
    )
      .bind(SITE)
      .first<{ sourceArticleId: string; articleJson: string }>();
    expect(row?.sourceArticleId).toBe("article_only");
    const article = JSON.parse(row?.articleJson ?? "{}") as {
      categorySlug?: string;
      sections?: readonly { heading: string; paragraphs: readonly string[] }[];
    };
    expect(article.categorySlug).toBe("guide");
    expect(article.sections).toEqual([
      { id: "block_only", heading: "引き継いだ見出し", paragraphs: ["失わない本文"] },
    ]);
  });

  it("旧公開記事の空カテゴリ・空署名は虚偽名でなく明示sentinelへ移す", async () => {
    const row = await proxy.env.DB.prepare(
      `SELECT category_slug AS categorySlug, author_slug AS authorSlug,
          author_name AS authorName, article_json AS articleJson
       FROM published_articles WHERE site_slug = ? AND slug = 'legacy-empty'`,
    )
      .bind(SITE)
      .first<{
        categorySlug: string;
        authorSlug: string;
        authorName: string;
        articleJson: string;
      }>();
    expect(row).toMatchObject({
      categorySlug: "uncategorized",
      authorSlug: "unknown-author",
      authorName: "著者未設定",
    });
    expect(JSON.parse(row?.articleJson ?? "{}")).toMatchObject({
      categorySlug: "uncategorized",
      author: { slug: "unknown-author", name: "著者未設定" },
    });
  });

  it("既存projection・墓標・archive・削除・tenant不一致を優先する", async () => {
    const rows = await proxy.env.DB.prepare(
      `SELECT slug, title, source_article_id AS sourceArticleId
       FROM published_articles WHERE site_slug = ? ORDER BY slug`,
    )
      .bind(SITE)
      .all<{ slug: string; title: string; sourceArticleId: string | null }>();
    expect(rows.results).toEqual([
      { slug: "article-only", title: "編集側のみ", sourceArticleId: "article_only" },
      {
        slug: "both-conflict",
        title: "既存公開projectionが勝つ",
        sourceArticleId: "article_conflict",
      },
      {
        slug: "legacy-empty",
        title: "legacy-empty",
        sourceArticleId: "article_legacy_empty",
      },
    ]);
  });

  it("既存projectionは本文を保ったまま由来だけを結び付ける", async () => {
    const row = await proxy.env.DB.prepare(
      `SELECT source_article_id AS sourceArticleId, article_json AS articleJson
       FROM published_articles WHERE site_slug = ? AND slug = 'both-conflict'`,
    )
      .bind(SITE)
      .first<{ sourceArticleId: string; articleJson: string }>();
    expect(row?.sourceArticleId).toBe("article_conflict");
    const article = JSON.parse(row?.articleJson ?? "{}") as {
      title?: string;
      sections?: readonly { paragraphs: readonly string[] }[];
    };
    expect(article.title).toBe("既存公開projectionが勝つ");
    expect(article.sections?.[0]?.paragraphs).toEqual(["上書き禁止"]);
  });

  it("backfill UPDATE/INSERT を再実行しても公開行を増減・上書きしない", async () => {
    const file = path.resolve(process.cwd(), "drizzle/0043_canonical_public_articles.sql");
    const dataStatements = statements(file).filter(
      (statement) =>
        statement.includes("UPDATE `articles`") ||
        statement.includes("INSERT INTO `published_article_tombstones`") ||
        statement.includes("UPDATE published_articles") ||
        statement.includes("INSERT INTO `published_articles`"),
    );
    expect(dataStatements).toHaveLength(4);
    for (const statement of [...dataStatements, ...dataStatements]) {
      await proxy.env.DB.prepare(statement).run();
    }
    const rows = await proxy.env.DB.prepare(
      "SELECT slug, title FROM published_articles WHERE site_slug = ? ORDER BY slug",
    )
      .bind(SITE)
      .all<{ slug: string; title: string }>();
    expect(rows.results).toEqual([
      { slug: "article-only", title: "編集側のみ" },
      { slug: "both-conflict", title: "既存公開projectionが勝つ" },
      { slug: "legacy-empty", title: "legacy-empty" },
    ]);
  });

  it("由来のあるprojectionを残したまま編集aggregateを物理削除できない", async () => {
    await expect(
      proxy.env.DB.prepare("DELETE FROM articles WHERE id = 'article_only'").run(),
    ).rejects.toThrow();
    const source = await proxy.env.DB.prepare(
      "SELECT source_article_id AS sourceArticleId FROM published_articles WHERE source_article_id = 'article_only'",
    ).first<{ sourceArticleId: string }>();
    expect(source?.sourceArticleId).toBe("article_only");
  });

  it("cross-tenantの公開URL候補は列追加前にmigration全体をfail-fastする", async () => {
    const conflicting = await openBeforeCanonical();
    try {
      await conflicting.env.DB.prepare(
        `INSERT INTO site_blueprints
          (id, workspace_id, slug, name, pattern, blueprint_json)
         VALUES ('sb_guard_owner', ?, ?, '所有者サイト', 'specialist_review', '{}')`,
      )
        .bind(OWNER, SITE)
        .run();
      await conflicting.env.DB.prepare(
        `INSERT INTO articles
          (id, workspace_id, site_slug, slug, article_template, type, title, lead,
           status, author_name, published_at, updated_at)
         VALUES ('article_cross_tenant', ?, ?, 'cross-tenant', 'T3', 'guide',
           '別所有者の記事', '本文', 'published', '別所有者', unixepoch(), unixepoch())`,
      )
        .bind(OUTSIDER, SITE)
        .run();

      await expect(applyCanonical(conflicting)).rejects.toThrow();
      const columns = await conflicting.env.DB.prepare(
        "PRAGMA table_info('published_articles')",
      ).all<{ name: string }>();
      expect(
        columns.results.length,
        "migration前の実テーブル列を読めていなければ、列なしの主張は空振りになる",
      ).toBeGreaterThan(10);
      expect(columns.results.map((column) => column.name)).not.toContain("source_article_id");
      const publicCount = await conflicting.env.DB.prepare(
        "SELECT count(*) AS count FROM published_articles",
      ).first<{ count: number }>();
      expect(publicCount?.count).toBe(0);
    } finally {
      await conflicting.dispose();
    }
  }, 60_000);

  it("公開日時を決定できない行を黙って除外せずmigration全体を止める", async () => {
    const ambiguous = await openBeforeCanonical();
    try {
      await ambiguous.env.DB.prepare(
        `INSERT INTO site_blueprints
          (id, workspace_id, slug, name, pattern, blueprint_json)
         VALUES ('sb_guard_ambiguous', ?, ?, '修復待ちサイト', 'specialist_review', '{}')`,
      )
        .bind(OWNER, SITE)
        .run();
      await ambiguous.env.DB.prepare(
        `INSERT INTO articles
          (id, workspace_id, site_slug, slug, article_template, type, title, lead,
           status, author_name, updated_at)
         VALUES ('article_ambiguous', ?, ?, 'ambiguous', 'T3', 'guide',
           '修復が必要な記事', '本文', 'published', '', unixepoch())`,
      )
        .bind(OWNER, SITE)
        .run();

      await expect(applyCanonical(ambiguous)).rejects.toThrow();
      const columns = await ambiguous.env.DB.prepare(
        "PRAGMA table_info('published_articles')",
      ).all<{ name: string }>();
      expect(columns.results.map((column) => column.name)).not.toContain("source_article_id");
    } finally {
      await ambiguous.dispose();
    }
  }, 60_000);

  it("同じURLの公開行と墓標が共存する破損を墓標優先でfail-fastする", async () => {
    const corrupt = await openBeforeCanonical();
    try {
      await corrupt.env.DB.prepare(
        `INSERT INTO site_blueprints
          (id, workspace_id, slug, name, pattern, blueprint_json)
         VALUES ('sb_guard_corrupt', ?, ?, '破損検査サイト', 'specialist_review', '{}')`,
      )
        .bind(OWNER, SITE)
        .run();
      await corrupt.env.DB.prepare(
        "DROP TRIGGER published_article_tombstones_reject_article_on_insert",
      ).run();
      await corrupt.env.DB.prepare(
        "DROP TRIGGER published_articles_reject_tombstone_on_insert",
      ).run();
      await corrupt.env.DB.prepare(
        `INSERT INTO published_articles
          (site_slug, slug, workspace_id, type, title, summary, category_slug,
           author_slug, author_name, published_at, updated_at, article_json)
         VALUES (?, 'corrupt-url', ?, 'guide', '公開行', '要約', 'guide',
           'author', '著者', '2026-08-31', '2026-09-01', '{}')`,
      )
        .bind(SITE, OWNER)
        .run();
      await corrupt.env.DB.prepare(
        `INSERT INTO published_article_tombstones
          (site_slug, slug, workspace_id, unpublished_at)
         VALUES (?, 'corrupt-url', ?, unixepoch())`,
      )
        .bind(SITE, OWNER)
        .run();

      await expect(applyCanonical(corrupt)).rejects.toThrow();
      const columns = await corrupt.env.DB.prepare(
        "PRAGMA table_info('published_articles')",
      ).all<{ name: string }>();
      expect(columns.results.map((column) => column.name)).not.toContain("source_article_id");
      const occupants = await corrupt.env.DB.prepare(
        `SELECT
          (SELECT count(*) FROM published_articles WHERE site_slug = ? AND slug = 'corrupt-url')
          + (SELECT count(*) FROM published_article_tombstones WHERE site_slug = ? AND slug = 'corrupt-url')
          AS count`,
      )
        .bind(SITE, SITE)
        .first<{ count: number }>();
      expect(occupants?.count).toBe(2);
    } finally {
      await corrupt.dispose();
    }
  }, 60_000);

  it("migration前に削除済みだった公開記事を墓標経由で同じURLへ復元できる", async () => {
    const before = await proxy.env.DB.prepare(
      `SELECT a.public_category_slug AS categorySlug, t.workspace_id AS tombstoneWorkspace
       FROM articles a
       LEFT JOIN published_article_tombstones t
         ON t.site_slug = a.site_slug AND t.slug = a.slug
       WHERE a.id = 'article_deleted'`,
    ).first<{ categorySlug: string; tombstoneWorkspace: string }>();
    expect(before).toEqual({
      categorySlug: "uncategorized",
      tombstoneWorkspace: OWNER,
    });

    const repository = createD1BlogOpsRepository(drizzle(proxy.env.DB, { schema }));
    const restored = await repository.restoreArticle(
      OWNER as WorkspaceId,
      "article_deleted",
      new Date("2026-09-02T00:00:00.000Z"),
    );
    expect(restored.ok).toBe(true);
    const projection = await proxy.env.DB.prepare(
      `SELECT source_article_id AS sourceArticleId, category_slug AS categorySlug,
          author_name AS authorName
       FROM published_articles WHERE site_slug = ? AND slug = 'deleted'`,
    )
      .bind(SITE)
      .first<{ sourceArticleId: string; categorySlug: string; authorName: string }>();
    expect(projection).toEqual({
      sourceArticleId: "article_deleted",
      categorySlug: "uncategorized",
      authorName: "著者未設定",
    });
    const tombstone = await proxy.env.DB.prepare(
      "SELECT slug FROM published_article_tombstones WHERE site_slug = ? AND slug = 'deleted'",
    )
      .bind(SITE)
      .first();
    expect(tombstone).toBeNull();
  });
});
