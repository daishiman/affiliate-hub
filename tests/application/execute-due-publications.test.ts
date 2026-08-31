/**
 * @tier 1
 * @req REQ-A06
 * @types state-transition, boundary, equivalence, audit-log, tenant-isolation, fault-injection
 */
import { describe, expect, it } from "vitest";
import type {
  ChannelConnectionRepositoryPort,
  ChannelConnectorPort,
  ChannelConnectorProviderPort,
  ChannelPublishInput,
  PublicationDeliveryAuditOutboxPort,
  PublicationRepositoryPort,
} from "@/application/ports";
import {
  executeDuePublications,
  flushPublicationDeliveryAudits,
} from "@/application/usecases/distribution/execute-due-publications";
import { createSamplePublicationDeliveryAuditOutbox } from "@/infrastructure/persistence/sample/publication-delivery-audit-outbox";
import type { ContentVariant } from "@/domain/authoring";
import type { ChannelConnection, Publication } from "@/domain/distribution";
import { MAX_SEND_ATTEMPTS, samePublicationVersion } from "@/domain/distribution";
import { ok } from "@/domain/shared";
import type {
  ChannelConnectionId,
  ContentPackageId,
  ContentVariantId,
  PublicationId,
  WorkspaceId,
} from "@/domain/shared";
import { aChannelConnection, aPublication } from "../support/factories";
import { recordingAuditLog, testDeps } from "../support/doubles";

const AT = new Date("2026-08-27T03:04:05.678Z");
const WORKSPACE = "ws_delivery" as WorkspaceId;
const OTHER_WORKSPACE = "ws_other" as WorkspaceId;
const CONNECTION_ID = "conn_bluesky" as ChannelConnectionId;
const VARIANT_ID = "cv_delivery" as ContentVariantId;

function variant(over: Partial<ContentVariant> = {}): ContentVariant {
  return {
    id: VARIANT_ID,
    workspaceId: WORKSPACE,
    contentPackageId: "cp_delivery" as ContentPackageId,
    channel: "bluesky",
    format: "post",
    authorPersonaId: "author_test" as never,
    audiencePersonaId: "audience_test" as never,
    angle: "comparison_first",
    title: null,
    body: "比較した結果、今回はこの製品を選びました。",
    summary: "要約",
    cta: "view_comparison",
    disclosure: "広告",
    affiliateLinkIds: [],
    claimIds: ["claim_test" as never],
    evidenceIds: ["evidence_test" as never],
    assumptions: [],
    platformWarnings: [],
    factualityScore: 1,
    personaFitScore: 1,
    channelFitScore: 1,
    complianceStatus: "pass",
    generationPromptVersion: "test",
    modelId: "test",
    status: "approved",
    ...over,
  };
}

function queued(over: Partial<Publication> = {}): Publication {
  return aPublication({
    id: "pub_delivery" as PublicationId,
    workspaceId: WORKSPACE,
    variantId: VARIANT_ID,
    channelKind: "bluesky",
    connectionId: CONNECTION_ID,
    state: "QUEUED",
    scheduledAt: new Date(AT.getTime() - 1_000),
    retryAt: null,
    deliveryLeaseUntil: null,
    providerDeliveryKey: null,
    attempts: 0,
    publishedAt: null,
    ...over,
  });
}

/** 何も邪魔しないコネクタ。1 か所だけ壊して試すための土台。 */
function workingConnector(): ChannelConnectorPort {
  return {
    kind: "bluesky",
    resolveIdentity: async () =>
      ok({ providerIdentity: "did:plc:test", accountLabel: "@test.example" }),
    checkReadiness: async () => ok(true),
    prepareDeliveryKey: async () => ok("3m4exampletid"),
    validate: async () => ok([]),
    publish: async () =>
      ok({
        externalId: "at://did:plc:test/app.bsky.feed.post/3m4exampletid",
        externalUrl: null,
        publishedAt: AT,
      }),
    unpublish: async () => ok(true),
  };
}

