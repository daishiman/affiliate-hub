/** @tier 2 @req REQ-A01, REQ-A04, REQ-A07 @types db-migration, tenant-isolation */
import { getPlatformProxy } from "wrangler";
import { describe, expect, it } from "vitest";
import { statementsOf } from "../support/migrations";

type TestEnv = { readonly DB: D1Database };

const STATEMENTS = statementsOf("0041_blog_appearance_workspace.sql");

const PRE_0041 = [
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

async function withPre0041(run: (db: D1Database) => Promise<void>): Promise<void> {
  const proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  try {
    await apply(proxy.env.DB, PRE_0041);
    await run(proxy.env.DB);
  } finally {
    await proxy.dispose();
  }
}

describe("0040 → 0041 ブログUIデータ境界の移行", () => {
  it("既存themeとpage overrideへsite blueprintのworkspaceをbackfillする", async () => {
    await withPre0041(async (db) => {
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
    await withPre0041(async (db) => {
      await db.prepare("INSERT INTO blog_theme VALUES ('orphan', 'missing', 'trust', 'auto')").run();

      await expect(apply(db, STATEMENTS)).rejects.toThrow(/workspace_backfill/i);
      const columns = await db.prepare("PRAGMA table_info(blog_theme)").all<{ name: string }>();
      expect(columns.results.map(({ name }) => name)).not.toContain("workspace_id");
    });
  });

  it("既存の重複掲載を1件へ整理し自然identityをDB制約にする", async () => {
    await withPre0041(async (db) => {
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

  /*
    旧 0040 が持っていた `legal_page.kind` の語彙移行の検査は、ここには無い。
    `dev` が同じ問題へ別の解を先に出しており（`SITE_DOCUMENT_KIND_BY_KEY` が
    経路の鍵と保管上の名前を対応づける）、**保管されている値を書き換える必要が
    そもそも無くなった**ためである。移行を消したのではなく、移行が要らなくなった。
    語彙の対応そのものは `tests/integration/d1-published-article.test.ts` が見る。
  */
});
