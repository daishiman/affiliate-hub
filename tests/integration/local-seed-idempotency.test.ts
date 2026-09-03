/**
 * @tier 2
 * @req REQ-FD06, REQ-AFFILIATE-LEDGER
 * @types db-migration, idempotency
 *
 * ローカル見本を何度入れ直しても、固定IDの行数と状態が変わらず、
 * 開発者が手で作った成果リンクを巻き込まないことを本物のD1で確かめる。
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import {
  SEED_AFFILIATE_ACCOUNTS,
  SEED_AFFILIATE_LINKS,
  SEED_AFFILIATE_PLACEMENTS,
  SEED_AFFILIATE_PROGRAMS,
  SEED_ARTICLES,
  SEED_WORKSPACE_ID,
  buildSeedSql,
} from "../../scripts/seed/local-seed-data";

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

let proxy: Proxy;

function migrationStatements(): readonly string[] {
  const dir = path.resolve(process.cwd(), "drizzle");
  return readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .flatMap((file) =>
      readFileSync(path.join(dir, file), "utf8")
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter((statement) => statement !== ""),
    );
}

async function applySeed(nowSeconds: number): Promise<void> {
  for (const statement of buildSeedSql(nowSeconds)) {
    await proxy.env.DB.prepare(statement).run();
  }
}

async function count(table: string, prefix: string): Promise<number> {
  const row = await proxy.env.DB.prepare(
    `SELECT count(*) AS count FROM ${table} WHERE workspace_id = ? AND id LIKE ?`,
  )
    .bind(SEED_WORKSPACE_ID, `${prefix}%`)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

beforeAll(async () => {
  proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  for (const statement of migrationStatements()) {
    await proxy.env.DB.prepare(statement).run();
  }
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

describe("ローカル見本の再実行", () => {
  it("同じseedを2回当てても増減せず、手入力リンクは残る", async () => {
    const now = Math.floor(new Date("2026-08-30T00:00:00.000Z").getTime() / 1000);
    await applySeed(now);
    await proxy.env.DB.prepare(
      "INSERT INTO affiliate_links (id, workspace_id, program_id, product_name, original_url, tracking_ref) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(
        "manual_local_link",
        SEED_WORKSPACE_ID,
        "manual_program",
        "手入力のリンク",
        "https://example.com/manual",
        "manual-local",
      )
      .run();

    await applySeed(now);

    expect(await count("affiliate_accounts", "afa_seed_%")).toBe(SEED_AFFILIATE_ACCOUNTS.length);
    expect(await count("affiliate_programs", "afp_seed_%")).toBe(SEED_AFFILIATE_PROGRAMS.length);
    expect(await count("affiliate_links", "afl_seed_%")).toBe(SEED_AFFILIATE_LINKS.length);
    expect(await count("blog_affiliate_placement", "bap_seed_%")).toBe(
      SEED_AFFILIATE_PLACEMENTS.length,
    );
    expect(
      await proxy.env.DB.prepare("SELECT id FROM affiliate_links WHERE id = 'manual_local_link'").first(),
    ).not.toBeNull();

    const articleIds = SEED_ARTICLES.map((article) => article.id);
    const placeholders = articleIds.map(() => "?").join(", ");
    for (const table of ["blog_article_block", "blog_article_rating", "blog_article_tag"]) {
      const misplaced = await proxy.env.DB.prepare(
        `SELECT count(*) AS count FROM ${table} WHERE article_id IN (${placeholders}) AND workspace_id <> ?`,
      )
        .bind(...articleIds, SEED_WORKSPACE_ID)
        .first<{ count: number }>();
      expect(misplaced?.count, `${table} の見本行が作業場所から外れています`).toBe(0);
    }
    const misplacedPages = await proxy.env.DB.prepare(
      "SELECT count(*) AS count FROM legal_page WHERE id LIKE 'lp_seed_%' AND workspace_id <> ?",
    )
      .bind(SEED_WORKSPACE_ID)
      .first<{ count: number }>();
    expect(misplacedPages?.count, "固定文書の見本行が作業場所から外れています").toBe(0);

    const states = await proxy.env.DB.prepare(
      "SELECT id, last_checked_at, expires_at, disabled_at FROM affiliate_links WHERE id LIKE 'afl_seed_%' ORDER BY id",
    ).all<{
      id: string;
      last_checked_at: number | null;
      expires_at: number | null;
      disabled_at: number | null;
    }>();
    expect(states.results).toEqual([
      expect.objectContaining({ id: "afl_seed_disabled", last_checked_at: null, disabled_at: expect.any(Number) }),
      expect.objectContaining({ id: "afl_seed_expired", disabled_at: null }),
      expect.objectContaining({ id: "afl_seed_usable", disabled_at: null }),
    ]);
  }, 30_000);
});
