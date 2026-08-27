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

  it("接続を使う直接投稿に対応していない出し先へは、接続そのものを作らせない", async () => {
    // note には公開された投稿用の仕組みが無い。ここで接続を作れてしまうと、
    // 「つないだのに出せない」接続が設定画面に並び、原因が接続側にあるように見える。
    const scenario = setup();
    const result = await createRegisterChannelConnectionUseCase(scenario.deps).execute(anOwner(), {
      ...input,
      channelKind: "note",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_SUPPORTED");
    expect(result.error.message).toContain("note");
    expect(scenario.saved).toHaveLength(0);
  });

  it("読み取れない接続期限は、欄の名前を付けずに断る", async () => {
    // 接続の画面に期限の入力欄は無い（値は provider から来る）。
    // 欄の名前を付けると、画面は「その欄」を待って断りをどこにも出さない。
    const scenario = setup();
    const result = await createRegisterChannelConnectionUseCase(scenario.deps).execute(anOwner(), {
      ...input,
      expiresAt: "きのう",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION_FAILED");
    expect(result.error.field).toBeUndefined();
    expect(scenario.saved).toHaveLength(0);
  });

  it("空欄と読み取れる期限は「期限なし」として扱い、断らない", async () => {
    const scenario = setup({
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
    });
    const result = await createRegisterChannelConnectionUseCase(scenario.deps).execute(anOwner(), {
      ...input,
      expiresAt: "   ",
    });

    expect(result.ok).toBe(true);
    expect(scenario.saved[0]?.expiresAt).toBeNull();
  });

  it("秘密の値そのものを渡されたら、providerへ問い合わせる前に断る", async () => {
    // provider へ送ってから断ると、その 1 回で秘密が外へ出てしまう。
    let asked = false;
    const scenario = setup({
      connectors: {
        forConnection: (connection) => {
          asked = true;
          return ok({
            kind: connection.kind,
            resolveIdentity: async () =>
              ok({ providerIdentity: "did:plc:publisher", accountLabel: "@publisher.example" }),
            checkReadiness: async () => ok(true),
            prepareDeliveryKey: async () => ok("test-delivery-key"),
            validate: async () => ok([]),
            publish: async () => ok({ externalId: "test", externalUrl: null, publishedAt: new Date() }),
            unpublish: async () => ok(true),
          });
        },
      },
    });
    const result = await createRegisterChannelConnectionUseCase(scenario.deps).execute(anOwner(), {
      ...input,
      credentialRef: "sk-live-0123456789abcdef",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("credentialRef");
    expect(asked).toBe(false);
    expect(scenario.saved).toHaveLength(0);
  });

  it("その出し先の繋ぎ役が用意されていなければ、接続を作らない", async () => {
    const scenario = setup({
      connectors: {
        forConnection: () =>
          err(domainError("NOT_SUPPORTED", "この出し先の繋ぎ役がまだありません。")),
      },
    });
    const result = await createRegisterChannelConnectionUseCase(scenario.deps).execute(anOwner(), input);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_SUPPORTED");
    expect(scenario.saved).toHaveLength(0);
  });

  it("providerが返した識別子が秘密の形なら、保存しない", async () => {
    // 相手側の不具合や乗っ取りで秘密が識別子として返ることがある。
    // 保存すると監査記録にもそのまま載る。
    const scenario = setup({
      connectors: {
        forConnection: (connection) =>
          ok({
            kind: connection.kind,
            resolveIdentity: async () =>
              ok({
                providerIdentity: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
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
    const result = await createRegisterChannelConnectionUseCase(scenario.deps).execute(anOwner(), input);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("providerIdentity");
    expect(scenario.saved).toHaveLength(0);
  });

  it("接続の保存先が読めないときは、繋がったことにしない", async () => {
    const base = setup();
    const result = await createRegisterChannelConnectionUseCase({
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
      connections: {
        ...base.deps.connections,
        createIfAbsent: async () =>
          err(domainError("UPSTREAM_UNAVAILABLE", "接続の保存先に繋がりません。", { retryable: true })),
      },
    }).execute(anOwner(), input);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(base.audit.entries()).toHaveLength(0);
  });

  it("同じ接続をもう一度登録しても、繋いだ記録は 1 本のままにする", async () => {
    const scenario = setup({
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
    });
    const usecase = createRegisterChannelConnectionUseCase(scenario.deps);
    expect((await usecase.execute(anOwner(), input)).ok).toBe(true);
    expect((await usecase.execute(anOwner(), input)).ok).toBe(true);

    expect(scenario.saved).toHaveLength(1);
    // 二重クリックや再送のたびに記録が増えると、「いつ繋いだか」が読めなくなる。
    expect(scenario.audit.entries().filter((e) => e.action === "connector.connected")).toHaveLength(1);
  });

  it("記録の一覧が読めないときは、繋いだ記録を書き足さない", async () => {
    // 読めないまま書くと、すでにある記録の上に同じ内容がもう 1 本積まれる。
    const base = setup();
    const result = await createRegisterChannelConnectionUseCase({
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
        ...base.deps.auditLog,
        listByTarget: async () =>
          err(domainError("UPSTREAM_UNAVAILABLE", "記録の保存先が読めません。", { retryable: true })),
      },
    }).execute(anOwner(), input);

    expect(result.ok).toBe(false);
    expect(base.audit.entries()).toHaveLength(0);
  });

  it("同じ監査IDの書き足しに負けただけなら、繋がったこととして扱う", async () => {
    // 並行して同じ接続を登録した相手が先に書いただけ。記録は 1 本あるので、
    // ここで失敗を返すと「繋がっているのに繋がっていない」と見える。
    const base = setup();
    const result = await createRegisterChannelConnectionUseCase({
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
        ...base.deps.auditLog,
        listByTarget: async (_workspaceId, targetType, targetId) =>
          ok(
            base.audit.entries().length === 0
              ? []
              : [{ action: "connector.connected", targetType, targetId } as never],
          ),
        append: async (entry) => {
          await base.audit.port.append(entry);
          return err(
            domainError("UPSTREAM_UNAVAILABLE", "audit unavailable", { retryable: true }),
          );
        },
      },
    }).execute(anOwner(), input);

    expect(result.ok).toBe(true);
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
