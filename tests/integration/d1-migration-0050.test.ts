/** @tier 2 @req REQ-SEO08 @types db-migration, db-constraint, tenant-isolation */
import { basename } from "node:path";
import { describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import { migrationFiles, statementsOf } from "../support/migrations";

const migration = "0050_persistent_publication_revisions.sql";

describe("0050 公開版の永続化", () => {
  it("既存の本文と版をそのまま引き継ぎ、更新・再公開・非表示でも版を戻さない", async () => {
    const proxy = await getPlatformProxy<{ DB: D1Database }>({ configPath: "wrangler.jsonc", environment: "dev", persist: false });
    const db = proxy.env.DB;
    try {
      for (const file of migrationFiles()) {
        if (basename(file) >= migration) break;
        for (const statement of statementsOf(basename(file))) await db.prepare(statement).run();
      }
      for (const [workspace, site, revision] of [["owner", "site", 7], ["other", "other-site", 3]] as const) {
        await db.prepare("INSERT INTO site_blueprints (id,workspace_id,slug,name,pattern,blueprint_json) VALUES (?,?,?,?, 'specialist','{}')").bind(site, workspace, site, site).run();
        await db.prepare("INSERT INTO published_articles (workspace_id,site_slug,slug,type,title,summary,category_slug,author_slug,author_name,published_at,updated_at,article_json,revision) VALUES (?,?,'article','guide','元の題名','元の概要','basics','writer','筆者','2026-09-01','2026-09-01','{}',?)").bind(workspace, site, revision).run();
      }
      const before = (await db.prepare("SELECT * FROM published_articles ORDER BY site_slug").all()).results;
      for (const statement of statementsOf(migration)) await db.prepare(statement).run();
      expect((await db.prepare("SELECT * FROM published_articles ORDER BY site_slug").all()).results).toEqual(before);
      expect((await db.prepare("SELECT workspace_id,revision FROM published_article_revision_counter ORDER BY workspace_id").all()).results).toEqual([{ workspace_id: "other", revision: 3 }, { workspace_id: "owner", revision: 7 }]);
      await db.prepare("UPDATE published_articles SET title='更新後' WHERE workspace_id='owner'").run();
      expect(await db.prepare("SELECT revision FROM published_articles WHERE workspace_id='owner'").first()).toEqual({ revision: 8 });
      await db.prepare("DELETE FROM published_articles WHERE workspace_id='owner'").run();
      await db.prepare("INSERT INTO published_articles (workspace_id,site_slug,slug,type,title,summary,category_slug,author_slug,author_name,published_at,updated_at,article_json) VALUES ('owner','site','article','guide','再公開','概要','basics','writer','筆者','2026-09-02','2026-09-02','{}')").run();
      expect(await db.prepare("SELECT revision FROM published_articles WHERE workspace_id='owner'").first()).toEqual({ revision: 9 });
      await db.prepare("UPDATE published_articles SET archived_at='2026-09-03' WHERE workspace_id='owner'").run();
      expect(await db.prepare("SELECT revision FROM published_articles WHERE workspace_id='owner'").first()).toEqual({ revision: 10 });
      expect(await db.prepare("SELECT revision FROM published_article_revision_counter WHERE workspace_id='other'").first()).toEqual({ revision: 3 });
    } finally { await proxy.dispose(); }
  }, 60_000);
});
