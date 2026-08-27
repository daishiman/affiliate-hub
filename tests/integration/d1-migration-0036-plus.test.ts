/** @tier 2 @req REQ-P08, REQ-TS07 @types db-migration, idempotency */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPlatformProxy } from "wrangler";
import { describe, expect, it } from "vitest";

type TestEnv = { readonly DB: D1Database };

const FILES = [
  "0036_young_thunderbolts.sql",
  "0037_zippy_sprite.sql",
  "0038_absent_blackheart.sql",
  "0039_sudden_luckman.sql",
] as const;

function statements(file: string): readonly string[] {
  return readFileSync(resolve(process.cwd(), "drizzle", file), "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement !== "");
}

const MIGRATIONS = FILES.map((file) => ({ file, statements: statements(file) }));

async function apply(db: D1Database, sql: readonly string[]): Promise<void> {
  for (const statement of sql) await db.prepare(statement).run();
}

async function createPre0036(db: D1Database): Promise<void> {
  await apply(db, [
    `CREATE TABLE publications (
      id text PRIMARY KEY NOT NULL, workspace_id text NOT NULL, variant_id text NOT NULL,
      kind text NOT NULL, connection_id text, state text NOT NULL, scheduled_at integer,
      idempotency_key text NOT NULL, attempts integer DEFAULT 0 NOT NULL, external_id text,
      external_url text, last_error text, published_at integer
    )`,
    "CREATE INDEX publications_workspace_variant_idx ON publications (workspace_id, variant_id)",
    "CREATE UNIQUE INDEX publications_workspace_idempotency_idx ON publications (workspace_id, idempotency_key)",
    "CREATE INDEX publications_state_scheduled_idx ON publications (state, scheduled_at)",
    `CREATE TABLE content_variants (
      id text PRIMARY KEY NOT NULL, workspace_id text NOT NULL, content_package_id text NOT NULL,
      channel text NOT NULL, format text NOT NULL, author_persona_id text NOT NULL,
      audience_persona_id text NOT NULL, angle text NOT NULL, title text, body text NOT NULL,
      summary text NOT NULL, cta text NOT NULL, disclosure text NOT NULL,
      affiliate_link_ids text NOT NULL, claim_ids text NOT NULL, evidence_ids text NOT NULL,
      assumptions text NOT NULL, platform_warnings text NOT NULL, factuality_score real NOT NULL,
      persona_fit_score real NOT NULL, channel_fit_score real NOT NULL,
      compliance_status text NOT NULL, generation_prompt_version text NOT NULL,
      model_id text NOT NULL, status text NOT NULL, state text NOT NULL, review_due_at integer
    )`,
    "CREATE INDEX content_variants_workspace_state_idx ON content_variants (workspace_id, state)",
    "CREATE INDEX content_variants_workspace_package_idx ON content_variants (workspace_id, content_package_id)",
    "CREATE INDEX content_variants_review_due_idx ON content_variants (state, review_due_at)",
    `CREATE TABLE channel_connections (
      id text PRIMARY KEY NOT NULL, workspace_id text NOT NULL, kind text NOT NULL,
      account_label text NOT NULL, connected_at integer NOT NULL, expires_at integer,
      revoked_at integer, credential_ref text NOT NULL
    )`,
    "CREATE INDEX channel_connections_workspace_kind_idx ON channel_connections (workspace_id, kind)",
    `CREATE TABLE audit_logs (
      id text PRIMARY KEY NOT NULL, workspace_id text NOT NULL, action text NOT NULL,
      actor_user_id text, actor_is_ai integer NOT NULL, actor_identified integer DEFAULT 1 NOT NULL,
      actor_model_id text, target_type text NOT NULL, target_id text NOT NULL,
      before_json text, after_json text, reason text, request_id text, occurred_at integer NOT NULL
    )`,
    `INSERT INTO publications
      (id, workspace_id, variant_id, kind, connection_id, state, scheduled_at,
       idempotency_key, attempts, last_error)
     VALUES ('pub_retry', 'ws_cut', 'cv_cut', 'bluesky', 'conn_cut',
       'RETRY_SCHEDULED', 2000000000, 'cut-key', 1, NULL)`,
    `INSERT INTO content_variants VALUES (
      'cv_cut', 'ws_cut', 'cp_cut', 'bluesky', 'post', 'author_cut', 'audience_cut',
      'comparison_first', NULL, '本文を保持', '要約', 'view_comparison', '広告',
      '[]', '[]', '[]', '[]', '[]', 1, 1, 1, 'pass', 'v1', 'model',
      'approved', 'APPROVED', NULL
    )`,
    `INSERT INTO channel_connections
      (id, workspace_id, kind, account_label, connected_at, credential_ref)
     VALUES ('conn_cut', 'ws_cut', 'bluesky', '@cut.example', 1, 'secret/cut')`,
  ]);
}

async function columnNames(db: D1Database, table: string): Promise<readonly string[]> {
  const result = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  return result.results.map(({ name }) => name);
}

async function expectFinalState(db: D1Database, scenario: string): Promise<void> {
  expect(await columnNames(db, "publications"), scenario).toEqual(
    expect.arrayContaining([
      "retry_at",
      "delivery_lease_until",
      "variant_revision",
      "provider_identity",
      "provider_delivery_key",
      "provider_record_created_at",
      "last_delivery_audit_id",
    ]),
  );
  expect(await columnNames(db, "content_variants"), scenario).toContain("revision");
  expect(await columnNames(db, "channel_connections"), scenario).toContain("provider_identity");
  expect(await columnNames(db, "channel_provider_delivery_leases"), scenario).toContain(
    "lease_token",
  );
  expect(await columnNames(db, "publication_delivery_audit_outbox"), scenario).toContain(
    "workspace_id",
  );

  const publication = await db.prepare(
    `SELECT state, scheduled_at AS scheduledAt, retry_at AS retryAt
     FROM publications WHERE id = 'pub_retry'`,
  ).first<{ state: string; scheduledAt: number; retryAt: number }>();
  expect(publication, scenario).toEqual({
    state: "RETRY_SCHEDULED",
    scheduledAt: 2_000_000_000,
    retryAt: 2_000_000_000,
  });
  const content = await db.prepare(
    "SELECT body, revision FROM content_variants WHERE id = 'cv_cut'",
  ).first<{ body: string; revision: number }>();
  expect(content, scenario).toEqual({ body: "本文を保持", revision: 1 });
  const connection = await db.prepare(
    "SELECT credential_ref AS credentialRef FROM channel_connections WHERE id = 'conn_cut'",
  ).first<{ credentialRef: string }>();
  expect(connection?.credentialRef, scenario).toBe("secret/cut");

  const triggers = await db.prepare(
    `SELECT name FROM sqlite_master
     WHERE type = 'trigger' AND name IN (
       'publications_commit_delivery_audit_outbox',
       'publication_delivery_audit_outbox_verify_delivery'
     ) ORDER BY name`,
  ).all<{ name: string }>();
  expect(triggers.results, scenario).toHaveLength(2);

  const indexes = await db.prepare(
    "PRAGMA index_list(publication_delivery_audit_outbox)",
  ).all<{ name: string }>();
  const hasWorkspaceLeading = await Promise.all(
    indexes.results.map(async ({ name }) => {
      const columns = await db.prepare(`PRAGMA index_info(${name})`).all<{ name: string }>();
      return columns.results[0]?.name === "workspace_id";
    }),
  );
  expect(hasWorkspaceLeading, scenario).toContain(true);
}

describe("0036以降のmigration再開", () => {
  it("D1 remoteのtrigger分割器が誤認する未括弧CASEを含まない", () => {
    for (const file of FILES) {
      const sql = readFileSync(resolve(process.cwd(), "drizzle", file), "utf8");
      expect(sql, file).not.toMatch(/\bSELECT\s+CASE\b/);
    }
  });

  it("各statement直後で停止しても、同じmigrationを再実行して最終schema/dataへ収束する", async () => {
    for (const [migrationIndex, migration] of MIGRATIONS.entries()) {
      for (let cut = 0; cut <= migration.statements.length; cut += 1) {
        const proxy = await getPlatformProxy<TestEnv>({
          configPath: "wrangler.jsonc",
          environment: "dev",
          persist: false,
        });
        const scenario = `${migration.file} cut point ${cut}`;
        try {
          await createPre0036(proxy.env.DB);
          for (const prior of MIGRATIONS.slice(0, migrationIndex)) {
            await apply(proxy.env.DB, prior.statements);
          }
          await apply(proxy.env.DB, migration.statements.slice(0, cut));
          await expect(apply(proxy.env.DB, migration.statements), scenario).resolves.toBeUndefined();
          for (const later of MIGRATIONS.slice(migrationIndex + 1)) {
            await apply(proxy.env.DB, later.statements);
          }
          await expectFinalState(proxy.env.DB, scenario);
        } finally {
          await proxy.dispose();
        }
      }
    }
  }, 180_000);
});
