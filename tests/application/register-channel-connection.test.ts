/** @tier 1 @req REQ-A06 @types permission-matrix, tenant-isolation, audit-log */
import { describe, expect, it } from "vitest";
import type { ManageDistributionDeps } from "@/application/usecases/distribution/manage-distribution";
import { createRegisterChannelConnectionUseCase } from "@/application/usecases/distribution/manage-distribution";
import type { ChannelConnection } from "@/domain/distribution";
import { domainError, err, ok } from "@/domain/shared";
import { anOwner, aWriter } from "../support/actors";
import { recordingAuditLog, testDeps } from "../support/doubles";

function setup(over: Partial<ManageDistributionDeps> = {}) {
  const base = testDeps();
  const saved: ChannelConnection[] = [];
  const audit = recordingAuditLog();
  const deps: ManageDistributionDeps = {
    connections: {
      ...base.channelConnections,
      createIfAbsent: async (connection) => {
        const canonical = saved.find(
          (candidate) =>
            candidate.workspaceId === connection.workspaceId &&
            candidate.kind === connection.kind &&
            (candidate.providerIdentity === connection.providerIdentity ||
              candidate.credentialRef === connection.credentialRef),
        );
        if (canonical !== undefined) return ok({ connection: canonical, created: false });
        saved.push(connection);
        return ok({ connection, created: true });
      },
    },
    connectors: base.channelConnectors,
    publications: base.publications,
    manualExport: base.manualExport,
    variants: base.contentVariants,
    contentPackages: base.contentPackages,
    ids: base.ids,
    auditLog: audit.port,
    ...over,
  };
  return { deps, saved, audit };
}

const input = {
  channelKind: "bluesky" as const,
  accountLabel: "@publisher.example",
  credentialRef: "channel/conn_bluesky/credentials",
};

describe("外部媒体との接続登録", () => {
  it("実認証できない秘密参照は保存せず、安全な理由だけを返す", async () => {
    const scenario = setup();
    const result = await createRegisterChannelConnectionUseCase(scenario.deps).execute(anOwner(), input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("認証情報");
      expect(JSON.stringify(result.error)).not.toContain(input.credentialRef);
    }
    expect(scenario.saved).toHaveLength(0);
    expect(scenario.audit.entries()).toHaveLength(0);
  });

  it("publisher・ブランド限定owner・AI ownerにはworkspace共通接続を登録させない", async () => {
    for (const actor of [
      aWriter(),
      anOwner({ scopedBrandIds: ["brand_limited" as never] }),
      anOwner({ isAiServiceAccount: true }),
    ]) {
      const scenario = setup();
      const result = await createRegisterChannelConnectionUseCase(scenario.deps).execute(actor, input);
      expect(result.ok).toBe(false);
      expect(scenario.saved).toHaveLength(0);
    }
  });

  it.each([
    ["owner", anOwner()],
    ["workspace_admin", anOwner({ roles: ["workspace_admin"] })],
  ])("人の%sは実認証したDIDとhandleだけを正本として登録する", async (_role, actor) => {
    const scenario = setup({
      connectors: {
        forConnection: (connection) =>
          ok({
            kind: connection.kind,
            resolveIdentity: async () =>
              ok({ providerIdentity: "did:plc:publisher", accountLabel: "@authenticated.example" }),
            checkReadiness: async () => ok(true),
            prepareDeliveryKey: async () => ok("test-delivery-key"),
            validate: async () => ok([]),
            publish: async () => ok({ externalId: "test", externalUrl: null, publishedAt: new Date() }),
            unpublish: async () => ok(true),
          }),
      },
    });
    const result = await createRegisterChannelConnectionUseCase(scenario.deps).execute(actor, input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      usable: true,
      accountLabel: "@authenticated.example",
    });
    expect(scenario.saved).toHaveLength(1);
    expect(scenario.saved[0]).toMatchObject({
      providerIdentity: "did:plc:publisher",
      accountLabel: "@authenticated.example",
      credentialRef: input.credentialRef,
    });
    const entry = scenario.audit.entries()[0];
    expect(entry?.action).toBe("connector.connected");
    expect(JSON.stringify(entry)).not.toContain(input.credentialRef);
    expect(JSON.stringify(entry)).not.toMatch(/password|accessJwt|SECRET_/i);
  });

  it("監査障害後の再試行は同じ接続へ収束し、監査だけを回復する", async () => {
    const base = setup();
    let failAudit = true;
    const deps: ManageDistributionDeps = {
      ...base.deps,
      connectors: {
        forConnection: (connection) =>
          ok({
            kind: connection.kind,
            resolveIdentity: async () =>
              ok({ providerIdentity: "did:plc:publisher", accountLabel: "@publisher.example" }),
            checkReadiness: async () => ok(true),
            prepareDeliveryKey: async () => ok("test-delivery-key"),
            validate: async () => ok([]),
            publish: async () => ok({ externalId: "test", externalUrl: null, publishedAt: new Date() }),
            unpublish: async () => ok(true),
          }),
      },
      auditLog: {
        ...base.audit.port,
        append: async (entry) => {
          if (failAudit) {
            failAudit = false;
            return err(domainError("UPSTREAM_UNAVAILABLE", "audit unavailable", { retryable: true }));
          }
          return base.audit.port.append(entry);
        },
      },
    };

    const first = await createRegisterChannelConnectionUseCase(deps).execute(anOwner(), input);
    const retry = await createRegisterChannelConnectionUseCase(deps).execute(anOwner(), input);

    expect(first.ok).toBe(false);
    expect(retry.ok).toBe(true);
    expect(base.saved).toHaveLength(1);
    expect(base.audit.entries().filter((entry) => entry.action === "connector.connected")).toHaveLength(1);
  });

  it("既存DIDへ別のsecret参照を差し替えず、別DIDへ同じ参照を使い回さない", async () => {
    const identities = new Map<string, string>([
      [input.credentialRef, "did:plc:publisher"],
      ["channel/same-did/credentials", "did:plc:publisher"],
    ]);
    const scenario = setup({
      connectors: {
        forConnection: (connection) =>
          ok({
            kind: connection.kind,
            resolveIdentity: async () =>
              ok({
                providerIdentity: identities.get(connection.credentialRef) ?? "did:plc:other",
                accountLabel: "@publisher.example",
              }),
            checkReadiness: async () => ok(true),
            prepareDeliveryKey: async () => ok("test-delivery-key"),
            validate: async () => ok([]),
            publish: async () => ok({ externalId: "test", externalUrl: null, publishedAt: new Date() }),
            unpublish: async () => ok(true),
          }),
      },
    });
    expect((await createRegisterChannelConnectionUseCase(scenario.deps).execute(anOwner(), input)).ok).toBe(true);

    const replacedRef = await createRegisterChannelConnectionUseCase(scenario.deps).execute(anOwner(), {
      ...input,
      credentialRef: "channel/same-did/credentials",
    });
    identities.set(input.credentialRef, "did:plc:other");
    const replacedIdentity = await createRegisterChannelConnectionUseCase(scenario.deps).execute(anOwner(), {
      ...input,
      credentialRef: input.credentialRef,
      accountLabel: "@other.example",
    });

    expect(replacedRef.ok).toBe(false);
    expect(replacedIdentity.ok).toBe(false);
    expect(scenario.saved).toHaveLength(1);
  });
});
