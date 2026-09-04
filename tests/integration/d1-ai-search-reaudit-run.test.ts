/**
 * @tier 2
 * @req REQ-SEO07
 * @types db-migration, tenant-isolation, db-constraint
 */
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import type { AiSearchReauditRunPort } from "@/application/ports/seo";
import * as schema from "@/db/schema";
import {
  failAiSearchReauditRun,
  finishAiSearchReauditRun,
} from "@/domain/seo/ai-search-reaudit-run";
import { asWorkspaceId } from "@/domain/shared";
import { createD1AiSearchReauditRunRepository } from "@/infrastructure/persistence/d1/ai-search-reaudit-run-repository";
import { migrationStatements } from "../support/migrations";

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

const ACTIVE = asWorkspaceId("ws_reaudit_active");
const EMPTY = asWorkspaceId("ws_reaudit_empty");
const SUSPENDED = asWorkspaceId("ws_reaudit_suspended");
const startedAt = new Date("2026-09-04T00:00:00.000Z");
const completedAt = new Date("2026-09-04T00:00:02.000Z");

let proxy: Proxy;
let runs: AiSearchReauditRunPort;

beforeAll(async () => {
  proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  for (const statement of migrationStatements()) {
    await proxy.env.DB.prepare(statement).run();
  }
  runs = createD1AiSearchReauditRunRepository(drizzle(proxy.env.DB, { schema }));
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM ai_search_reaudit_runs").run();
  await proxy.env.DB.prepare("DELETE FROM workspaces WHERE id LIKE 'ws_reaudit_%'").run();
  await proxy.env.DB.prepare(
    `INSERT INTO workspaces (id, name, owner_user_id, suspended_at)
     VALUES (?, '稼働中', 'owner', NULL),
            (?, '記事0件', 'owner', NULL),
            (?, '停止中', 'owner', unixepoch())`,
  )
    .bind(String(ACTIVE), String(EMPTY), String(SUSPENDED))
    .run();
});

describe("AI 検索の定期再点検 run-state D1", () => {
  it("記事 0 件の稼働中 workspace も列挙し、停止中は除く", async () => {
    expect(await runs.listKnownWorkspaceIds()).toEqual(okIds([ACTIVE, EMPTY]));
  });

  it("最新状態を workspace 境界で保存・上書きする", async () => {
    const first = finishAiSearchReauditRun({
      workspaceId: ACTIVE,
      startedAt,
      completedAt,
      scanned: 0,
      recorded: 0,
      failed: 0,
    });
    expect((await runs.save(first)).ok).toBe(true);
    expect(await runs.getLatest(ACTIVE)).toEqual({ ok: true, value: first });
    expect(await runs.getLatest(EMPTY)).toEqual({ ok: true, value: null });

    const latest = failAiSearchReauditRun({
      workspaceId: ACTIVE,
      startedAt: new Date("2026-09-05T00:00:00.000Z"),
      completedAt: new Date("2026-09-05T00:00:01.000Z"),
    });
    expect((await runs.save(latest)).ok).toBe(true);
    expect(await runs.getLatest(ACTIVE)).toEqual({ ok: true, value: latest });
  });

  it("固定 status/failure code の矛盾を DB 境界でも拒む", async () => {
    await expect(
      proxy.env.DB.prepare(
        `INSERT INTO ai_search_reaudit_runs
          (workspace_id, status, started_at, completed_at, scanned, recorded, failed, failure_code)
         VALUES (?, 'succeeded', 1, 2, 0, 0, 0, 'target_list_unavailable')`,
      )
        .bind(String(ACTIVE))
        .run(),
    ).rejects.toThrow();
  });
});

function okIds(value: readonly ReturnType<typeof asWorkspaceId>[]) {
  return { ok: true, value };
}
