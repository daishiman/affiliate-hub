/** @tier 2 @req REQ-P08, REQ-TS07 @types db-migration, idempotency */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPlatformProxy } from "wrangler";
import { describe, expect, it } from "vitest";

/**
 * 0035 は**手で書いた 1 本**なので、手で書いた分の責任をここで見る。
 *
 * 2026-08-27 に dev を取り込んだとき、番号の重なった 15 本を schema から
 * 作り直した。生成器は表と列と索引しか書けないので、トリガーと
 * 「既にある行の引き継ぎ」だけが落ちた。それを戻したのが 0035 である。
 *
 * 見るのは 2 つ。
 *   1. 途中で止まっても、もう一度先頭から流せば同じ状態に着く
 *      （D1 remote は 1 文ずつ流れるので、途中で止まる回が必ず来る）
 *   2. 列を足しただけでは救われない**古い行**を、実際に救えている
 *
 * 生成物（0034）を同じ目で見ないのは、生成物が冪等ではないため。
 * `CREATE TABLE`（IF NOT EXISTS 無し）で始まるので 2 度目は必ず落ちる。
 * これは 0025〜0033 も同じで、この repo が生成物に求めていない性質である。
 * **求めていない性質を検査しない**——検査すると、生成し直すたびに赤くなる。
 */

type TestEnv = { readonly DB: D1Database };

const STATEMENTS = readFileSync(
  resolve(process.cwd(), "drizzle/0035_non_generated_boundaries.sql"),
  "utf8",
)
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter((statement) => statement !== "");

/** 0034 まで流れ終わった直後の姿。0035 が触る表だけを起こす。 */
const PRE_0035 = [
  `CREATE TABLE site_blueprints (
    slug text PRIMARY KEY NOT NULL, workspace_id text NOT NULL
  )`,
  `CREATE TABLE published_articles (
    site_slug text NOT NULL, slug text NOT NULL, workspace_id text NOT NULL,
    type text NOT NULL, title text NOT NULL, summary text NOT NULL,
    category_slug text NOT NULL, author_slug text NOT NULL, author_name text NOT NULL,
    published_at text NOT NULL, updated_at text NOT NULL, article_json text NOT NULL,
    PRIMARY KEY (site_slug, slug)
  )`,
  `CREATE TABLE published_article_tombstones (
    site_slug text NOT NULL, slug text NOT NULL, workspace_id text NOT NULL,
    unpublished_at integer DEFAULT (unixepoch()) NOT NULL,
    PRIMARY KEY (site_slug, slug)
  )`,
  `CREATE TABLE channel_connections (
    id text PRIMARY KEY NOT NULL, workspace_id text NOT NULL, kind text NOT NULL,
    account_label text NOT NULL, connected_at integer NOT NULL, expires_at integer,
    revoked_at integer, credential_ref text NOT NULL, provider_identity text
  )`,
  `CREATE TABLE audit_logs (
    id text PRIMARY KEY NOT NULL, workspace_id text NOT NULL, action text NOT NULL,
    actor_user_id text, actor_is_ai integer NOT NULL, actor_identified integer NOT NULL,
    actor_model_id text, target_type text NOT NULL, target_id text NOT NULL,
    before_json text, after_json text, reason text, request_id text,
    occurred_at integer NOT NULL
  )`,
  `CREATE TABLE publication_delivery_audit_outbox (
    id text PRIMARY KEY NOT NULL, workspace_id text NOT NULL, action text NOT NULL,
    actor_user_id text, actor_is_ai integer NOT NULL, actor_identified integer NOT NULL,
    actor_model_id text, target_type text NOT NULL, target_id text NOT NULL,
    before_json text, after_json text, reason text, request_id text,
    occurred_at integer NOT NULL, committed_at integer, delivered_at integer
  )`,
  // 0034 が列を足し終わった姿。古い行は新しい列が NULL のまま残っている。
  `CREATE TABLE publications (
    id text PRIMARY KEY NOT NULL, workspace_id text NOT NULL, variant_id text NOT NULL,
    kind text NOT NULL, connection_id text, state text NOT NULL, scheduled_at integer,
    idempotency_key text NOT NULL, attempts integer DEFAULT 0 NOT NULL, external_id text,
    external_url text, last_error text, published_at integer,
    variant_revision integer, retry_at integer, delivery_lease_until integer,
    provider_identity text, provider_delivery_key text, provider_record_created_at integer,
    last_delivery_audit_id text
  )`,
  "INSERT INTO site_blueprints (slug, workspace_id) VALUES ('site_a', 'ws')",
  `INSERT INTO publications
    (id, workspace_id, variant_id, kind, connection_id, state, scheduled_at,
     idempotency_key, attempts, last_error)
   VALUES
    ('retry_scheduled', 'ws', 'cv', 'bluesky', 'conn', 'RETRY_SCHEDULED', 2000000000, 'retry-1', 1, NULL),
    ('retry_immediate', 'ws', 'cv', 'bluesky', 'conn', 'RETRY_SCHEDULED', NULL, 'retry-2', 2, NULL),
    ('legacy_sending', 'ws', 'cv', 'bluesky', 'conn', 'SENDING', 1999999999, 'sending-1', 1, NULL),
    ('queued', 'ws', 'cv', 'bluesky', 'conn', 'QUEUED', NULL, 'queued-1', 0, NULL)`,
] as const;

