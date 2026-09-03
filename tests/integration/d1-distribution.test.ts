/**
 * @tier 2
 * @req REQ-P08
 * @types idempotency, db-migration
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import { createDeps } from "@/infrastructure/composition";
import {
  createCancelPublicationUseCase,
  createListPublicationsUseCase,
  createSchedulePublicationUseCase,
  createUpdatePublicationUseCase,
} from "@/application/usecases/distribution/manage-distribution";
import type { ManageDistributionDeps } from "@/application/usecases/distribution/manage-distribution";
import {
  createGetPublicationCalendarUseCase,
  createReschedulePublicationUseCase,
} from "@/application/usecases/distribution/publication-calendar";
import type { PublicationCalendarDeps } from "@/application/usecases/distribution/publication-calendar";
import type { ActorContext, AuditLogId, BrandId, ContentPackageId, ContentVariantId, PublicationId } from "@/domain/shared";
import { ok, taggedString } from "@/domain/shared";
import {
  SAMPLE_CONTENT_PACKAGES,
  sampleContentVariants,
} from "@/infrastructure/persistence/sample/content-editorial-sample-repository";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { anOwner } from "../support/actors";
import { aChannelConnection, aPublication } from "../support/factories";
import {
  createPublicationDeliveryAudit,
  type Publication,
  type PublicationDeliveryAudit,
} from "@/domain/distribution";
import { createD1PublicationDeliveryAuditOutbox } from "@/infrastructure/persistence/d1/publication-delivery-audit-outbox";
import { migrationStatements } from "../support/migrations";

/**
 * 配信の予約を、**本物の D1 と本物のマイグレーション**で通す結合テスト。
 *
 * --- なぜこれが要るのか ---
 * 配信は、これまで**この場限り**（処理が終われば消える）だった。
 * 予約したのに次に開くと消えている、というのは画面を見ても分からない
 * ——「まだ出していないのか」「消えたのか」の区別が付かないため。
 * だから保存先をつないだ。つないだこと自体は、次の 3 つが揃って初めて言える:
 *
 *   1. マイグレーション 0008 が publications / channel_connections を実際に作る
 *   2. 組み立てた SQL がその表に対して通る（列の綴り・型が合っている）
 *   3. **保存したものが読み直せる**（返り値ではなく、読み直しで確かめる）
 *
 * --- ここでいちばん見たいこと ---
 * **冪等キーを保存先で一意に取り合わせること。** 先に読んでから保存するだけでは、
 * 同時に来た2要求がどちらも「まだ無い」と読める。保存先の一意境界と
 * create-if-absentを組み合わせ、負けた側にも既存の1件を成功として返す。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-5（結合テスト）/ REQ-TS07
 */

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

let proxy: Proxy;
let deps: ManageDistributionDeps;
let calendarDeps: PublicationCalendarDeps;

/** 見本の記事と同じ作業場所にいて、配信の権限を持つ人。 */
const publisher: ActorContext = anOwner({ workspaceId: SAMPLE_WORKSPACE_ID });

/** 承認済みの見本記事。承認前の記事は配信できない（別途 単体で見ている）。 */
const APPROVED_VARIANT = "cv_alpha_approved";

/** 未来の時刻。過ぎた時刻は予約できない仕様なので、実行時から先へ取る。 */
function future(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
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
  const all = createDeps({ db: drizzle(proxy.env.DB, { schema }) });
  deps = {
    connections: all.channelConnections,
    connectors: all.channelConnectors,
    publications: all.publications,
    manualExport: all.manualExport,
    variants: all.contentVariants,
    contentPackages: all.contentPackages,
    ids: all.ids,
    auditLog: all.auditLog,
  };
  calendarDeps = {
    publications: all.publications,
    connections: all.channelConnections,
    contentVariants: all.contentVariants,
    contentPackages: all.contentPackages,
    events: all.events,
    auditLog: all.auditLog,
    ids: all.ids,
  };
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM publication_delivery_audit_outbox").run();
  await proxy.env.DB.prepare("DELETE FROM publications").run();
  await proxy.env.DB.prepare(
    "DELETE FROM audit_logs WHERE action = 'publication.delivery_changed'",
  ).run();
  await proxy.env.DB.prepare("DELETE FROM channel_connections").run();
  await proxy.env.DB.prepare(
    "DELETE FROM content_variants WHERE id LIKE 'scope_test_%' OR id = ?",
  )
    .bind(APPROVED_VARIANT)
    .run();
  await proxy.env.DB.prepare("DELETE FROM content_packages WHERE id LIKE 'scope_test_%'").run();
});

function deliveryTransition(suffix: string): {
  readonly before: Publication;
  readonly after: Publication;
  readonly audit: PublicationDeliveryAudit;
} {
  const before = aPublication({
    id: `audit_delivery_${suffix}` as PublicationId,
    workspaceId: SAMPLE_WORKSPACE_ID,
    variantId: APPROVED_VARIANT as ContentVariantId,
    variantRevision: 1,
    channelKind: "bluesky",
    connectionId: `conn_audit_${suffix}` as never,
    state: "SENDING",
    scheduledAt: new Date("2026-08-27T00:00:00Z"),
    deliveryLeaseUntil: new Date("2026-08-27T00:05:00Z"),
    providerIdentity: `did:plc:audit-${suffix}`,
    providerDeliveryKey: `delivery-key-${suffix}`,
    attempts: 1,
  });
  const after: Publication = {
    ...before,
    state: "PUBLISHED",
    deliveryLeaseUntil: null,
    externalId: `at://${before.providerIdentity}/app.bsky.feed.post/${before.providerDeliveryKey}`,
    publishedAt: new Date("2026-08-27T00:01:00Z"),
  };
  const built = createPublicationDeliveryAudit({
    id: `al_delivery_${suffix}` as AuditLogId,
    before,
    after,
    occurredAt: new Date("2026-08-27T00:01:00Z"),
  });
  if (!built.ok) throw new Error(built.error.message);
  return { before, after, audit: built.value };
}