function memoryPublications(
  initial: Publication[],
  currentVariantRevision: () => number | null = () => 1,
) {
  const rows = new Map(initial.map((item) => [item.id, item]));
  const base = testDeps().publications;
  const port: PublicationRepositoryPort = {
    ...base,
    async listDue(at, limit) {
      return ok(
        [...rows.values()]
          .filter((item) =>
            (item.state === "QUEUED" && (item.scheduledAt === null || item.scheduledAt <= at)) ||
            (item.state === "RETRY_SCHEDULED" && item.retryAt !== null && item.retryAt <= at) ||
            (item.state === "SENDING" &&
              item.deliveryLeaseUntil !== null &&
              item.deliveryLeaseUntil <= at),
          )
          .slice(0, limit),
      );
    },
    async compareAndSwap(before, claimed) {
      const current = rows.get(before.id);
      if (current === undefined || !samePublicationVersion(current, before)) return ok(null);
      rows.set(claimed.id, claimed);
      return ok(claimed);
    },
    async claimForDelivery(before, claimed) {
      if (
        before.variantRevision === null ||
        before.variantRevision !== currentVariantRevision()
      ) {
        return ok(null);
      }
      return this.compareAndSwap(before, claimed);
    },
    async save(item) {
      rows.set(item.id, item);
      return ok(item);
    },
  };
  return {
    port,
    get: (id: PublicationId) => rows.get(id),
    currentVariantRevision,
  };
}

function setup(input: {
  publications: ReturnType<typeof memoryPublications>;
  connector?: ChannelConnectorPort;
  connection?: ChannelConnection | null;
  content?: ContentVariant | null;
}) {
  const base = testDeps();
  const audit = recordingAuditLog();
  const publishInputs: unknown[] = [];
  const connector: ChannelConnectorPort =
    input.connector ??
    ({
      kind: "bluesky",
      resolveIdentity: async () =>
        ok({ providerIdentity: "did:plc:test", accountLabel: "@test.example" }),
      checkReadiness: async () => ok(true),
      prepareDeliveryKey: async () => ok("3m4exampletid"),
      validate: async () => ok([]),
      publish: async (value) => {
        publishInputs.push(value);
        return ok({
          externalId: "at://did:plc:test/app.bsky.feed.post/3m4exampletid",
          externalUrl: "https://bsky.app/profile/did:plc:test/post/3m4exampletid",
          publishedAt: AT,
        });
      },
      unpublish: async () => ok(true),
    } satisfies ChannelConnectorPort);
  const connection =
    input.connection === undefined
      ? aChannelConnection({
          id: CONNECTION_ID,
          workspaceId: WORKSPACE,
          kind: "bluesky",
          providerIdentity: "did:plc:test",
          credentialRef: "channel/conn_bluesky/credentials",
        })
      : input.connection;
  const provider: ChannelConnectorProviderPort = {
    forConnection: () => ok(connector),
  };
  const lookedUpWorkspaces: WorkspaceId[] = [];
  let providerLease: {
    readonly identity: string;
    readonly holder: PublicationId;
    readonly token: string;
    readonly expiresAt: Date;
  } | null = null;
  let leaseSequence = 0;
  let auditWritable = true;
  const deliveryAudits: PublicationDeliveryAuditOutboxPort =
    createSamplePublicationDeliveryAuditOutbox({
      publications: input.publications.port,
      auditLog: {
        ...audit.port,
        append: (entry) =>
          auditWritable
            ? audit.port.append(entry)
            : Promise.resolve({
                ok: false as const,
                error: {
                  code: "UPSTREAM_UNAVAILABLE" as const,
                  message: "audit unavailable",
                  retryable: true,
                },
              }),
      },
    });
  return {
    deps: {
      publications: input.publications.port,
      connections: {
        ...base.channelConnections,
        async findById(workspaceId: WorkspaceId) {
          lookedUpWorkspaces.push(workspaceId);
          return ok(connection?.workspaceId === workspaceId ? connection : null);
        },
        async acquireProviderDeliveryLease(
          lease: Parameters<ChannelConnectionRepositoryPort["acquireProviderDeliveryLease"]>[0],
        ) {
          if (
            providerLease !== null &&
            providerLease.identity === lease.providerIdentity &&
            providerLease.expiresAt > lease.at
          ) {
            return ok(null);
          }
          leaseSequence += 1;
          const token = `test-provider-lease-${leaseSequence}`;
          providerLease = {
            identity: lease.providerIdentity,
            holder: lease.holderPublicationId,
            token,
            expiresAt: lease.expiresAt,
          };
          return ok(token);
        },
        async releaseProviderDeliveryLease(
          lease: Parameters<ChannelConnectionRepositoryPort["releaseProviderDeliveryLease"]>[0],
        ) {
          const current = providerLease;
          if (
            current?.identity === lease.providerIdentity &&
            current.holder === lease.holderPublicationId &&
            current.token === lease.leaseToken
          ) {
            providerLease = null;
          }
          return ok(undefined);
        },
      },
      variants: {
        ...base.contentVariants,
        async findById(workspaceId: WorkspaceId) {
          const content = input.content === undefined ? variant() : input.content;
          return ok(content?.workspaceId === workspaceId ? content : null);
        },
        async findVersionedById(workspaceId: WorkspaceId) {
          const content = input.content === undefined ? variant() : input.content;
          const revision = input.publications.currentVariantRevision();
          return ok(
            content?.workspaceId === workspaceId && revision !== null
              ? { variant: content, revision, persisted: true }
              : null,
          );
        },
      },
      connectors: provider,
      deliveryAudits,
      ids: base.ids,
    },
    audit,
    setAuditWritable(value: boolean) {
      auditWritable = value;
    },
    publishInputs,
    lookedUpWorkspaces,
  };
}