async function apply(db: D1Database, sql: readonly string[]): Promise<void> {
  for (const statement of sql) await db.prepare(statement).run();
}

async function withPre0035(run: (db: D1Database) => Promise<void>): Promise<void> {
  const proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  try {
    await apply(proxy.env.DB, PRE_0035);
    await run(proxy.env.DB);
  } finally {
    await proxy.dispose();
  }
}

type PublicationRow = {
  id: string;
  state: string;
  scheduled_at: number | null;
  retry_at: number | null;
  delivery_lease_until: number | null;
  provider_delivery_key: string | null;
  last_error: string | null;
};

async function publications(db: D1Database): Promise<Record<string, PublicationRow>> {
  const rows = await db
    .prepare(
      `SELECT id, state, scheduled_at, retry_at, delivery_lease_until,
              provider_delivery_key, last_error
       FROM publications ORDER BY id`,
    )
    .all<PublicationRow>();
  return Object.fromEntries(rows.results.map((row) => [row.id, row]));
}

async function triggerNames(db: D1Database): Promise<readonly string[]> {
  const rows = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name")
    .all<{ name: string }>();
  return rows.results.map(({ name }) => name);
}

/** SQLite の `ORDER BY name` の順（文字コード順）。`publications` は `published` より前。 */
const EXPECTED_TRIGGERS = [
  "publication_delivery_audit_outbox_verify_delivery",
  "publications_commit_delivery_audit_outbox",
  "published_article_tombstones_reject_article_on_insert",
  "published_article_tombstones_reject_article_on_update",
  "published_article_tombstones_reject_corrupt_delete",
  "published_articles_reject_corrupt_delete",
  "published_articles_reject_tombstone_on_insert",
  "published_articles_reject_tombstone_on_update",
] as const;

