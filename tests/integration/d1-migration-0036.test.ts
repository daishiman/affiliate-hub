/** @tier 2 @req REQ-P08, REQ-TS07 @types db-migration, idempotency */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPlatformProxy } from "wrangler";
import { describe, expect, it } from "vitest";

type TestEnv = { readonly DB: D1Database };

const MIGRATION = readFileSync(
  resolve(process.cwd(), "drizzle/0036_young_thunderbolts.sql"),
  "utf8",
)
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter((statement) => statement !== "");

async function withPre0036Database(run: (db: D1Database) => Promise<void>): Promise<void> {
  const proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  try {
    await proxy.env.DB.prepare(
      `CREATE TABLE publications (
        id text PRIMARY KEY NOT NULL,
        workspace_id text NOT NULL,
        variant_id text NOT NULL,
        kind text NOT NULL,
        connection_id text,
        state text NOT NULL,
        scheduled_at integer,
        idempotency_key text NOT NULL,
        attempts integer DEFAULT 0 NOT NULL,
        external_id text,
        external_url text,
        last_error text,
        published_at integer
      )`,
    ).run();
    await run(proxy.env.DB);
  } finally {
    await proxy.dispose();
  }
}

async function apply0036(db: D1Database): Promise<void> {
  for (const statement of MIGRATION) await db.prepare(statement).run();
}

describe("0036 外部配信worker列の移行", () => {
  it("旧retryを到達可能にし、安全に冪等再送できない旧SENDINGを失敗へ戻す", async () => {
    await withPre0036Database(async (db) => {
      const before = Math.floor(Date.now() / 1000);
      await db.prepare(
        `INSERT INTO publications
          (id, workspace_id, variant_id, kind, connection_id, state, scheduled_at,
           idempotency_key, attempts, last_error)
         VALUES
          ('retry_scheduled', 'ws', 'cv', 'bluesky', 'conn', 'RETRY_SCHEDULED', 2000000000, 'retry-1', 1, NULL),
          ('retry_immediate', 'ws', 'cv', 'bluesky', 'conn', 'RETRY_SCHEDULED', NULL, 'retry-2', 2, NULL),
          ('legacy_sending', 'ws', 'cv', 'bluesky', 'conn', 'SENDING', 1999999999, 'sending-1', 1, NULL),
          ('queued', 'ws', 'cv', 'bluesky', 'conn', 'QUEUED', NULL, 'queued-1', 0, NULL)`,
      ).run();

      await apply0036(db);
      const after = Math.floor(Date.now() / 1000);
      const rows = await db.prepare(
        `SELECT id, state, scheduled_at, retry_at, delivery_lease_until,
                provider_delivery_key, last_error
         FROM publications ORDER BY id`,
      ).all<{
        id: string;
        state: string;
        scheduled_at: number | null;
        retry_at: number | null;
        delivery_lease_until: number | null;
        provider_delivery_key: string | null;
        last_error: string | null;
      }>();
      const byId = Object.fromEntries(rows.results.map((row) => [row.id, row]));

      expect(byId.retry_scheduled?.retry_at).toBe(2_000_000_000);
      expect(byId.retry_immediate?.retry_at).toBeGreaterThanOrEqual(before);
      expect(byId.retry_immediate?.retry_at).toBeLessThanOrEqual(after);
      expect(byId.legacy_sending).toMatchObject({
        state: "FAILED_SEND",
        delivery_lease_until: null,
        provider_delivery_key: null,
      });
      expect(byId.legacy_sending?.last_error).toContain("確認して再試行");
      expect(byId.queued).toMatchObject({ state: "QUEUED", retry_at: null });
    });
  });
});