const schedule = () => createSchedulePublicationUseCase(deps);
const list = () => createListPublicationsUseCase(deps);
const cancel = () => createCancelPublicationUseCase(deps);
const calendar = () => createGetPublicationCalendarUseCase(calendarDeps);
const reschedule = () => createReschedulePublicationUseCase(calendarDeps);

async function saveBrandPublication(input: {
  readonly suffix: string;
  readonly brandId: BrandId;
  readonly scheduledAt: Date | null;
}) {
  const packageId = taggedString<"ContentPackageId">(
    `scope_test_package_${input.suffix}`,
  ) as ContentPackageId;
  const variantId = taggedString<"ContentVariantId">(
    `scope_test_variant_${input.suffix}`,
  ) as ContentVariantId;
  const publicationId = taggedString<"PublicationId">(
    `scope_test_publication_${input.suffix}`,
  ) as PublicationId;
  const savedPackage = await deps.contentPackages.save({
    ...SAMPLE_CONTENT_PACKAGES[0]!,
    id: packageId,
    workspaceId: SAMPLE_WORKSPACE_ID,
    brandId: String(input.brandId),
    variantIds: [variantId],
  });
  expect(savedPackage.ok).toBe(true);
  const savedVariant = await deps.variants.save({
    ...sampleContentVariants()[0]!.variant,
    id: variantId,
    workspaceId: SAMPLE_WORKSPACE_ID,
    contentPackageId: packageId,
  });
  expect(savedVariant.ok).toBe(true);
  const publication = aPublication({
    id: publicationId,
    workspaceId: SAMPLE_WORKSPACE_ID,
    variantId,
    scheduledAt: input.scheduledAt,
    idempotencyKey: `scope-test-${input.suffix}`,
  });
  const savedPublication = await deps.publications.save(publication);
  expect(savedPublication.ok).toBe(true);
  return publication;
}

describe("マイグレーションそのもの", () => {
  it("配信と出し先の表を実際に作る", async () => {
    const tables = await proxy.env.DB.prepare(
      "select name from sqlite_master where type = 'table'",
    ).all<{ name: string }>();
    const names = tables.results.map((r) => r.name);
    expect(names).toContain("publications");
    expect(names).toContain("channel_connections");
  });

  it("同時予約を1件へ収束させるため、workspaceと冪等キーを一意にする", async () => {
    const indexes = await proxy.env.DB.prepare("pragma index_list(publications)").all<{
      name: string;
      unique: number;
    }>();
    const byKey = indexes.results.find(
      (r) => r.name === "publications_workspace_idempotency_idx",
    );
    expect(byKey, "冪等キーの索引がありません").toBeDefined();
    expect(byKey?.unique).toBe(1);
  });
});

