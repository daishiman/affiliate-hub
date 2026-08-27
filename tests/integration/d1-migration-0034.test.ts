/** @tier 2 @req REQ-S06, REQ-SEC01, REQ-TS07 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPlatformProxy } from "wrangler";
import { drizzle } from "drizzle-orm/d1";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { listPublishedBlueprints } from "@/infrastructure/persistence/d1/site-draft-repository";

type TestEnv = { readonly DB: D1Database };

const MIGRATION = readFileSync(
  resolve(process.cwd(), "drizzle/0034_parched_inhumans.sql"),
  "utf8",
)
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter((statement) => statement !== "");

const LEGACY_KEYS = [
  "operator",
  "all_categories",
  "site_policy",
  "privacy_policy",
  "tokushoho",
  "contact",
] as const;

async function withLegacyDatabase(
  run: (db: D1Database) => Promise<void>,
): Promise<void> {
  const proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  try {
    await proxy.env.DB.prepare(
      `CREATE TABLE site_blueprints (
        id text PRIMARY KEY NOT NULL,
        workspace_id text NOT NULL,
        slug text NOT NULL,
        name text NOT NULL,
        pattern text NOT NULL,
        published_at integer NOT NULL,
        blueprint_json text NOT NULL
      )`,
    ).run();
    await proxy.env.DB.prepare(
      "CREATE UNIQUE INDEX site_blueprints_slug_idx ON site_blueprints (slug)",
    ).run();
    // 0034より前の0011で存在する表。0034は墓標との相互排他triggerを追加するため、
    // 単独migration試験でも実際の適用順と同じ前提を用意する。
    await proxy.env.DB.prepare(
      `CREATE TABLE published_articles (
        site_slug text NOT NULL,
        slug text NOT NULL,
        workspace_id text NOT NULL,
        PRIMARY KEY (site_slug, slug)
      )`,
    ).run();
    await proxy.env.DB.prepare(
      `INSERT INTO site_blueprints
        (id, workspace_id, slug, name, pattern, published_at, blueprint_json)
       VALUES ('sb_owner', 'ws_owner', 'owned-site', '所有サイト', 'specialist_review', 1, '{}')`,
    ).run();
    await proxy.env.DB.prepare(
      `CREATE TABLE legal_page (
        id text PRIMARY KEY NOT NULL,
        site_slug text NOT NULL,
        kind text NOT NULL,
        title text NOT NULL,
        body text NOT NULL,
        updated_at integer NOT NULL
      )`,
    ).run();
    await run(proxy.env.DB);
  } finally {
    await proxy.dispose();
  }
}

async function insertLegacy(db: D1Database, kinds: readonly string[]): Promise<void> {
  for (const [index, kind] of kinds.entries()) {
    await db
      .prepare(
        `INSERT INTO legal_page (id, site_slug, kind, title, body, updated_at)
         VALUES (?, 'owned-site', ?, ?, ?, ?)`,
      )
      .bind(`lp_${index}`, kind, `${kind} title`, `${kind} body`, index + 1)
      .run();
  }
}

async function applyMigration(db: D1Database): Promise<void> {
  for (const statement of MIGRATION) await db.prepare(statement).run();
}

async function expectMigrationWorkspaceRemoved(db: D1Database): Promise<void> {
  const source = await db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name = '_migration_0034_legal_page_source'`,
    )
    .first<{ name: string }>();
  expect(source).toBeNull();
}

describe("0034 legal_page の意味を保つ移行", () => {
  it("意味が一意な旧keyは、新しい読者ルートのkeyへ変換して本文を保つ", async () => {
    await withLegacyDatabase(async (db) => {
      await insertLegacy(db, ["operator", "privacy_policy", "tokushoho"]);
      await applyMigration(db);

      const rows = await db
        .prepare(
          `SELECT workspace_id as workspaceId, kind, title, body
           FROM legal_page ORDER BY kind`,
        )
        .all<{ workspaceId: string; kind: string; title: string; body: string }>();
      expect(rows.results).toEqual([
        {
          workspaceId: "ws_owner",
          kind: "operator",
          title: "operator title",
          body: "operator body",
        },
        {
          workspaceId: "ws_owner",
          kind: "privacy",
          title: "privacy_policy title",
          body: "privacy_policy body",
        },
        {
          workspaceId: "ws_owner",
          kind: "tokushoho",
          title: "tokushoho title",
          body: "tokushoho body",
        },
      ]);
      await expectMigrationWorkspaceRemoved(db);
    });
  });

  it("意味を一意に決められない旧keyは、別ページへ推測変換せず旧表を残して停止する", async () => {
    await withLegacyDatabase(async (db) => {
      const ambiguous = ["all_categories", "site_policy", "contact"] as const;
      expect(LEGACY_KEYS).toEqual([
        "operator",
        ...ambiguous.slice(0, 2),
        "privacy_policy",
        "tokushoho",
        ambiguous[2],
      ]);
      await insertLegacy(db, ambiguous);

      await expect(applyMigration(db)).rejects.toThrow();

      const columns = await db.prepare("PRAGMA table_info(legal_page)").all<{ name: string }>();
      expect(columns.results.map((column) => column.name)).not.toContain("workspace_id");
      const blueprintColumns = await db
        .prepare("PRAGMA table_info(site_blueprints)")
        .all<{ name: string }>();
      expect(blueprintColumns.results.map((column) => column.name)).not.toContain("retired_at");
      const rows = await db.prepare("SELECT kind FROM legal_page ORDER BY kind").all<{ kind: string }>();
      expect(rows.results.map((row) => row.kind)).toEqual([
        "all_categories",
        "contact",
        "site_policy",
      ]);
    });
  });

  it("旧keyと新keyが同じ移行先へ衝突すると、片方を捨てず旧表を残して停止する", async () => {
    await withLegacyDatabase(async (db) => {
      await insertLegacy(db, ["privacy_policy", "privacy"]);

      await expect(applyMigration(db)).rejects.toThrow();

      const rows = await db.prepare("SELECT kind FROM legal_page ORDER BY kind").all<{ kind: string }>();
      expect(rows.results.map((row) => row.kind)).toEqual(["privacy", "privacy_policy"]);
    });
  });

  it("fail-closed停止後に旧データを解決すれば、同じmigrationを再実行できる", async () => {
    await withLegacyDatabase(async (db) => {
      await insertLegacy(db, ["site_policy"]);
      await expect(applyMigration(db)).rejects.toThrow();

      await db.prepare("DELETE FROM legal_page").run();
      await insertLegacy(db, ["operator"]);
      await expect(applyMigration(db)).resolves.toBeUndefined();

      const rows = await db.prepare("SELECT kind, body FROM legal_page").all<{
        kind: string;
        body: string;
      }>();
      expect(rows.results).toEqual([{ kind: "operator", body: "operator body" }]);
    });
  });

  it("公開記事の所有不一致と公開行・墓標の共存はfail-closedし、解消後に再実行できる", async () => {
    await withLegacyDatabase(async (db) => {
      await db.prepare(
        `INSERT INTO published_articles (site_slug, slug, workspace_id)
         VALUES ('owned-site', 'guarded-article', 'ws_intruder')`,
      ).run();

      await expect(applyMigration(db)).rejects.toThrow();

      await db.prepare(
        `UPDATE published_articles SET workspace_id = 'ws_owner'
         WHERE site_slug = 'owned-site' AND slug = 'guarded-article'`,
      ).run();
      await db.prepare(
        `INSERT INTO published_article_tombstones
          (site_slug, slug, workspace_id, unpublished_at)
         VALUES ('owned-site', 'guarded-article', 'ws_owner', 1)`,
      ).run();

      await expect(applyMigration(db)).rejects.toThrow();

      await db.prepare(
        `DELETE FROM published_article_tombstones
         WHERE site_slug = 'owned-site' AND slug = 'guarded-article'`,
      ).run();
      await expect(applyMigration(db)).resolves.toBeUndefined();
    });
  });

  it("各DDLの直後で停止しても、同じmigrationの再実行で本文・所有権・旧取り下げ日時を復元する", async () => {
    for (const hasLegacyRetiredAt of [false, true]) {
      for (let cut = 0; cut <= MIGRATION.length; cut += 1) {
        await withLegacyDatabase(async (db) => {
          await insertLegacy(db, ["operator", "privacy_policy", "tokushoho"]);
          if (hasLegacyRetiredAt) {
            await db.prepare("ALTER TABLE site_blueprints ADD retired_at integer").run();
            await db
              .prepare("UPDATE site_blueprints SET retired_at = 123 WHERE slug = 'owned-site'")
              .run();
          }
          for (const statement of MIGRATION.slice(0, cut)) {
            await db.prepare(statement).run();
          }

          const scenario = `retired_at=${hasLegacyRetiredAt}, cut point ${cut}`;
          await expect(applyMigration(db), scenario).resolves.toBeUndefined();

          const rows = await db
            .prepare("SELECT kind, body FROM legal_page ORDER BY kind")
            .all<{ kind: string; body: string }>();
          expect(rows.results, scenario).toEqual([
            { kind: "operator", body: "operator body" },
            { kind: "privacy", body: "privacy_policy body" },
            { kind: "tokushoho", body: "tokushoho body" },
          ]);
          const owner = await db
            .prepare("SELECT workspace_id as workspaceId FROM site_blueprints WHERE slug = 'owned-site'")
            .first<{ workspaceId: string }>();
          expect(owner?.workspaceId, scenario).toBe("ws_owner");

          const retirement = await db
            .prepare("SELECT retired_at as retiredAt FROM site_retirements WHERE slug = 'owned-site'")
            .first<{ retiredAt: number }>();
          expect(retirement?.retiredAt, scenario).toBe(
            hasLegacyRetiredAt ? 123 : undefined,
          );
          await expectMigrationWorkspaceRemoved(db);
        });
      }
    }
  }, 180_000);

  it("旧版0034が既に付けたretired_atも失わず、独立墓標へ互換移行して再露出を防ぐ", async () => {
    await withLegacyDatabase(async (db) => {
      await db.prepare("ALTER TABLE site_blueprints ADD retired_at integer").run();
      await db
        .prepare("UPDATE site_blueprints SET retired_at = 123 WHERE slug = 'owned-site'")
        .run();

      await applyMigration(db);
      const listed = await listPublishedBlueprints(drizzle(db, { schema }));

      expect(listed.published).toEqual([]);
      expect(listed.reservedSlugs.has("owned-site")).toBe(true);
      const preserved = await db
        .prepare("SELECT retired_at as retiredAt FROM site_retirements WHERE slug = 'owned-site'")
        .first<{ retiredAt: number }>();
      expect(preserved?.retiredAt).toBe(123);
      const legacy = await db
        .prepare("SELECT retired_at as retiredAt FROM site_blueprints WHERE slug = 'owned-site'")
        .first<{ retiredAt: number }>();
      expect(legacy?.retiredAt).toBe(123);
      await expectMigrationWorkspaceRemoved(db);
    });
  });
});