describe("0035 生成器が書けない境界の移行", () => {
  it("D1 remote の trigger 分割器が誤認する未括弧 CASE を含まない", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "drizzle/0035_non_generated_boundaries.sql"),
      "utf8",
    );
    expect(sql).not.toMatch(/\bSELECT\s+CASE\b/);
  });

  it("列を足しただけでは拾われない古い行を、実際に救う", async () => {
    await withPre0035(async (db) => {
      const before = Math.floor(Date.now() / 1000);
      await apply(db, STATEMENTS);
      const after = Math.floor(Date.now() / 1000);
      const byId = await publications(db);

      // 予定時刻があるなら、それを守る。今へ寄せると予定より早く外へ出る。
      expect(byId.retry_scheduled?.retry_at).toBe(2_000_000_000);
      // 予定時刻が無い行は、移行の時点から拾えるようにする。
      expect(byId.retry_immediate?.retry_at).toBeGreaterThanOrEqual(before);
      expect(byId.retry_immediate?.retry_at).toBeLessThanOrEqual(after);
      // 送信中だった行は、推測して再送しない（相手側に 2 つできる）。
      expect(byId.legacy_sending).toMatchObject({
        state: "FAILED_SEND",
        delivery_lease_until: null,
        provider_delivery_key: null,
      });
      expect(byId.legacy_sending?.last_error).toContain("確認して再試行");
      // 関係のない行には触らない。
      expect(byId.queued).toMatchObject({ state: "QUEUED", retry_at: null });
    });
  });

  it("どの文の直後で止まっても、もう一度先頭から流せば同じ状態に着く", async () => {
    for (let cut = 0; cut <= STATEMENTS.length; cut += 1) {
      const scenario = `cut point ${cut}`;
      await withPre0035(async (db) => {
        await apply(db, STATEMENTS.slice(0, cut));
        await expect(apply(db, STATEMENTS), scenario).resolves.toBeUndefined();

        expect(await triggerNames(db), scenario).toEqual([...EXPECTED_TRIGGERS]);
        const byId = await publications(db);
        expect(byId.retry_scheduled?.retry_at, scenario).toBe(2_000_000_000);
        expect(byId.legacy_sending?.state, scenario).toBe("FAILED_SEND");
        expect(byId.queued, scenario).toMatchObject({ state: "QUEUED", retry_at: null });
      });
    }
  }, 180_000);

  it("接続を作業場所で絞る索引を用意する", async () => {
    await withPre0035(async (db) => {
      await apply(db, STATEMENTS);
      const indexes = await db
        .prepare("PRAGMA index_list(channel_connections)")
        .all<{ name: string }>();
      expect(indexes.results.map(({ name }) => name)).toContain(
        "channel_connections_workspace_kind_idx",
      );
    });
  });

  it("公開記事と墓標が同じ URL に同時に居ることを、DB が拒む", async () => {
    await withPre0035(async (db) => {
      await apply(db, STATEMENTS);
      await db
        .prepare(
          `INSERT INTO published_articles
            (site_slug, slug, workspace_id, type, title, summary, category_slug,
             author_slug, author_name, published_at, updated_at, article_json)
           VALUES ('site_a', 'hello', 'ws', 'review', 'T', 'S', 'c', 'a', 'A', '', '', '{}')`,
        )
        .run();

      await expect(
        db
          .prepare(
            `INSERT INTO published_article_tombstones (site_slug, slug, workspace_id)
             VALUES ('site_a', 'hello', 'ws')`,
          )
          .run(),
      ).rejects.toThrow(/published_article_url_state_conflict/);
    });
  });

  it("持ち主の違うブログへ記事を公開することを、DB が拒む", async () => {
    await withPre0035(async (db) => {
      await apply(db, STATEMENTS);
      // `site_a` の持ち主は `ws`。別の作業場所の名前で書けると、
      // 読者から見て同じ住所の中身が別の会社のものへ入れ替わる。
      await expect(
        db
          .prepare(
            `INSERT INTO published_articles
              (site_slug, slug, workspace_id, type, title, summary, category_slug,
               author_slug, author_name, published_at, updated_at, article_json)
             VALUES ('site_a', 'hello', 'ws_other', 'review', 'T', 'S', 'c', 'a', 'A', '', '', '{}')`,
          )
          .run(),
      ).rejects.toThrow(/published_article_url_state_conflict/);
    });
  });

  it("公開したあとで、その記事を別の作業場所へ付け替えられない", async () => {
    await withPre0035(async (db) => {
      await apply(db, STATEMENTS);
      await db
        .prepare(
          `INSERT INTO published_articles
            (site_slug, slug, workspace_id, type, title, summary, category_slug,
             author_slug, author_name, published_at, updated_at, article_json)
           VALUES ('site_a', 'hello', 'ws', 'review', 'T', 'S', 'c', 'a', 'A', '', '', '{}')`,
        )
        .run();

      await expect(
        db
          .prepare(
            "UPDATE published_articles SET workspace_id = 'ws_other' WHERE slug = 'hello'",
          )
          .run(),
      ).rejects.toThrow(/published_article_url_state_conflict/);
    });
  });
});