describe("予約workerのD1 claim", () => {
  it("同じpublicationを並行claimしてもCASの勝者は1つだけ", async () => {
    const before = aPublication({
      id: taggedString<"PublicationId">("claim_atomic") as PublicationId,
      workspaceId: SAMPLE_WORKSPACE_ID,
      variantId: taggedString<"ContentVariantId">(APPROVED_VARIANT) as ContentVariantId,
      channelKind: "bluesky",
      connectionId: "conn_claim" as never,
      state: "QUEUED",
      scheduledAt: new Date("2026-08-27T00:00:00Z"),
      attempts: 0,
      providerDeliveryKey: null,
      deliveryLeaseUntil: null,
      retryAt: null,
      publishedAt: null,
    });
    const stored = await deps.publications.save(before);
    expect(stored.ok).toBe(true);
    const claimed = {
      ...before,
      state: "SENDING" as const,
      attempts: 1,
      providerDeliveryKey: "3m4exampletid",
      deliveryLeaseUntil: new Date("2026-08-27T00:05:00Z"),
    };

    const [left, right] = await Promise.all([
      deps.publications.compareAndSwap(before, claimed),
      deps.publications.compareAndSwap(before, claimed),
    ]);
    expect(left.ok && right.ok).toBe(true);
    if (!left.ok || !right.ok) return;
    expect([left.value, right.value].filter((value) => value !== null)).toHaveLength(1);

    const row = await proxy.env.DB.prepare(
      "select state, attempts, provider_delivery_key from publications where id = ?",
    )
      .bind(before.id)
      .first<{ state: string; attempts: number; provider_delivery_key: string | null }>();
    expect(row).toEqual({
      state: "SENDING",
      attempts: 1,
      provider_delivery_key: "3m4exampletid",
    });
  });

  it("予約後に承認済み本文が改版されたら、同一UPDATE条件でclaimを拒否する", async () => {
    const variantId = taggedString<"ContentVariantId">(APPROVED_VARIANT) as ContentVariantId;
    const versioned = await deps.variants.findVersionedById(publisher.workspaceId, variantId);
    if (!versioned.ok || versioned.value === null) throw new Error("承認済み記事がありません");
    const before = aPublication({
      id: "claim_content_revision_race" as PublicationId,
      workspaceId: publisher.workspaceId,
      variantId,
      variantRevision: versioned.value.revision,
      channelKind: "bluesky",
      connectionId: "conn_claim" as never,
      state: "QUEUED",
      scheduledAt: new Date("2099-08-27T00:00:00Z"),
      attempts: 0,
      publishedAt: null,
    });
    expect((await deps.publications.save(before)).ok).toBe(true);

    const edited = await deps.variants.save({
      ...versioned.value.variant,
      body: `${versioned.value.variant.body}\n承認後に変更された本文`,
      status: "review",
    });
    if (!edited.ok) throw edited.error;

    const claimed = await deps.publications.claimForDelivery(before, {
      ...before,
      state: "SENDING",
      attempts: 1,
      providerDeliveryKey: "3m4revisionrace",
      deliveryLeaseUntil: new Date("2099-08-27T00:05:00Z"),
    });
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.value).toBeNull();
    const row = await proxy.env.DB.prepare(
      "select state, attempts, provider_delivery_key from publications where id = ?",
    )
      .bind(before.id)
      .first<{ state: string; attempts: number; provider_delivery_key: string | null }>();
    expect(row).toEqual({ state: "QUEUED", attempts: 0, provider_delivery_key: null });
  });

  it("0037以前のvariant_revision欠落行は、現在本文が存在してもfail-closedでclaimしない", async () => {
    const variantId = taggedString<"ContentVariantId">(APPROVED_VARIANT) as ContentVariantId;
    const sample = await deps.variants.findById(publisher.workspaceId, variantId);
    if (!sample.ok || sample.value === null) throw new Error("承認済み記事がありません");
    const persisted = await deps.variants.save(sample.value);
    if (!persisted.ok) throw persisted.error;

    const legacy = aPublication({
      id: "claim_legacy_without_revision" as PublicationId,
      workspaceId: publisher.workspaceId,
      variantId,
      variantRevision: null,
      channelKind: "bluesky",
      connectionId: "conn_claim" as never,
      state: "QUEUED",
      scheduledAt: new Date("2099-08-27T00:00:00Z"),
      attempts: 0,
      publishedAt: null,
    });
    expect((await deps.publications.save(legacy)).ok).toBe(true);
    const claimed = await deps.publications.claimForDelivery(legacy, {
      ...legacy,
      state: "SENDING",
      attempts: 1,
      providerDeliveryKey: "3m4legacyrevision",
      deliveryLeaseUntil: new Date("2099-08-27T00:05:00Z"),
    });
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.value).toBeNull();
    const state = await proxy.env.DB.prepare(
      "select state from publications where id = ?",
    )
      .bind(legacy.id)
      .first<{ state: string }>();
    expect(state?.state).toBe("QUEUED");
  });

  it("dueはretry時刻と期限切れleaseを拾い、未来予約と有効leaseを拾わない", async () => {
    const at = new Date("2026-08-27T00:10:00Z");
    const rows = [
      aPublication({
        id: "due_retry" as PublicationId,
        channelKind: "bluesky",
        connectionId: "conn_due" as never,
        state: "RETRY_SCHEDULED",
        retryAt: new Date(at.getTime() - 1),
        scheduledAt: new Date("2026-08-26T00:00:00Z"),
      }),
      aPublication({
        id: "due_immediate" as PublicationId,
        channelKind: "bluesky",
        connectionId: "conn_due" as never,
        state: "QUEUED",
        scheduledAt: null,
        publishedAt: null,
      }),
      aPublication({
        id: "due_stale" as PublicationId,
        channelKind: "bluesky",
        connectionId: "conn_due" as never,
        state: "SENDING",
        attempts: 5,
        providerDeliveryKey: "3m4exampletid",
        deliveryLeaseUntil: new Date(at.getTime() - 1),
        scheduledAt: new Date("2026-08-26T00:00:00Z"),
      }),
      aPublication({
        id: "not_due_future" as PublicationId,
        channelKind: "bluesky",
        connectionId: "conn_due" as never,
        state: "QUEUED",
        scheduledAt: new Date(at.getTime() + 60_000),
      }),
      aPublication({
        id: "not_due_leased" as PublicationId,
        channelKind: "bluesky",
        connectionId: "conn_due" as never,
        state: "SENDING",
        providerDeliveryKey: "3m4exampletid",
        deliveryLeaseUntil: new Date(at.getTime() + 60_000),
        scheduledAt: new Date("2026-08-26T00:00:00Z"),
      }),
    ];
    for (const row of rows) expect((await deps.publications.save(row)).ok).toBe(true);

    const due = await deps.publications.listDue(at, 20);
    expect(due.ok).toBe(true);
    if (!due.ok) return;
    expect(due.value.map((item) => item.id).sort()).toEqual([
      "due_immediate",
      "due_retry",
      "due_stale",
    ]);
  });

  it("読み取り後に接続が変わったら、workerの古い版はclaimできない", async () => {
    const before = aPublication({
      id: "claim_connection_race" as PublicationId,
      workspaceId: SAMPLE_WORKSPACE_ID,
      variantId: APPROVED_VARIANT as ContentVariantId,
      channelKind: "bluesky",
      connectionId: "conn_old" as never,
      state: "QUEUED",
      scheduledAt: new Date("2026-08-27T00:00:00Z"),
      attempts: 0,
    });
    expect((await deps.publications.save(before)).ok).toBe(true);
    await proxy.env.DB.prepare(
      "update publications set connection_id = ? where workspace_id = ? and id = ?",
    )
      .bind("conn_new", SAMPLE_WORKSPACE_ID, before.id)
      .run();

    const claimed = await deps.publications.compareAndSwap(before, {
      ...before,
      state: "SENDING",
      attempts: 1,
      providerDeliveryKey: "3m4exampletid",
      deliveryLeaseUntil: new Date("2026-08-27T00:05:00Z"),
    });

    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.value).toBeNull();
    const row = await proxy.env.DB.prepare(
      "select state, connection_id from publications where id = ?",
    )
      .bind(before.id)
      .first<{ state: string; connection_id: string }>();
    expect(row).toEqual({ state: "QUEUED", connection_id: "conn_new" });
  });

  it("workerのclaim後に古い読取結果から取消・修正してもSENDINGを上書きしない", async () => {
    const before = aPublication({
      id: "claim_then_human_mutation" as PublicationId,
      workspaceId: SAMPLE_WORKSPACE_ID,
      variantId: APPROVED_VARIANT as ContentVariantId,
      channelKind: "bluesky",
      connectionId: "conn_claim" as never,
      state: "QUEUED",
      scheduledAt: new Date("2099-08-27T00:00:00Z"),
      attempts: 0,
      publishedAt: null,
    });
    expect((await deps.publications.save(before)).ok).toBe(true);
    const claimed = await deps.publications.compareAndSwap(before, {
      ...before,
      state: "SENDING",
      attempts: 1,
      providerDeliveryKey: "3m4exampletid",
      deliveryLeaseUntil: new Date("2099-08-27T00:05:00Z"),
    });
    expect(claimed.ok && claimed.value !== null).toBe(true);

    // 人の画面はclaim直前の版を既に読んでいた、という競合窓を再現する。
    const staleDeps: ManageDistributionDeps = {
      ...deps,
      publications: {
        ...deps.publications,
        findById: async () => ({ ok: true as const, value: before }),
      },
    };
    const cancelled = await createCancelPublicationUseCase(staleDeps).execute(publisher, {
      publicationId: String(before.id),
    });
    const updated = await createUpdatePublicationUseCase(staleDeps).execute(publisher, {
      publicationId: String(before.id),
      scheduledAt: "2099-08-28T00:00:00Z",
    });

    expect(cancelled.ok).toBe(false);
    expect(updated.ok).toBe(false);
    if (!cancelled.ok) expect(cancelled.error.code).toBe("CONFLICT");
    if (!updated.ok) expect(updated.error.code).toBe("CONFLICT");
    const row = await proxy.env.DB.prepare(
      "select state, connection_id, scheduled_at from publications where id = ?",
    )
      .bind(before.id)
      .first<{ state: string; connection_id: string; scheduled_at: number }>();
    expect(row).toEqual({
      state: "SENDING",
      connection_id: "conn_claim",
      scheduled_at: before.scheduledAt!.getTime() / 1_000,
    });
  });
});

