/** @tier 2 @req REQ-A01, REQ-A04, REQ-A07 @types db-migration, tenant-isolation */
import { getPlatformProxy } from "wrangler";
import { describe, expect, it } from "vitest";
import { statementsOf } from "../support/migrations";

type TestEnv = { readonly DB: D1Database };

const STATEMENTS = statementsOf("0040_serious_madelyne_pryor.sql");

const PRE_0040 = [
  `CREATE TABLE site_blueprints (
    id text PRIMARY KEY NOT NULL, workspace_id text NOT NULL, slug text NOT NULL UNIQUE,
    name text NOT NULL, pattern text NOT NULL, published_at integer NOT NULL,
    blueprint_json text NOT NULL
  )`,
  `CREATE TABLE blog_theme (
    id text PRIMARY KEY NOT NULL, site_slug text NOT NULL UNIQUE,
    brand_theme text NOT NULL, color_mode text DEFAULT 'auto' NOT NULL
  )`,
  `CREATE TABLE page_theme_override (
    id text PRIMARY KEY NOT NULL, site_slug text NOT NULL, page_path text NOT NULL,
    brand_theme text, color_mode text,
    UNIQUE(site_slug, page_path)
  )`,
  `CREATE TABLE blog_affiliate_placement (
    id text PRIMARY KEY NOT NULL, workspace_id text NOT NULL, site_slug text NOT NULL,
    article_slug text NOT NULL, placement text NOT NULL, tracking_code text,
    position integer DEFAULT 0 NOT NULL
  )`,
  `CREATE TABLE blog_template (
    id text PRIMARY KEY NOT NULL, workspace_id text NOT NULL, site_slug text NOT NULL,
    template_id text NOT NULL, updated_at integer NOT NULL, UNIQUE(site_slug)
  )`,
  `CREATE TABLE legal_page (
    id text PRIMARY KEY NOT NULL, workspace_id text DEFAULT '' NOT NULL,
    site_slug text NOT NULL, kind text NOT NULL, title text NOT NULL, body text NOT NULL,
    status text DEFAULT 'draft' NOT NULL, deleted_at integer, updated_at integer NOT NULL,
    UNIQUE(site_slug, kind)
  )`,
  "INSERT INTO site_blueprints VALUES ('bp-a', 'ws-a', 'site-a', 'A', 'p', 1, '{}')",
  "INSERT INTO blog_theme VALUES ('theme-a', 'site-a', 'trust', 'auto')",
  "INSERT INTO page_theme_override VALUES ('over-a', 'site-a', '/privacy', 'trust', 'dark')",
  "INSERT INTO legal_page VALUES ('legal-a', 'ws-a', 'site-a', 'privacy_policy', 'P', 'B', 'published', NULL, 1)",
] as const;

async function apply(db: D1Database, statements: readonly string[]): Promise<void> {
  for (const statement of statements) await db.prepare(statement).run();
}

async function withPre0040(run: (db: D1Database) => Promise<void>): Promise<void> {
  const proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  try {
    await apply(proxy.env.DB, PRE_0040);
    await run(proxy.env.DB);
  } finally {
    await proxy.dispose();
  }
}

describe("0039 → 0040 ブログUIデータ境界の移行", () => {
  it("既存themeとpage overrideへsite blueprintのworkspaceをbackfillする", async () => {
    await withPre0040(async (db) => {
      await apply(db, STATEMENTS);

      const theme = await db
        .prepare("SELECT workspace_id FROM blog_theme WHERE site_slug = 'site-a'")
        .first<{ workspace_id: string }>();
      const override = await db
        .prepare("SELECT workspace_id FROM page_theme_override WHERE site_slug = 'site-a'")
        .first<{ workspace_id: string }>();
      expect(theme?.workspace_id).toBe("ws-a");
      expect(override?.workspace_id).toBe("ws-a");
    });
  });

  it("持ち主を決められない既存行があれば列追加前に明示的に失敗する", async () => {
    await withPre0040(async (db) => {
      await db.prepare("INSERT INTO blog_theme VALUES ('orphan', 'missing', 'trust', 'auto')").run();

      await expect(apply(db, STATEMENTS)).rejects.toThrow(/workspace_backfill/i);
      const columns = await db.prepare("PRAGMA table_info(blog_theme)").all<{ name: string }>();
      expect(columns.results.map(({ name }) => name)).not.toContain("workspace_id");
    });
  });

  it("既存の重複掲載を1件へ整理し自然identityをDB制約にする", async () => {
    await withPre0040(async (db) => {
      await db.prepare(
        `INSERT INTO blog_affiliate_placement VALUES
          ('p1', 'ws-a', 'site-a', 'article-a', 'intro', NULL, 0),
          ('p2', 'ws-a', 'site-a', 'article-a', 'intro', NULL, 2),
          ('p3', 'ws-a', 'site-a', 'article-a', 'intro', 'tc', 1),
          ('p4', 'ws-a', 'site-a', 'article-a', 'intro', 'tc', 3)`,
      ).run();

      await apply(db, STATEMENTS);
      const rows = await db.prepare(
        "SELECT tracking_code, position FROM blog_affiliate_placement ORDER BY tracking_code",
      ).all<{ tracking_code: string | null; position: number }>();
      expect(rows.results).toHaveLength(2);
      await expect(
        db.prepare(
          `INSERT INTO blog_affiliate_placement
            VALUES ('p5', 'ws-a', 'site-a', 'article-a', 'intro', NULL, 9)`,
        ).run(),
      ).rejects.toThrow(/UNIQUE constraint failed/i);
    });
  });

  it("既知の旧固定ページ名をcanonical SiteDocumentKeyへbackfillする", async () => {
    await withPre0040(async (db) => {
      await apply(db, STATEMENTS);
      const row = await db.prepare("SELECT kind FROM legal_page WHERE id = 'legal-a'")
        .first<{ kind: string }>();
      expect(row?.kind).toBe("privacy");
    });
  });

  it("移行先のない旧固定ページは本文を捨てず明示的に停止する", async () => {
    await withPre0040(async (db) => {
      await db.prepare(
        "INSERT INTO legal_page VALUES ('legacy-contact', 'ws-a', 'site-a', 'contact', 'C', 'B', 'published', NULL, 1)",
      ).run();
      await expect(apply(db, STATEMENTS)).rejects.toThrow(/workspace_backfill/i);
      const row = await db.prepare("SELECT kind, body FROM legal_page WHERE id = 'legacy-contact'")
        .first<{ kind: string; body: string }>();
      expect(row).toEqual({ kind: "contact", body: "B" });
    });
  });
});