describe("予約された外部配信の実行", () => {
  it("dueを原子的に1件へclaimし、成功状態と監査outboxを同時に残す", async () => {
    const publications = memoryPublications([queued()]);
    const scenario = setup({ publications });

    const result = await executeDuePublications(scenario.deps, { at: AT, limit: 20 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ scanned: 1, claimed: 1, published: 1, failed: 0 });
    expect(scenario.publishInputs).toHaveLength(1);
    expect(publications.get("pub_delivery" as PublicationId)).toMatchObject({
      state: "PUBLISHED",
      attempts: 1,
      providerDeliveryKey: "3m4exampletid",
      deliveryLeaseUntil: null,
    });
    expect(scenario.audit.entries()).toHaveLength(0);
    const flushed = await flushPublicationDeliveryAudits(
      { deliveryAudits: scenario.deps.deliveryAudits },
      { limit: 20 },
    );
    expect(flushed.ok).toBe(true);
    if (flushed.ok) expect(flushed.value).toEqual({ scanned: 1, delivered: 1, pending: 0 });
    const audit = scenario.audit.entries().at(-1);
    expect(audit?.action).toBe("publication.delivery_changed");
    expect(audit?.actor).toEqual({
      userId: "system:distribution-scheduler",
      isAiServiceAccount: false,
      modelId: null,
      identified: false,
    });
    expect(audit?.requestId).toBeNull();
  });

  it("日時指定なしの即時配信も次のworker実行で送る", async () => {
    const publications = memoryPublications([queued({ scheduledAt: null })]);
    const scenario = setup({ publications });

    const result = await executeDuePublications(scenario.deps, { at: AT, limit: 20 });

    expect(result.ok).toBe(true);
    expect(scenario.publishInputs).toHaveLength(1);
    expect(publications.get("pub_delivery" as PublicationId)?.state).toBe("PUBLISHED");
  });

  it("即時配信のprovider record時刻は初回claimで固定し、応答喪失後のretryでも変えない", async () => {
    const publications = memoryPublications([
      queued({ scheduledAt: null, providerRecordCreatedAt: null }),
    ]);
    const sent: ChannelPublishInput[] = [];
    const connector: ChannelConnectorPort = {
      kind: "bluesky",
      resolveIdentity: async () =>
        ok({ providerIdentity: "did:plc:test", accountLabel: "@test.example" }),
      checkReadiness: async () => ok(true),
      prepareDeliveryKey: async () => ok("3m4exampletid"),
      validate: async () => ok([]),
      publish: async (value) => {
        sent.push(value);
        if (sent.length === 1) {
          return {
            ok: false,
            error: {
              code: "UPSTREAM_UNAVAILABLE",
              message: "provider応答を受け取れませんでした。",
              retryable: true,
            },
          };
        }
        return ok({
          externalId: "at://did:plc:test/app.bsky.feed.post/3m4exampletid",
          externalUrl: null,
          publishedAt: new Date(AT.getTime() + 120_000),
        });
      },
      unpublish: async () => ok(true),
    };
    const scenario = setup({ publications, connector });

    await executeDuePublications(scenario.deps, { at: AT, limit: 20 });
    const afterLoss = publications.get("pub_delivery" as PublicationId);
    const retryAt = afterLoss?.retryAt;
    expect(retryAt).not.toBeNull();
    if (retryAt === null || retryAt === undefined) return;
    await executeDuePublications(scenario.deps, {
      at: new Date(retryAt.getTime() + 1),
      limit: 20,
    });

    expect(sent).toHaveLength(2);
    expect(sent.map((item) => item.providerRecordCreatedAt?.toISOString())).toEqual([
      AT.toISOString(),
      AT.toISOString(),
    ]);
    expect(
      publications.get("pub_delivery" as PublicationId)?.providerRecordCreatedAt,
    ).toEqual(AT);
  });

  it("同じdueが重複して見えてもCASの勝者だけがproviderへ送る", async () => {
    const publication = queued();
    const publications = memoryPublications([publication]);
    const duplicateListing: PublicationRepositoryPort = {
      ...publications.port,
      listDue: async () => ok([publication, publication]),
    };
    const scenario = setup({ publications: { ...publications, port: duplicateListing } });

    const result = await executeDuePublications(scenario.deps, { at: AT, limit: 20 });
    expect(result.ok).toBe(true);
    expect(scenario.publishInputs).toHaveLength(1);
  });

  it("同じDIDを処理する複数Workerはprovider通信を並列にせず、lease解放後に続行する", async () => {
    const first = queued({
      id: "pub_delivery_first" as PublicationId,
      idempotencyKey: "delivery-first",
    });
    const second = queued({
      id: "pub_delivery_second" as PublicationId,
      idempotencyKey: "delivery-second",
    });
    const publications = memoryPublications([first, second]);
    let releaseFirst!: () => void;
    const firstMayFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let notifyStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      notifyStarted = resolve;
    });
    let active = 0;
    let maxActive = 0;
    let sends = 0;
    let readinessChecks = 0;
    const connector: ChannelConnectorPort = {
      kind: "bluesky",
      resolveIdentity: async () =>
        ok({ providerIdentity: "did:plc:test", accountLabel: "@test.example" }),
      checkReadiness: async () => {
        readinessChecks += 1;
        return ok(true);
      },
      prepareDeliveryKey: async () => ok(`delivery-key-${sends + 1}`),
      validate: async () => ok([]),
      async publish() {
        sends += 1;
        active += 1;
        maxActive = Math.max(maxActive, active);
        if (sends === 1) {
          notifyStarted();
          await firstMayFinish;
        }
        active -= 1;
        return ok({
          externalId: `at://did:plc:test/app.bsky.feed.post/delivery-key-${sends}`,
          externalUrl: null,
          publishedAt: AT,
        });
      },
      unpublish: async () => ok(true),
    };
    const scenario = setup({ publications, connector });

    const firstWorker = executeDuePublications(scenario.deps, { at: AT, limit: 20 });
    await firstStarted;
    const competingWorker = await executeDuePublications(scenario.deps, { at: AT, limit: 20 });
    releaseFirst();
    const completed = await firstWorker;

    expect(competingWorker.ok && competingWorker.value.claimed).toBe(0);
    expect(completed.ok).toBe(true);
    expect(sends).toBe(2);
    expect(maxActive).toBe(1);
    expect(readinessChecks, "lease敗者がprovider readinessへ通信しています").toBe(2);
  });

  it("claim直前に取りやめが勝ったら外部へ送らない", async () => {
    const candidate = queued();
    const publications = memoryPublications([candidate]);
    let firstCas = true;
    const racingPort: PublicationRepositoryPort = {
      ...publications.port,
      async compareAndSwap(before, next) {
        if (firstCas) {
          firstCas = false;
          await publications.port.save({ ...before, state: "CANCELLED" });
        }
        return publications.port.compareAndSwap(before, next);
      },
    };
    const scenario = setup({ publications: { ...publications, port: racingPort } });

    const result = await executeDuePublications(scenario.deps, { at: AT, limit: 20 });

    expect(result.ok).toBe(true);
    expect(scenario.publishInputs).toHaveLength(0);
    expect(publications.get(candidate.id)?.state).toBe("CANCELLED");
  });

  it("claim直前に接続変更が勝ったら古い接続へ送らない", async () => {
    const candidate = queued();
    const publications = memoryPublications([candidate]);
    const newerConnectionId = "conn-bluesky-new" as ChannelConnectionId;
    let firstCas = true;
    const racingPort: PublicationRepositoryPort = {
      ...publications.port,
      async compareAndSwap(before, next) {
        if (firstCas) {
          firstCas = false;
          await publications.port.save({ ...before, connectionId: newerConnectionId });
        }
        return publications.port.compareAndSwap(before, next);
      },
    };
    const scenario = setup({ publications: { ...publications, port: racingPort } });

    const result = await executeDuePublications(scenario.deps, { at: AT, limit: 20 });

    expect(result.ok).toBe(true);
    expect(scenario.publishInputs).toHaveLength(0);
    expect(publications.get(candidate.id)?.connectionId).toBe(newerConnectionId);
  });

  it("公開前確認後に本文の版が変わったらclaimせず、未承認の改版を外部へ送らない", async () => {
    let currentRevision = 1;
    const candidate = queued({ variantRevision: 1 });
    const publications = memoryPublications([candidate], () => currentRevision);
    const scenario = setup({ publications });
    const originalClaim = publications.port.claimForDelivery;
    const racingPort: PublicationRepositoryPort = {
      ...publications.port,
      async claimForDelivery(before, next) {
        // gate評価と外部送信権claimの間に、本文・表記・根拠などが改版された競合。
        currentRevision += 1;
        return originalClaim(before, next);
      },
    };

    const result = await executeDuePublications(
      { ...scenario.deps, publications: racingPort },
      { at: AT, limit: 20 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ claimed: 0, published: 0, failed: 1 });
    expect(scenario.publishInputs).toHaveLength(0);
    expect(publications.get(candidate.id)?.state).toBe("FAILED_VALIDATION");
  });

  it("版を持たない旧Publicationはfail-closedでclaimせず外部へ送らない", async () => {
    const candidate = queued({ variantRevision: null });
    const publications = memoryPublications([candidate]);
    const scenario = setup({ publications });

    const result = await executeDuePublications(scenario.deps, { at: AT, limit: 20 });

    expect(result.ok).toBe(true);
    expect(scenario.publishInputs).toHaveLength(0);
    expect(publications.get(candidate.id)?.state).toBe("FAILED_VALIDATION");
  });

  it("一時失敗は後刻へ再試行し、上限回の後は送信を増やさない", async () => {
    const publications = memoryPublications([queued()]);
    let sends = 0;
    const transient: ChannelConnectorPort = {
      kind: "bluesky",
      resolveIdentity: async () =>
        ok({ providerIdentity: "did:plc:test", accountLabel: "@test.example" }),
      checkReadiness: async () => ok(true),
      prepareDeliveryKey: async () => ok("3m4exampletid"),
      validate: async () => ok([]),
      publish: async () => {
        sends += 1;
        return {
          ok: false,
          error: {
            code: "UPSTREAM_UNAVAILABLE",
            message: "Blueskyへ一時的に接続できませんでした。",
            retryable: true,
          },
        };
      },
      unpublish: async () => ok(true),
    };
    const scenario = setup({ publications, connector: transient });
    let at = AT;
    for (let attempt = 0; attempt < MAX_SEND_ATTEMPTS + 2; attempt += 1) {
      await executeDuePublications(scenario.deps, { at, limit: 20 });
      const current = publications.get("pub_delivery" as PublicationId);
      at = new Date((current?.retryAt ?? at).getTime() + 1);
    }

    // **上限そのものを書き写す。**`MAX_SEND_ATTEMPTS` と突き合わせると、
    // 5 を 507 に変えても期待値が一緒に動いて緑のまま通る（実測、2026-08-28）。
    // 送り直しの回数は相手先へ掛ける負荷なので、いくらでも増やせては困る。
    expect(MAX_SEND_ATTEMPTS, "送り直しの上限回数が動いている").toBe(5);
    expect(sends).toBe(5);
    expect(publications.get("pub_delivery" as PublicationId)).toMatchObject({
      state: "FAILED_SEND",
      attempts: 5,
      retryAt: null,
      deliveryLeaseUntil: null,
    });
  });

  it("未来の予約は送らず、publication自身のworkspace以外で接続を探さない", async () => {
    const future = queued({ scheduledAt: new Date(AT.getTime() + 60_000) });
    const due = queued({ id: "pub_other" as PublicationId, workspaceId: OTHER_WORKSPACE });
    const publications = memoryPublications([future, due]);
    const scenario = setup({ publications });

    const result = await executeDuePublications(scenario.deps, { at: AT, limit: 20 });
    expect(result.ok).toBe(true);
    expect(scenario.publishInputs).toHaveLength(0);
    expect(scenario.lookedUpWorkspaces).toEqual([OTHER_WORKSPACE]);
    expect(publications.get(future.id)?.state).toBe("QUEUED");
    expect(publications.get(due.id)?.state).toBe("FAILED_VALIDATION");
  });

  it("MAX回目でworkerが保存前停止しても、期限切れleaseを同じkeyで回収して成功へ収束する", async () => {
    const stale = queued({
      state: "SENDING",
      attempts: MAX_SEND_ATTEMPTS,
      providerDeliveryKey: "3m4exampletid",
      deliveryLeaseUntil: new Date(AT.getTime() - 1),
    });
    const publications = memoryPublications([stale]);
    const scenario = setup({ publications });

    const result = await executeDuePublications(scenario.deps, { at: AT, limit: 20 });
    expect(result.ok).toBe(true);
    expect(scenario.publishInputs).toHaveLength(1);
    expect(publications.get(stale.id)).toMatchObject({
      state: "PUBLISHED",
      attempts: MAX_SEND_ATTEMPTS,
      providerDeliveryKey: "3m4exampletid",
    });
  });

  it("non-retryable失敗は1回で停止し、次のcronで再送しない", async () => {
    const publications = memoryPublications([queued()]);
    let sends = 0;
    const connector: ChannelConnectorPort = {
      kind: "bluesky",
      resolveIdentity: async () =>
        ok({ providerIdentity: "did:plc:test", accountLabel: "@test.example" }),
      checkReadiness: async () => ok(true),
      prepareDeliveryKey: async () => ok("3m4exampletid"),
      validate: async () => ok([]),
      publish: async () => {
        sends += 1;
        return {
          ok: false,
          error: { code: "VALIDATION_FAILED", message: "投稿内容を確認してください。", retryable: false },
        };
      },
      unpublish: async () => ok(true),
    };
    const scenario = setup({ publications, connector });
    await executeDuePublications(scenario.deps, { at: AT, limit: 20 });
    await executeDuePublications(scenario.deps, { at: new Date(AT.getTime() + 86_400_000), limit: 20 });
    expect(sends).toBe(1);
    expect(publications.get("pub_delivery" as PublicationId)?.state).toBe("FAILED_SEND");
  });

  it.each([
    ["期限切れ", aChannelConnection({ id: CONNECTION_ID, workspaceId: WORKSPACE, kind: "bluesky", expiresAt: AT })],
    ["失効済み", aChannelConnection({ id: CONNECTION_ID, workspaceId: WORKSPACE, kind: "bluesky", revokedAt: AT })],
    ["媒体不一致", aChannelConnection({ id: CONNECTION_ID, workspaceId: WORKSPACE, kind: "x" })],
  ])("%sの接続では送信しない", async (_label, connection) => {
    const publications = memoryPublications([queued()]);
    const scenario = setup({ publications, connection });
    const result = await executeDuePublications(scenario.deps, { at: AT, limit: 20 });
    expect(result.ok).toBe(true);
    expect(scenario.publishInputs).toHaveLength(0);
    expect(publications.get("pub_delivery" as PublicationId)?.state).toBe("FAILED_VALIDATION");
  });

  it("予約後に承認が外れた記事は、送信時にも共通Compliance gateで止める", async () => {
    const publications = memoryPublications([queued()]);
    const scenario = setup({ publications, content: variant({ status: "review" }) });
    const result = await executeDuePublications(scenario.deps, { at: AT, limit: 20 });
    expect(result.ok).toBe(true);
    expect(scenario.publishInputs).toHaveLength(0);
    expect(publications.get("pub_delivery" as PublicationId)?.lastError).toContain("承認");
  });

  it("監査保存が一時失敗しても外部投稿を再送せず、outboxだけを再試行する", async () => {
    const publications = memoryPublications([queued()]);
    const scenario = setup({ publications });
    scenario.setAuditWritable(false);
    const result = await executeDuePublications(scenario.deps, { at: AT, limit: 20 });
    expect(result.ok).toBe(true);
    expect(publications.get("pub_delivery" as PublicationId)?.state).toBe("PUBLISHED");
    expect(scenario.publishInputs).toHaveLength(1);

    const unavailable = await flushPublicationDeliveryAudits(
      { deliveryAudits: scenario.deps.deliveryAudits },
      { limit: 20 },
    );
    expect(unavailable.ok).toBe(false);

    await executeDuePublications(scenario.deps, {
      at: new Date(AT.getTime() + 60_000),
      limit: 20,
    });
    expect(scenario.publishInputs, "監査の再試行で外部投稿を再送しています").toHaveLength(1);

    scenario.setAuditWritable(true);
    const recovered = await flushPublicationDeliveryAudits(
      { deliveryAudits: scenario.deps.deliveryAudits },
      { limit: 20 },
    );
    expect(recovered.ok).toBe(true);
    if (recovered.ok) expect(recovered.value).toEqual({ scanned: 1, delivered: 1, pending: 0 });
    expect(scenario.audit.entries()).toHaveLength(1);
    expect(scenario.audit.entries()[0]?.id).toBeTypeOf("string");
  });
});