describe("予約workerの配信監査outbox", () => {
  it("Publication状態と完全な監査payloadを同時確定し、同じIDで一度だけ配送する", async () => {
    const transition = deliveryTransition("success");
    expect((await deps.publications.save(transition.before)).ok).toBe(true);
    const outbox = createD1PublicationDeliveryAuditOutbox(
      drizzle(proxy.env.DB, { schema }),
    );

    const settled = await outbox.settle(
      transition.before,
      transition.after,
      transition.audit,
    );
    expect(settled.ok && settled.value?.state === "PUBLISHED").toBe(true);
    const pending = await proxy.env.DB.prepare(
      `SELECT committed_at AS committedAt, delivered_at AS deliveredAt
       FROM publication_delivery_audit_outbox WHERE id = ?`,
    )
      .bind(transition.audit.id)
      .first<{ committedAt: number | null; deliveredAt: number | null }>();
    expect(pending?.committedAt).not.toBeNull();
    expect(pending?.deliveredAt).toBeNull();
    expect(
      await proxy.env.DB.prepare("SELECT id FROM audit_logs WHERE id = ?")
        .bind(transition.audit.id)
        .first(),
    ).toBeNull();

    const flushed = await outbox.flush(20);
    expect(flushed).toEqual({ ok: true, value: { scanned: 1, delivered: 1, pending: 0 } });
    const again = await outbox.flush(20);
    expect(again).toEqual({ ok: true, value: { scanned: 0, delivered: 0, pending: 0 } });
    const audits = await proxy.env.DB.prepare(
      `SELECT id, workspace_id AS workspaceId, action, target_id AS targetId,
              before_json AS beforeJson, after_json AS afterJson
       FROM audit_logs WHERE id = ?`,
    )
      .bind(transition.audit.id)
      .all();
    expect(audits.results).toEqual([
      {
        id: transition.audit.id,
        workspaceId: SAMPLE_WORKSPACE_ID,
        action: "publication.delivery_changed",
        targetId: transition.before.id,
        beforeJson: JSON.stringify(transition.audit.before),
        afterJson: JSON.stringify(transition.audit.after),
      },
    ]);
  });

  it("CAS敗者ではPublicationも変えずoutbox intentも残さない", async () => {
    const transition = deliveryTransition("cas-loser");
    expect((await deps.publications.save(transition.before)).ok).toBe(true);
    await proxy.env.DB.prepare("UPDATE publications SET state = 'CANCELLED' WHERE id = ?")
      .bind(transition.before.id)
      .run();
    const outbox = createD1PublicationDeliveryAuditOutbox(
      drizzle(proxy.env.DB, { schema }),
    );

    const settled = await outbox.settle(
      transition.before,
      transition.after,
      transition.audit,
    );
    expect(settled).toEqual({ ok: true, value: null });
    const outboxCount = await proxy.env.DB.prepare(
      "SELECT count(*) AS n FROM publication_delivery_audit_outbox WHERE id = ?",
    )
      .bind(transition.audit.id)
      .first<{ n: number }>();
    expect(outboxCount?.n).toBe(0);
  });

  it("outbox enqueue文の障害ではPublication更新もrollbackする", async () => {
    const transition = deliveryTransition("enqueue-fault");
    expect((await deps.publications.save(transition.before)).ok).toBe(true);
    const outbox = createD1PublicationDeliveryAuditOutbox(
      drizzle(proxy.env.DB, { schema }),
    );
    await proxy.env.DB.prepare(
      "ALTER TABLE publication_delivery_audit_outbox RENAME TO publication_delivery_audit_outbox_unavailable",
    ).run();
    try {
      const settled = await outbox.settle(
        transition.before,
        transition.after,
        transition.audit,
      );
      expect(settled.ok).toBe(false);
      const state = await proxy.env.DB.prepare("SELECT state FROM publications WHERE id = ?")
        .bind(transition.before.id)
        .first<{ state: string }>();
      expect(state?.state).toBe("SENDING");
    } finally {
      await proxy.env.DB.prepare(
        "ALTER TABLE publication_delivery_audit_outbox_unavailable RENAME TO publication_delivery_audit_outbox",
      ).run();
    }
  });

  it("workspace/targetが合わないintentはtriggerがfail-closedで全体rollbackする", async () => {
    const transition = deliveryTransition("mismatch");
    expect((await deps.publications.save(transition.before)).ok).toBe(true);
    const outbox = createD1PublicationDeliveryAuditOutbox(
      drizzle(proxy.env.DB, { schema }),
    );
    const mismatched: PublicationDeliveryAudit = {
      ...transition.audit,
      targetId: "another-publication",
    };

    const settled = await outbox.settle(
      transition.before,
      transition.after,
      mismatched,
    );
    expect(settled.ok).toBe(false);
    const row = await proxy.env.DB.prepare(
      "SELECT state, last_delivery_audit_id AS auditId FROM publications WHERE id = ?",
    )
      .bind(transition.before.id)
      .first<{ state: string; auditId: string | null }>();
    expect(row).toEqual({ state: "SENDING", auditId: null });
    expect(
      await proxy.env.DB.prepare(
        "SELECT id FROM publication_delivery_audit_outbox WHERE id = ?",
      )
        .bind(transition.audit.id)
        .first(),
    ).toBeNull();
  });

  it("同じ監査IDに異なるpayloadが先在すると配送済みにせずpendingを保つ", async () => {
    const transition = deliveryTransition("audit-id-collision");
    expect((await deps.publications.save(transition.before)).ok).toBe(true);
    const outbox = createD1PublicationDeliveryAuditOutbox(
      drizzle(proxy.env.DB, { schema }),
    );
    expect(
      (await outbox.settle(transition.before, transition.after, transition.audit)).ok,
    ).toBe(true);
    await proxy.env.DB.prepare(
      `INSERT INTO audit_logs
        (id, workspace_id, action, actor_user_id, actor_is_ai, actor_identified,
         actor_model_id, target_type, target_id, before_json, after_json, reason,
         request_id, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL, NULL, NULL, ?)`,
    )
      .bind(
        transition.audit.id,
        SAMPLE_WORKSPACE_ID,
        "publication.delivery_changed",
        "system:distribution-scheduler",
        0,
        0,
        "publication",
        "wrong-target",
        transition.audit.occurredAt.getTime() / 1_000,
      )
      .run();

    expect((await outbox.flush(20)).ok).toBe(false);
    const pending = await proxy.env.DB.prepare(
      "SELECT delivered_at AS deliveredAt FROM publication_delivery_audit_outbox WHERE id = ?",
    )
      .bind(transition.audit.id)
      .first<{ deliveredAt: number | null }>();
    expect(pending?.deliveredAt).toBeNull();
  });

  it("audit_logs障害後もpendingを保ち、復旧後は監査だけを配送する", async () => {
    const transition = deliveryTransition("flush-retry");
    expect((await deps.publications.save(transition.before)).ok).toBe(true);
    const outbox = createD1PublicationDeliveryAuditOutbox(
      drizzle(proxy.env.DB, { schema }),
    );
    expect(
      (await outbox.settle(transition.before, transition.after, transition.audit)).ok,
    ).toBe(true);

    await proxy.env.DB.prepare("ALTER TABLE audit_logs RENAME TO audit_logs_unavailable").run();
    try {
      expect((await outbox.flush(20)).ok).toBe(false);
      const publication = await proxy.env.DB.prepare(
        "SELECT state FROM publications WHERE id = ?",
      )
        .bind(transition.before.id)
        .first<{ state: string }>();
      expect(publication?.state).toBe("PUBLISHED");
      const pending = await proxy.env.DB.prepare(
        "SELECT delivered_at AS deliveredAt FROM publication_delivery_audit_outbox WHERE id = ?",
      )
        .bind(transition.audit.id)
        .first<{ deliveredAt: number | null }>();
      expect(pending?.deliveredAt).toBeNull();
    } finally {
      await proxy.env.DB.prepare("ALTER TABLE audit_logs_unavailable RENAME TO audit_logs").run();
    }

    expect(await outbox.flush(20)).toEqual({
      ok: true,
      value: { scanned: 1, delivered: 1, pending: 0 },
    });
    const count = await proxy.env.DB.prepare("SELECT count(*) AS n FROM audit_logs WHERE id = ?")
      .bind(transition.audit.id)
      .first<{ n: number }>();
    expect(count?.n).toBe(1);
  });
});

