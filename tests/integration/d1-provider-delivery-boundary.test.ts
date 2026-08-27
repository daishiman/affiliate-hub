/**
 * @tier 2
 * @req REQ-A06
 * @types idempotency, db-concurrency, db-migration
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import {
  createD1ChannelConnectionRepository,
  createD1PublicationRepository,
} from "@/infrastructure/persistence/d1/distribution-repository";
import type { PublicationId } from "@/domain/shared";
import { aChannelConnection, aPublication } from "../support/factories";

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

let proxy: Proxy;
let connections: ReturnType<typeof createD1ChannelConnectionRepository>;
let publications: ReturnType<typeof createD1PublicationRepository>;

function migrationStatements(): readonly string[] {
  return readdirSync(path.resolve(process.cwd(), "drizzle"))
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .flatMap((file) =>
      readFileSync(path.resolve(process.cwd(), "drizzle", file), "utf8")
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean),
    );
}

beforeAll(async () => {
  proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  for (const statement of migrationStatements()) await proxy.env.DB.prepare(statement).run();
  const db = drizzle(proxy.env.DB, { schema });
  connections = createD1ChannelConnectionRepository(db);
  publications = createD1PublicationRepository(db);
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM channel_provider_delivery_leases").run();
  await proxy.env.DB.prepare("DELETE FROM publications").run();
  await proxy.env.DB.prepare("DELETE FROM channel_connections").run();
});

describe("provider identityのD1一意・直列化境界", () => {
  it("同じDIDの並行登録とaudit再試行を1行へ収束させる", async () => {
    const left = aChannelConnection({
      id: "conn_provider_left" as never,
      kind: "bluesky",
      providerIdentity: "did:plc:publisher",
      credentialRef: "channel/publisher/credentials",
    });
    const right = { ...left, id: "conn_provider_right" as never };

    const results = await Promise.all([
      connections.createIfAbsent(left),
      connections.createIfAbsent(right),
    ]);

    expect(results.every((result) => result.ok)).toBe(true);
    const successful = results.filter((result) => result.ok).map((result) => result.value);
    expect(successful.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(successful.map((result) => String(result.connection.id))).size).toBe(1);
    const stored = await proxy.env.DB.prepare(
      "SELECT provider_identity, credential_ref FROM channel_connections",
    ).all<{ provider_identity: string; credential_ref: string }>();
    expect(stored.results).toEqual([
      {
        provider_identity: "did:plc:publisher",
        credential_ref: "channel/publisher/credentials",
      },
    ]);
  });

  it("同じDIDへの別secret参照と、同じsecret参照への別DIDを既存行へ返す", async () => {
    const original = aChannelConnection({
      id: "conn_provider_original" as never,
      kind: "bluesky",
      providerIdentity: "did:plc:publisher",
      credentialRef: "channel/publisher/credentials",
    });
    expect((await connections.createIfAbsent(original)).ok).toBe(true);

    const sameIdentity = await connections.createIfAbsent({
      ...original,
      id: "conn_provider_same_identity" as never,
      credentialRef: "channel/other/credentials",
    });
    const sameReference = await connections.createIfAbsent({
      ...original,
      id: "conn_provider_same_reference" as never,
      providerIdentity: "did:plc:other",
    });

    expect(sameIdentity.ok && sameIdentity.value.created).toBe(false);
    expect(sameReference.ok && sameReference.value.created).toBe(false);
    if (sameIdentity.ok) expect(sameIdentity.value.connection).toEqual(original);
    if (sameReference.ok) expect(sameReference.value.connection).toEqual(original);
  });

  it("同じDIDのleaseは複数Worker間で1件だけ取得し、別DIDと期限切れ後は進める", async () => {
    const at = new Date("2026-08-27T03:04:05Z");
    const expiresAt = new Date(at.getTime() + 60_000);
    const common = {
      kind: "bluesky" as const,
      providerIdentity: "did:plc:publisher",
      at,
      expiresAt,
    };

    const [left, right] = await Promise.all([
      connections.acquireProviderDeliveryLease({
        ...common,
        holderPublicationId: "pub_lease_left" as PublicationId,
      }),
      connections.acquireProviderDeliveryLease({
        ...common,
        holderPublicationId: "pub_lease_right" as PublicationId,
      }),
    ]);

    expect(left.ok && right.ok).toBe(true);
    if (!left.ok || !right.ok) return;
    expect([left.value, right.value].filter(Boolean)).toHaveLength(1);

    const otherDid = await connections.acquireProviderDeliveryLease({
      ...common,
      providerIdentity: "did:plc:other",
      holderPublicationId: "pub_lease_other" as PublicationId,
    });
    expect(otherDid.ok && otherDid.value !== null).toBe(true);

    const afterExpiry = new Date(expiresAt.getTime() + 1_000);
    const recovered = await connections.acquireProviderDeliveryLease({
      ...common,
      holderPublicationId: "pub_lease_recovered" as PublicationId,
      at: afterExpiry,
      expiresAt: new Date(afterExpiry.getTime() + 60_000),
    });
    expect(recovered.ok && recovered.value !== null).toBe(true);
  });

  it("同じPublicationも未期限切れleaseを再取得できず、旧tokenで期限後の新leaseを解放できない", async () => {
    const firstAt = new Date("2026-08-27T03:04:05Z");
    const holder = "pub_lease_same_holder" as PublicationId;
    const identity = "did:plc:publisher";

    const acquiredOld = await connections.acquireProviderDeliveryLease({
      kind: "bluesky",
      providerIdentity: identity,
      holderPublicationId: holder,
      at: firstAt,
      expiresAt: new Date(firstAt.getTime() + 1_000),
    });
    expect(acquiredOld.ok && typeof acquiredOld.value === "string").toBe(true);
    if (!acquiredOld.ok || typeof acquiredOld.value !== "string") return;

    const duplicate = await connections.acquireProviderDeliveryLease({
      kind: "bluesky",
      providerIdentity: identity,
      holderPublicationId: holder,
      at: new Date(firstAt.getTime() + 500),
      expiresAt: new Date(firstAt.getTime() + 1_500),
    });
    expect(duplicate.ok && duplicate.value).toBeNull();

    const replacementAt = new Date(firstAt.getTime() + 2_000);
    const acquiredNew = await connections.acquireProviderDeliveryLease({
      kind: "bluesky",
      providerIdentity: identity,
      holderPublicationId: holder,
      at: replacementAt,
      expiresAt: new Date(replacementAt.getTime() + 1_000),
    });
    expect(acquiredNew.ok && typeof acquiredNew.value === "string").toBe(true);
    if (!acquiredNew.ok || typeof acquiredNew.value !== "string") return;
    expect(acquiredNew.value).not.toBe(acquiredOld.value);

    const releasedOld = await connections.releaseProviderDeliveryLease({
      kind: "bluesky",
      providerIdentity: identity,
      holderPublicationId: holder,
      leaseToken: acquiredOld.value,
    });
    expect(releasedOld.ok).toBe(true);

    const stored = await proxy.env.DB.prepare(
      "SELECT holder_publication_id FROM channel_provider_delivery_leases WHERE kind = ? AND provider_identity = ?",
    )
      .bind("bluesky", identity)
      .first<{ holder_publication_id: string }>();
    expect(stored?.holder_publication_id).toBe(holder);

    const releasedNew = await connections.releaseProviderDeliveryLease({
      kind: "bluesky",
      providerIdentity: identity,
      holderPublicationId: holder,
      leaseToken: acquiredNew.value,
    });
    expect(releasedNew.ok).toBe(true);
    const removed = await proxy.env.DB.prepare(
      "SELECT 1 FROM channel_provider_delivery_leases WHERE kind = ? AND provider_identity = ?",
    )
      .bind("bluesky", identity)
      .first();
    expect(removed).toBeNull();
  });

  it("同じprovider identityとdelivery keyの衝突を保存先で外部送信前に拒否する", async () => {
    const first = aPublication({
      id: "pub_provider_key_left" as PublicationId,
      idempotencyKey: "provider-key-left",
      channelKind: "bluesky",
      providerIdentity: "did:plc:publisher",
      providerDeliveryKey: "3m4exampletid",
    });
    const second = {
      ...first,
      id: "pub_provider_key_right" as PublicationId,
      idempotencyKey: "provider-key-right",
    };

    expect((await publications.save(first)).ok).toBe(true);
    const collision = await publications.save(second);

    expect(collision.ok).toBe(false);
    const stored = await proxy.env.DB.prepare("SELECT id FROM publications").all<{ id: string }>();
    expect(stored.results.map((row) => row.id)).toEqual(["pub_provider_key_left"]);
  });
});
