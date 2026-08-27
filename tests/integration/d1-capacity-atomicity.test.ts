/** @tier 2 @req REQ-P01 */
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import { createCapacityGuard, type CapacityKind } from "@/application/capacity";
import type { WorkspaceRepositoryPort } from "@/application/ports/identity";
import * as schema from "@/db/schema";
import { asWorkspaceId, domainError, err, ok } from "@/domain/shared";
import { createD1WorkspaceRepository } from "@/infrastructure/persistence/d1/settings-repository";

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

const NOW = new Date("2026-08-27T03:00:00.000Z");
const WORKSPACE = asWorkspaceId("ws-capacity-main");
const OTHER_WORKSPACE = asWorkspaceId("ws-capacity-other");

let proxy: Proxy;
let repository: WorkspaceRepositoryPort;

const TABLES = [
  `CREATE TABLE workspaces (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, plan TEXT NOT NULL,
    owner_user_id TEXT NOT NULL, timezone TEXT NOT NULL, currency TEXT NOT NULL,
    created_at INTEGER NOT NULL, suspended_at INTEGER
  )`,
  "CREATE TABLE brands (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL)",
  "CREATE TABLE site_blueprints (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, slug TEXT NOT NULL)",
  "CREATE TABLE site_retirements (slug TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, retired_at INTEGER NOT NULL)",
  "CREATE TABLE memberships (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, revoked_at INTEGER)",
  `CREATE TABLE llm_usages (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    purpose TEXT NOT NULL,
    capacity_consumed INTEGER NOT NULL,
    occurred_at INTEGER NOT NULL
  )`,
  `CREATE TABLE capacity_leases (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('brand', 'site', 'member', 'generation')),
    acquired_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  "CREATE INDEX capacity_leases_active_idx ON capacity_leases (workspace_id, kind, expires_at)",
] as const;

async function insertWorkspace(id: string): Promise<void> {
  await proxy.env.DB.prepare(
    `INSERT INTO workspaces
      (id, name, plan, owner_user_id, timezone, currency, created_at, suspended_at)
     VALUES (?, ?, 'solo', ?, 'Asia/Tokyo', 'JPY', ?, NULL)`,
  )
    .bind(id, id, `owner-${id}`, Math.floor(NOW.getTime() / 1000))
    .run();
}

beforeAll(async () => {
  proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  for (const statement of TABLES) await proxy.env.DB.prepare(statement).run();
  repository = createD1WorkspaceRepository(drizzle(proxy.env.DB, { schema }));
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  for (const table of [
    "capacity_leases",
    "llm_usages",
    "memberships",
    "site_retirements",
    "site_blueprints",
    "brands",
    "workspaces",
  ]) {
    await proxy.env.DB.prepare(`DELETE FROM ${table}`).run();
  }
  await insertWorkspace(String(WORKSPACE));
  await insertWorkspace(String(OTHER_WORKSPACE));
});

function lease(kind: CapacityKind, workspaceId = WORKSPACE, id = crypto.randomUUID()) {
  return repository.acquireCapacityLease(workspaceId, {
    id,
    kind,
    limit: 1,
    now: NOW,
    expiresAt: new Date(NOW.getTime() + 60_000),
  });
}

async function insertBase(kind: CapacityKind, workspaceId = WORKSPACE): Promise<void> {
  const id = `${kind}-${String(workspaceId)}`;
  if (kind === "brand") {
    await proxy.env.DB.prepare("INSERT INTO brands (id, workspace_id) VALUES (?, ?)")
      .bind(id, String(workspaceId))
      .run();
  } else if (kind === "site") {
    await proxy.env.DB.prepare(
      "INSERT INTO site_blueprints (id, workspace_id, slug) VALUES (?, ?, ?)",
    )
      .bind(id, String(workspaceId), id)
      .run();
  } else if (kind === "member") {
    await proxy.env.DB.prepare(
      "INSERT INTO memberships (id, workspace_id, revoked_at) VALUES (?, ?, NULL)",
    )
      .bind(id, String(workspaceId))
      .run();
  } else {
    await proxy.env.DB.prepare(
      `INSERT INTO llm_usages
        (id, workspace_id, purpose, capacity_consumed, occurred_at)
       VALUES (?, ?, 'draft', 1, ?)`,
    )
      .bind(id, String(workspaceId), Math.floor(NOW.getTime() / 1000))
      .run();
  }
}

describe("D1 capacity lease の原子性", () => {
  for (const kind of ["brand", "site", "member", "generation"] as const) {
    it(`${kind}: limit - 1 で1件だけ取得でき、limit では取得できない`, async () => {
      const id = `lease-${kind}`;
      expect(await lease(kind, WORKSPACE, id)).toEqual(ok(true));
      await repository.releaseCapacityLease(WORKSPACE, id, NOW);

      await insertBase(kind);
      expect(await lease(kind)).toEqual(ok(false));
    });
  }

  it("generation: 下書き以外とprovider未開始の記録は容量を塞がない", async () => {
    await proxy.env.DB.prepare(
      `INSERT INTO llm_usages
        (id, workspace_id, purpose, capacity_consumed, occurred_at)
       VALUES
        ('verification', ?, 'verification', 1, ?),
        ('before-provider', ?, 'draft', 0, ?)`,
    )
      .bind(
        String(WORKSPACE),
        Math.floor(NOW.getTime() / 1000),
        String(WORKSPACE),
        Math.floor(NOW.getTime() / 1000),
      )
      .run();

    expect(await lease("generation")).toEqual(ok(true));
  });

  it("今月の生成回数はproviderを呼んだ下書きだけを数える", async () => {
    const occurredAt = Math.floor(NOW.getTime() / 1000);
    await proxy.env.DB.prepare(
      `INSERT INTO llm_usages
        (id, workspace_id, purpose, capacity_consumed, occurred_at)
       VALUES
        ('draft-called', ?, 'draft', 1, ?),
        ('draft-not-called', ?, 'draft', 0, ?),
        ('verification-called', ?, 'verification', 1, ?)`,
    )
      .bind(
        String(WORKSPACE),
        occurredAt,
        String(WORKSPACE),
        occurredAt,
        String(WORKSPACE),
        occurredAt,
      )
      .run();

    expect(await repository.countGenerationsThisMonth(WORKSPACE, NOW)).toEqual(ok(1));
  });

  it("同じ workspace・limit 1 の並行取得は片方だけ成功する", async () => {
    const results = await Promise.all([
      lease("brand", WORKSPACE, "lease-a"),
      lease("brand", WORKSPACE, "lease-b"),
    ]);

    expect(results.filter((result) => result.ok && result.value)).toHaveLength(1);
    const stored = await proxy.env.DB.prepare(
      "SELECT COUNT(*) AS value FROM capacity_leases WHERE workspace_id = ?",
    )
      .bind(String(WORKSPACE))
      .first<{ value: number }>();
    expect(stored?.value).toBe(1);
  });

  it("別 workspace の並行取得は両方成功する", async () => {
    const results = await Promise.all([
      lease("brand", WORKSPACE, "lease-main"),
      lease("brand", OTHER_WORKSPACE, "lease-other"),
    ]);

    expect(results).toEqual([ok(true), ok(true)]);
  });

  it("異常終了で残った期限切れ lease は容量を塞がず、次の解放時に掃除する", async () => {
    await proxy.env.DB.prepare(
      `INSERT INTO capacity_leases
        (id, workspace_id, kind, acquired_at, expires_at)
       VALUES (?, ?, 'brand', ?, ?)`,
    )
      .bind(
        "expired",
        String(WORKSPACE),
        Math.floor(NOW.getTime() / 1000) - 120,
        Math.floor(NOW.getTime() / 1000) - 60,
      )
      .run();

    const acquired = await lease("brand", WORKSPACE, "current");
    await repository.releaseCapacityLease(WORKSPACE, "current", NOW);
    const remaining = await proxy.env.DB.prepare(
      "SELECT COUNT(*) AS value FROM capacity_leases WHERE workspace_id = ?",
    )
      .bind(String(WORKSPACE))
      .first<{ value: number }>();

    expect(acquired).toEqual(ok(true));
    expect(remaining?.value).toBe(0);
  });

  it("mutation failure の finally 解放後は同じ容量を再試行できる", async () => {
    const capacity = createCapacityGuard({ workspaces: repository, now: () => NOW });

    const failed = await capacity.withLease(WORKSPACE, "brand", async () =>
      err(domainError("UPSTREAM_UNAVAILABLE", "fault injection")),
    );
    const remaining = await proxy.env.DB.prepare(
      "SELECT COUNT(*) AS value FROM capacity_leases WHERE workspace_id = ?",
    )
      .bind(String(WORKSPACE))
      .first<{ value: number }>();
    const retried = await capacity.withLease(WORKSPACE, "brand", async () => ok("retried"));

    expect(failed.ok).toBe(false);
    expect(remaining?.value).toBe(0);
    expect(retried).toEqual(ok("retried"));
  });

  it("実行中は並行 mutation を止め、先行 mutation の fault 後に再試行を許可する", async () => {
    const capacity = createCapacityGuard({ workspaces: repository, now: () => NOW });
    let announceStarted!: () => void;
    let injectFault!: () => void;
    const started = new Promise<void>((resolve) => {
      announceStarted = resolve;
    });
    const fault = new Promise<void>((resolve) => {
      injectFault = resolve;
    });

    const first = capacity.withLease(WORKSPACE, "brand", async () => {
      announceStarted();
      await fault;
      return err(domainError("UPSTREAM_UNAVAILABLE", "concurrent fault injection"));
    });
    await started;
    const blocked = await capacity.withLease(WORKSPACE, "brand", async () => ok("must-not-run"));
    injectFault();
    const failed = await first;
    const retried = await capacity.withLease(WORKSPACE, "brand", async () => ok("retried"));

    expect(blocked.ok).toBe(false);
    expect(failed.ok).toBe(false);
    expect(retried).toEqual(ok("retried"));
  });
});