describe("予約が保存される（読み直して確かめる）", () => {
  it("見本だけの記事は外部予約を成功させず、D1へ本文を保存した版だけを固定する", async () => {
    const variantId = taggedString<"ContentVariantId">(APPROVED_VARIANT) as ContentVariantId;
    const sampleOnly = await deps.variants.findVersionedById(publisher.workspaceId, variantId);
    if (!sampleOnly.ok || sampleOnly.value === null) throw new Error("承認済み見本がありません");
    expect(sampleOnly.value.persisted).toBe(false);

    // 接続を探す前に、D1の原子的版照合ができない理由で明示的に止める。
    const blocked = await schedule().execute(publisher, {
      variantId: APPROVED_VARIANT,
      channelKind: "bluesky",
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.message).toContain("見本");

    const persisted = await deps.variants.save(sampleOnly.value.variant);
    if (!persisted.ok) throw persisted.error;
    const stored = await deps.variants.findVersionedById(publisher.workspaceId, variantId);
    if (!stored.ok || stored.value === null) throw new Error("保存した記事がありません");
    expect(stored.value.persisted).toBe(true);
    expect(stored.value.revision).toBe(sampleOnly.value.revision + 1);

    const connection = aChannelConnection({
      id: "conn_revision_pinned" as never,
      workspaceId: publisher.workspaceId,
      kind: "bluesky",
      providerIdentity: "did:plc:revision-pinned",
    });
    const externalDeps: ManageDistributionDeps = {
      ...deps,
      connections: {
        ...deps.connections,
        findById: async (_workspaceId, id) =>
          ok(String(id) === String(connection.id) ? connection : null),
        listByWorkspace: async () => ok({ items: [connection], nextCursor: null }),
      },
      connectors: {
        forConnection: () =>
          ok({
            kind: "bluesky" as const,
            resolveIdentity: async () =>
              ok({
                providerIdentity: "did:plc:revision-pinned",
                accountLabel: "@revision-pinned.test",
              }),
            checkReadiness: async () => ok(true),
            prepareDeliveryKey: async () => ok("3m4revisionpinned"),
            validate: async () => ok([]),
            publish: async () =>
              ok({ externalId: "at://did:plc:test/post/1", externalUrl: null, publishedAt: new Date() }),
            unpublish: async () => ok(true),
          }),
      },
    };
    const scheduled = await createSchedulePublicationUseCase(externalDeps).execute(publisher, {
      variantId: APPROVED_VARIANT,
      channelKind: "bluesky",
      connectionId: String(connection.id),
      scheduledAt: future(2),
    });
    expect(scheduled.ok, scheduled.ok ? "" : scheduled.error.message).toBe(true);
    if (!scheduled.ok) return;
    const row = await proxy.env.DB.prepare(
      "select variant_revision from publications where id = ?",
    )
      .bind(scheduled.value.card.publicationId)
      .first<{ variant_revision: number | null }>();
    expect(row?.variant_revision).toBe(stored.value.revision);
  });

  it("予約したものが、次に読み直したときも残っている", async () => {
    const at = future(3);
    const made = await schedule().execute(publisher, {
      variantId: APPROVED_VARIANT,
      channelKind: "own_site",
      scheduledAt: at,
    });
    expect(made.ok, made.ok ? "" : made.error.message).toBe(true);
    if (!made.ok) return;
    expect(made.value.alreadyExisted).toBe(false);
    const id = made.value.card.publicationId;

    // 返り値ではなく**保存先から読み直す**。返り値だけを見ると、
    // 保存が落ちていても「作れた」と読めてしまう。
    const rows = await proxy.env.DB.prepare(
      "select id, state from publications where id = ?",
    )
      .bind(id)
      .all<{ id: string; state: string }>();
    expect(rows.results).toHaveLength(1);

    const listed = await list().execute(publisher, {});
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.items.some((c) => c.publicationId === id)).toBe(true);
  });

  it("同じ予約をもう一度出しても、2 件にならず「すでにあります」で返る", async () => {
    const at = future(4);
    const first = await schedule().execute(publisher, {
      variantId: APPROVED_VARIANT,
      channelKind: "own_site",
      scheduledAt: at,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await schedule().execute(publisher, {
      variantId: APPROVED_VARIANT,
      channelKind: "own_site",
      scheduledAt: at,
    });
    // **失敗にしない。** ここが失敗になると、二重クリックした人に
    // 「エラーだからもう一度」と読ませ、余計に押させることになる。
    expect(second.ok, second.ok ? "" : second.error.message).toBe(true);
    if (!second.ok) return;
    expect(second.value.alreadyExisted).toBe(true);
    expect(second.value.card.publicationId).toBe(first.value.card.publicationId);

    const rows = await proxy.env.DB.prepare("select count(*) as n from publications").all<{
      n: number;
    }>();
    expect(rows.results[0]?.n).toBe(1);
  });

  it("同じ予約が同時に来ても、両方成功して保存先は1件だけになる", async () => {
    const at = future(4);
    const [first, second] = await Promise.all([
      schedule().execute(publisher, {
        variantId: APPROVED_VARIANT,
        channelKind: "own_site",
        scheduledAt: at,
      }),
      schedule().execute(publisher, {
        variantId: APPROVED_VARIANT,
        channelKind: "own_site",
        scheduledAt: at,
      }),
    ]);

    expect(first.ok, first.ok ? "" : first.error.message).toBe(true);
    expect(second.ok, second.ok ? "" : second.error.message).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.card.publicationId).toBe(second.value.card.publicationId);
    expect([first.value.alreadyExisted, second.value.alreadyExisted].sort()).toEqual([
      false,
      true,
    ]);

    const rows = await proxy.env.DB.prepare(
      "select count(*) as n from publications where workspace_id = ? and idempotency_key = ?",
    )
      .bind(SAMPLE_WORKSPACE_ID, `${APPROVED_VARIANT}:r1:own_site:${at}`)
      .all<{ n: number }>();
    expect(rows.results[0]?.n).toBe(1);
  });

  it("取りやめが保存され、読み直しても取りやめのまま（見本に戻らない）", async () => {
    const made = await schedule().execute(publisher, {
      variantId: APPROVED_VARIANT,
      channelKind: "own_site",
      scheduledAt: future(5),
    });
    expect(made.ok).toBe(true);
    if (!made.ok) return;

    const stopped = await cancel().execute(publisher, { publicationId: made.value.card.publicationId });
    expect(stopped.ok, stopped.ok ? "" : stopped.error.message).toBe(true);

    const rows = await proxy.env.DB.prepare("select state from publications where id = ?")
      .bind(made.value.card.publicationId)
      .all<{ state: string }>();
    expect(rows.results[0]?.state).toBe("CANCELLED");

    // 状態が進んでも行が増えない（上書きであって、追記ではない）。
    const count = await proxy.env.DB.prepare("select count(*) as n from publications").all<{
      n: number;
    }>();
    expect(count.results[0]?.n).toBe(1);
  });

  it("予定日の変更が保存先に届く", async () => {
    const made = await schedule().execute(publisher, {
      variantId: APPROVED_VARIANT,
      channelKind: "own_site",
      scheduledAt: future(6),
    });
    expect(made.ok).toBe(true);
    if (!made.ok) return;

    // 画面の日時欄が渡してくる形（`YYYY-MM-DDTHH:mm`、地域時刻・時差表記なし）。
    const localInput = "2027-03-05T09:30";
    const changed = await reschedule().execute(publisher, {
      publicationId: made.value.card.publicationId,
      scheduledAt: localInput,
    });
    expect(changed.ok, changed.ok ? "" : changed.error.message).toBe(true);

    const rows = await proxy.env.DB.prepare(
      "select scheduled_at from publications where id = ?",
    )
      .bind(made.value.card.publicationId)
      .all<{ scheduled_at: number }>();
    expect(rows.results).toHaveLength(1);
    // 保存先の日時は**秒**で入っている（`mode: "timestamp"`）。
    // 取り違えると 1970 年の日付になるが、読むときも drizzle が同じ換算を
    // するので画面からは気づけない。だから生の値で確かめる。
    //
    // 比べる相手は、時差表記の無い入力を**その端末の地域時刻として読んだ結果**。
    // 画面の日時欄が地域時刻を渡してくるので、これが正しい読み方であり、
    // ここを UTC として読むと、予約が数時間ずれたまま誰も気づかない。
    expect(Number(rows.results[0]?.scheduled_at) * 1000).toBe(new Date(localInput).getTime());
  });

  it("送信失敗を人手で再予約するとretry時刻でworkerに拾われる", async () => {
    const publication = aPublication({
      id: "manual_retry_due" as PublicationId,
      workspaceId: SAMPLE_WORKSPACE_ID,
      variantId: APPROVED_VARIANT as ContentVariantId,
      channelKind: "bluesky",
      connectionId: "conn_retry" as never,
      state: "FAILED_SEND",
      scheduledAt: new Date("2026-08-26T00:00:00Z"),
      retryAt: null,
      attempts: 1,
      lastError: "一時失敗",
      publishedAt: null,
    });
    expect((await deps.publications.save(publication)).ok).toBe(true);
    const retryAt = future(2);

    const changed = await reschedule().execute(publisher, {
      publicationId: String(publication.id),
      scheduledAt: retryAt,
    });
    expect(changed.ok, changed.ok ? "" : changed.error.message).toBe(true);

    // D1のtimestamp列は秒精度なので、境界の1秒前で未到達を確かめる。
    const beforeDue = await deps.publications.listDue(new Date(new Date(retryAt).getTime() - 1_000), 20);
    const afterDue = await deps.publications.listDue(new Date(new Date(retryAt).getTime() + 1), 20);
    expect(beforeDue.ok && afterDue.ok).toBe(true);
    if (!beforeDue.ok || !afterDue.ok) return;
    expect(beforeDue.value.map((item) => item.id)).not.toContain(publication.id);
    expect(afterDue.value.map((item) => item.id)).toContain(publication.id);
  });
});

describe("見本との重ね置き", () => {
  it("まだ 1 件も予約していなくても、一覧とカレンダーが空にならない", async () => {
    const listed = await list().execute(publisher, {});
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    // 空だと「まだ出していない」のか「壊れている」のかを見分けられない。
    expect(listed.value.items.length).toBeGreaterThan(0);

    const view = await calendar().execute(publisher, { month: "2026-08" });
    expect(view.ok).toBe(true);
  });

  it("保存したものが見本より優先される（同じ id を書き戻しても元へ戻らない）", async () => {
    const listed = await list().execute(publisher, {});
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const sample = listed.value.items.find((c) => c.state !== "PUBLISHED" && c.state !== "CANCELLED");
    expect(sample, "取りやめられる見本が 1 件もありません").toBeDefined();
    if (sample === undefined) return;

    const stopped = await cancel().execute(publisher, { publicationId: sample.publicationId });
    expect(stopped.ok, stopped.ok ? "" : stopped.error.message).toBe(true);

    const again = await list().execute(publisher, {});
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    // ここが元の状態に戻ると、「取りやめたはずのものが復活する」という
    // いちばん気づきにくい壊れになる。
    expect(again.value.items.find((c) => c.publicationId === sample.publicationId)?.state).toBe("CANCELLED");
    // 重ねた結果、同じ id が 2 件並ばないこと。
    expect(again.value.items.filter((c) => c.publicationId === sample.publicationId)).toHaveLength(1);
  });
});

describe("ブランド範囲と取得上限の順序", () => {
  it("保存先は担当ブランドで絞ってからlimitを適用する", async () => {
    const allowedBrand = taggedString<"BrandId">("brand-scope-allowed") as BrandId;
    const outsideBrand = taggedString<"BrandId">("brand-scope-outside") as BrandId;
    await saveBrandPublication({
      suffix: "outside",
      brandId: outsideBrand,
      scheduledAt: new Date("2026-08-22T00:00:00Z"),
    });
    const allowed = await saveBrandPublication({
      suffix: "allowed",
      brandId: allowedBrand,
      scheduledAt: new Date("2026-08-20T00:00:00Z"),
    });

    const listed = await deps.publications.listRecent(SAMPLE_WORKSPACE_ID, 1, {
      brandIds: [allowedBrand],
    });

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.map((publication) => publication.id)).toEqual([allowed.id]);

    const calendarRows = await deps.publications.listForCalendar(
      SAMPLE_WORKSPACE_ID,
      new Date("2026-08-01T00:00:00Z"),
      new Date("2026-09-01T00:00:00Z"),
      { brandIds: [allowedBrand] },
    );
    expect(calendarRows.ok).toBe(true);
    if (!calendarRows.ok) return;
    expect(calendarRows.value.map((publication) => publication.id)).toEqual([allowed.id]);
  });
});