/**
 * 外部へ届く前に止まる道。
 *
 * 送信の手前には確認が 8 つ並んでいて、どれも**外部へ 1 度も触れずに**
 * 止まることに意味がある。触れてから止めると、相手側に半端な投稿が残る。
 * したがってこの組では毎回 `publishInputs` が空であることを見る。
 *
 * もう 1 つ、止め方は状態で変わる。まだ 1 度も送っていない QUEUED は
 * 検証失敗（FAILED_VALIDATION）へ、送信を始めた後の行は送信失敗として
 * 数え直す。ここを取り違えると、送信回数の上限が効かなくなる。
 */
describe("送信の手前で止まる道", () => {
  function blocked(over: Partial<Publication> = {}) {
    const publications = memoryPublications([queued(over)]);
    return { publications, scenario: setup({ publications }) };
  }

  async function runAndExpectStopped(
    deps: Parameters<typeof executeDuePublications>[0],
    scenario: ReturnType<typeof setup>,
  ) {
    const result = await executeDuePublications(deps, { at: AT, limit: 20 });

    expect(result.ok).toBe(true);
    expect(scenario.publishInputs, "止めたはずの配信を外部へ送っています").toHaveLength(0);
    return result;
  }

  it("送信先の接続が結び付いていない行は、外部へ触れずに検証失敗にする", async () => {
    const { publications, scenario } = blocked({ connectionId: null });

    await runAndExpectStopped(scenario.deps, scenario);

    const after = publications.get("pub_delivery" as PublicationId);
    expect(after?.state).toBe("FAILED_VALIDATION");
    expect(after?.lastError).toBe("送信先の接続がありません。");
  });

  it("送信を始めた後の行は、検証失敗ではなく送信失敗として数える", async () => {
    // QUEUED から入る道と違い、状態の作り直しではなく送信失敗の記録として畳む。
    const { publications, scenario } = blocked({
      connectionId: null,
      state: "RETRY_SCHEDULED",
      attempts: 1,
      retryAt: new Date(AT.getTime() - 1_000),
    });

    const result = await runAndExpectStopped(scenario.deps, scenario);

    expect(result.ok && result.value.failed).toBe(1);
    expect(publications.get("pub_delivery" as PublicationId)).toMatchObject({
      state: "FAILED_SEND",
      // 送信の回数は claim のときにだけ増える。届く前に止めた回は数えない。
      attempts: 1,
    });
  });

  it("送信する記事が消えていたら、その旨を残して止める", async () => {
    const publications = memoryPublications([queued()]);
    const scenario = setup({ publications, content: null });

    await runAndExpectStopped(scenario.deps, scenario);

    expect(publications.get("pub_delivery" as PublicationId)?.lastError).toBe(
      "送信する記事が見つかりません。",
    );
  });

  it("接続に本人確認情報が固定されていなければ、送らずに登録し直しを促す", async () => {
    const publications = memoryPublications([queued()]);
    const scenario = setup({
      publications,
      connection: aChannelConnection({
        id: CONNECTION_ID,
        workspaceId: WORKSPACE,
        kind: "bluesky",
        providerIdentity: null,
      }),
    });

    await runAndExpectStopped(scenario.deps, scenario);

    expect(publications.get("pub_delivery" as PublicationId)?.lastError).toContain(
      "本人確認情報が固定されていません",
    );
  });

  it("予約時の本人確認情報と接続の本人確認情報が食い違えば、別アカウントへ送らない", async () => {
    const publications = memoryPublications([queued({ providerIdentity: "did:plc:old" })]);
    const scenario = setup({ publications });

    await runAndExpectStopped(scenario.deps, scenario);

    // 接続側は did:plc:test。予約時と違う先へ黙って送るのが最悪の結末である。
    expect(publications.get("pub_delivery" as PublicationId)?.state).toBe("FAILED_VALIDATION");
  });

  it("コネクタを組み立てられなければ、その理由を残して止める", async () => {
    const { publications, scenario } = blocked();
    const deps = {
      ...scenario.deps,
      connectors: {
        forConnection: () => ({
          ok: false as const,
          error: {
            code: "UPSTREAM_UNAVAILABLE" as const,
            message: "接続情報を読み出せませんでした。",
            retryable: true,
          },
        }),
      } as ChannelConnectorProviderPort,
    };

    await runAndExpectStopped(deps, scenario);

    expect(publications.get("pub_delivery" as PublicationId)?.lastError).toBe(
      "接続情報を読み出せませんでした。",
    );
  });

  it("コネクタの種類が予約と違えば、送信先を取り違える前に止める", async () => {
    const publications = memoryPublications([queued()]);
    const scenario = setup({
      publications,
      connector: { ...workingConnector(), kind: "x" },
    });

    await runAndExpectStopped(scenario.deps, scenario);

    expect(publications.get("pub_delivery" as PublicationId)?.lastError).toBe(
      "送信先とコネクタの種類が一致しません。",
    );
  });

  it("送信の準備が整っていなければ、その理由を残して止める", async () => {
    const publications = memoryPublications([queued()]);
    const scenario = setup({
      publications,
      connector: {
        ...workingConnector(),
        checkReadiness: async () => ({
          ok: false as const,
          error: {
            code: "UPSTREAM_UNAVAILABLE" as const,
            message: "認証が切れています。",
            retryable: true,
          },
        }),
      },
    });

    await runAndExpectStopped(scenario.deps, scenario);

    expect(publications.get("pub_delivery" as PublicationId)?.lastError).toBe("認証が切れています。");
  });

  it("コネクタの下見が指摘を返したら、指摘を並べて止める", async () => {
    const publications = memoryPublications([queued()]);
    const scenario = setup({
      publications,
      connector: {
        ...workingConnector(),
        validate: async () => ok(["本文が長すぎます", "画像が必要です"]),
      },
    });

    await runAndExpectStopped(scenario.deps, scenario);

    expect(publications.get("pub_delivery" as PublicationId)?.lastError).toBe(
      "本文が長すぎます / 画像が必要です",
    );
  });

  it("下見そのものが失敗したときも、指摘と同じ扱いで止める", async () => {
    const publications = memoryPublications([queued()]);
    const scenario = setup({
      publications,
      connector: {
        ...workingConnector(),
        validate: async () => ({
          ok: false as const,
          error: {
            code: "UPSTREAM_UNAVAILABLE" as const,
            message: "下見に応答がありません。",
            retryable: true,
          },
        }),
      },
    });

    await runAndExpectStopped(scenario.deps, scenario);

    expect(publications.get("pub_delivery" as PublicationId)?.lastError).toBe(
      "下見に応答がありません。",
    );
  });

  it("投稿の鍵を用意できなければ、鍵なしで送らない", async () => {
    const publications = memoryPublications([queued()]);
    const scenario = setup({
      publications,
      connector: {
        ...workingConnector(),
        prepareDeliveryKey: async () => ({
          ok: false as const,
          error: {
            code: "UPSTREAM_UNAVAILABLE" as const,
            message: "投稿の鍵を発行できませんでした。",
            retryable: true,
          },
        }),
      },
    });

    await runAndExpectStopped(scenario.deps, scenario);

    // 鍵が無いまま送ると、再送のたびに新しい投稿が増える。
    expect(publications.get("pub_delivery" as PublicationId)?.lastError).toBe(
      "投稿の鍵を発行できませんでした。",
    );
  });

  it("送信の順番を確保できなければ、やり直せる断りとして呼び出し元へ返す", async () => {
    const publications = memoryPublications([queued()]);
    const scenario = setup({ publications });
    const deps = {
      ...scenario.deps,
      connections: {
        ...scenario.deps.connections,
        acquireProviderDeliveryLease: async () => ({
          ok: false as const,
          error: { code: "UPSTREAM_UNAVAILABLE" as const, message: "KV障害", retryable: true },
        }),
      },
    };

    const result = await executeDuePublications(deps, { at: AT, limit: 20 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.retryable).toBe(true);
      expect(result.error.message).toBe("送信先の利用順を確保できませんでした。");
    }
    expect(scenario.publishInputs).toHaveLength(0);
  });

  it("送信権の確保そのものが失敗したときも、やり直せる断りとして返す", async () => {
    const publications = memoryPublications([queued()]);
    const scenario = setup({ publications });
    const deps = {
      ...scenario.deps,
      publications: {
        ...publications.port,
        claimForDelivery: async () => ({
          ok: false as const,
          error: { code: "UPSTREAM_UNAVAILABLE" as const, message: "D1障害", retryable: true },
        }),
      } as PublicationRepositoryPort,
    };

    const result = await executeDuePublications(deps, { at: AT, limit: 20 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("配信の送信権を確保できませんでした。");
    expect(scenario.publishInputs).toHaveLength(0);
  });
});

describe("監査だけを流し直す入口", () => {
  it("件数は 1〜200 の間へ収める", async () => {
    const seen: number[] = [];
    const deliveryAudits = {
      flush: async (limit: number) => {
        seen.push(limit);
        return ok({ scanned: 0, delivered: 0, pending: 0 });
      },
    } as unknown as PublicationDeliveryAuditOutboxPort;

    await flushPublicationDeliveryAudits({ deliveryAudits }, { limit: 0 });
    await flushPublicationDeliveryAudits({ deliveryAudits }, { limit: 5_000 });

    expect(seen).toEqual([1, 200]);
  });
});
