/** @tier 2 @req REQ-B18, REQ-SEC01, REQ-TS07 */
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import type { WorkspaceId } from "@/domain/shared";
import { createD1ContactRepository } from "@/infrastructure/persistence/d1/contact-repository";
import { migrationStatements } from "../support/migrations";

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

const WORKSPACE = "ws_contact_atomic" as WorkspaceId;
const OTHER_WORKSPACE = "ws_contact_other" as WorkspaceId;
const SITE = "atomic-contact-site";
const NOW = () => new Date("2026-08-27T09:00:00.000Z");

let proxy: Proxy;

beforeAll(async () => {
  proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  for (const statement of migrationStatements()) await proxy.env.DB.prepare(statement).run();
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM contact_messages").run();
});

describe("問い合わせ回数と保存の原子境界", () => {
  it("同じ境界から6件が同時に来ても、条件判定とINSERTを1文で5件だけ確定する", async () => {
    const repository = createD1ContactRepository(drizzle(proxy.env.DB, { schema }), NOW);

    const results = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        repository.submit(
          WORKSPACE,
          { siteSlug: SITE, body: `同時問い合わせ ${index}` },
          "same-anonymous-key",
        ),
      ),
    );

    expect(results.filter((result) => result.ok)).toHaveLength(5);
    const denied = results.filter((result) => !result.ok);
    expect(denied).toHaveLength(1);
    if (denied[0]?.ok === false) expect(denied[0].error.code).toBe("RATE_LIMITED");
    const stored = await proxy.env.DB.prepare(
      "SELECT count(*) as total FROM contact_messages WHERE workspace_id = ? AND site_slug = ?",
    )
      .bind(String(WORKSPACE), SITE)
      .first<{ total: number }>();
    expect(stored?.total).toBe(5);
  });

  it("別workspaceの同じslug・匿名キーは互いの回数を消費しない", async () => {
    const repository = createD1ContactRepository(drizzle(proxy.env.DB, { schema }), NOW);
    for (let index = 0; index < 5; index += 1) {
      const first = await repository.submit(
        WORKSPACE,
        { siteSlug: SITE, body: `first ${index}` },
        "shared-key",
      );
      expect(first.ok).toBe(true);
    }

    const other = await repository.submit(
      OTHER_WORKSPACE,
      { siteSlug: SITE, body: "other workspace" },
      "shared-key",
    );

    expect(other.ok).toBe(true);
  });
});