describe("接続のページング", () => {
  it("cursorをたどると100件を超える接続を決定的な順序で全件読める", async () => {
    const statements = Array.from({ length: 105 }, (_, index) =>
      proxy.env.DB.prepare(
        `INSERT INTO channel_connections
          (id, workspace_id, kind, account_label, connected_at, expires_at, revoked_at, credential_ref)
         VALUES (?, ?, 'x', ?, ?, NULL, NULL, ?)`,
      ).bind(
        `conn_page_${String(index).padStart(3, "0")}`,
        SAMPLE_WORKSPACE_ID,
        `@page_${String(index).padStart(3, "0")}`,
        1_787_740_800,
        `credential/page/${String(index).padStart(3, "0")}`,
      ),
    );
    statements.push(
      proxy.env.DB.prepare(
        `INSERT INTO channel_connections
          (id, workspace_id, kind, account_label, connected_at, expires_at, revoked_at, credential_ref)
         VALUES (?, ?, 'x', ?, ?, NULL, NULL, ?)`,
      ).bind(
        "conn_Z_binary",
        SAMPLE_WORKSPACE_ID,
        "@binary_upper",
        1_787_740_800,
        "credential/page/binary-upper",
      ),
      proxy.env.DB.prepare(
        `INSERT INTO channel_connections
          (id, workspace_id, kind, account_label, connected_at, expires_at, revoked_at, credential_ref)
         VALUES (?, ?, 'x', ?, ?, NULL, NULL, ?)`,
      ).bind(
        "conn_a_binary",
        SAMPLE_WORKSPACE_ID,
        "@binary_lower",
        1_787_740_800,
        "credential/page/binary-lower",
      ),
    );
    await proxy.env.DB.batch(statements);

    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await deps.connections.listByWorkspace(SAMPLE_WORKSPACE_ID, {
        limit: 40,
        cursor,
      });
      expect(page.ok).toBe(true);
      if (!page.ok) return;
      ids.push(...page.value.items.map((connection) => String(connection.id)));
      cursor = page.value.nextCursor;
    } while (cursor !== null);

    expect(ids.filter((id) => id.startsWith("conn_page_"))).toHaveLength(105);
    // sort と cursor 比較で同じ順序規則を使う。locale順とbinary順を混ぜると
    // 大文字IDが前ページへ逆戻りした扱いになり、まだ返していないのに欠落する。
    expect(ids).toContain("conn_Z_binary");
    expect(ids).toContain("conn_a_binary");
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort());
  });
});

describe("外部配信の保存境界", () => {
  it("provider record時刻を往復保存し、workspace先頭の監査pending indexを持つ", async () => {
    const providerRecordCreatedAt = new Date("2026-08-27T03:04:05Z");
    const publication = aPublication({
      id: "provider_record_created_at" as PublicationId,
      workspaceId: SAMPLE_WORKSPACE_ID,
      variantId: APPROVED_VARIANT as ContentVariantId,
      idempotencyKey: "provider-record-created-at",
      channelKind: "bluesky",
      connectionId: "conn_provider_record_created_at" as never,
      providerIdentity: "did:plc:provider-record-created-at",
      providerDeliveryKey: "3m4exampletid",
      providerRecordCreatedAt,
    });

    expect((await deps.publications.save(publication)).ok).toBe(true);
    const restored = await deps.publications.findById(
      SAMPLE_WORKSPACE_ID,
      publication.id,
    );
    expect(restored.ok && restored.value?.providerRecordCreatedAt).toEqual(
      providerRecordCreatedAt,
    );

    const index = await proxy.env.DB.prepare(
      "PRAGMA index_info('publication_delivery_audit_outbox_workspace_pending_idx')",
    ).all<{ seqno: number; name: string }>();
    expect(
      index.results
        .sort((left, right) => left.seqno - right.seqno)
        .map((column) => column.name),
    ).toEqual(["workspace_id", "delivered_at", "committed_at", "occurred_at"]);
  });
});
