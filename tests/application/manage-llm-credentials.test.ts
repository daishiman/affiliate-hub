/** @tier 1 */
import { describe, expect, it } from "vitest";
import type { AuditLogPort } from "@/application/ports/compliance";
import type {
  LlmConnectivityPort,
  LlmCredentialVaultPort,
  LlmProviderCatalogPort,
} from "@/application/ports/llm-credential";
import { createManageLlmCredentialsUseCase } from "@/application/usecases/generation/manage-llm-credentials";
import type { LlmCredentialSummary } from "@/domain/generation/llm-credential";
import type { AuditLogEntry } from "@/domain/compliance";
import { domainError, ok } from "@/domain/shared";
import type { UserId, WorkspaceId } from "@/domain/shared";
import { WORKSPACE, aNobody, anAiAccount, anOwner } from "../support/actors";

/**
 * 生成 AI の API キーの登録・確認・失効。
 *
 * 見ているのは 3 つ。
 *   1. **鍵の値が戻り値にも操作の記録にも入らない**
 *   2. AI のサービスアカウントからは触れない
 *   3. 使えないときに「何をすればよいか」が画面へ返る（黙って空にしない）
 *
 * @req REQ-SEC01, REQ-SEC05
 * @types permission-matrix, audit-log, secrets
 */

const API_KEY = "pk-test-0123456789abcdefghijklmn";
const NOW = new Date("2026-08-18T00:00:00Z");

function summary(over: Partial<LlmCredentialSummary> = {}): LlmCredentialSummary {
  return {
    workspaceId: WORKSPACE as WorkspaceId,
    providerId: "anthropic",
    last4: API_KEY.slice(-4),
    status: "active",
    registeredBy: "user-owner" as UserId,
    registeredAt: NOW,
    lastVerifiedAt: null,
    lastVerification: null,
    ...over,
  };
}

function fakeVault(initial: LlmCredentialSummary[] = []) {
  const rows = new Map(initial.map((c) => [c.providerId, c]));
  const seenKeys: string[] = [];
  const port: LlmCredentialVaultPort = {
    store: async (input) => {
      seenKeys.push(input.apiKey);
      const row = summary({ providerId: input.providerId, last4: input.apiKey.slice(-4) });
      rows.set(input.providerId, row);
      return ok(row);
    },
    list: async () => ok([...rows.values()]),
    revoke: async (input) => {
      const row = summary({ ...rows.get(input.providerId), status: "revoked" });
      rows.set(input.providerId, row);
      return ok(row);
    },
    recordVerification: async (input) => {
      const row = summary({ ...rows.get(input.providerId), lastVerification: input.outcome });
      rows.set(input.providerId, row);
      return ok(row);
    },
  };
  return { port, rows, seenKeys };
}

const MODEL = {
  modelId: "m-1",
  label: "既定",
  inputPricePerMillionMinor: 450,
  outputPricePerMillionMinor: 2_250,
  currency: "JPY",
};

function fakeCatalog(models: Record<string, (typeof MODEL)[]> = { anthropic: [MODEL] }) {
  const port: LlmProviderCatalogPort = {
    listProviders: async () =>
      ok([
        {
          providerId: "anthropic",
          label: "Anthropic",
          keyIssueUrl: "https://example.com",
          required: true,
        },
      ]),
    listModels: async (providerId) => ok(models[providerId] ?? []),
  };
  return port;
}

function fakeAudit() {
  const entries: AuditLogEntry[] = [];
  const port = {
    append: async (entry: AuditLogEntry) => {
      entries.push(entry);
      return ok(undefined);
    },
    list: async () => ok([]),
  } as unknown as AuditLogPort;
  return { port, entries };
}

function fakeConnectivity(succeed: boolean): { port: LlmConnectivityPort; calls: number[] } {
  const calls: number[] = [];
  return {
    calls,
    port: {
      check: async () => {
        calls.push(1);
        return succeed
          ? ok(undefined)
          : {
              ok: false as const,
              error: domainError("UNAUTHENTICATED", "鍵が受け付けられませんでした。", {
                suggestedAction: "登録し直してください。",
              }),
            };
      },
    },
  };
}

function build(over: {
  vault?: ReturnType<typeof fakeVault>;
  catalog?: LlmProviderCatalogPort;
  connectivity?: ReturnType<typeof fakeConnectivity>;
} = {}) {
  const vault = over.vault ?? fakeVault();
  const audit = fakeAudit();
  const connectivity = over.connectivity ?? fakeConnectivity(true);
  const uc = createManageLlmCredentialsUseCase({
    vault: vault.port,
    catalog: over.catalog ?? fakeCatalog(),
    connectivity: connectivity.port,
    auditLog: audit.port,
    ids: { newId: () => "id1" },
    now: () => NOW,
  });
  return { uc, vault, audit, connectivity };
}

describe("生成 AI の API キーの管理", () => {
  it("権限の無い人は触れない", async () => {
    const { uc } = build();
    const result = await uc.execute(aNobody(), { action: "list" });
    expect(result.ok).toBe(false);
  });

  it("AI のサービスアカウントからは登録できない", async () => {
    const { uc, vault } = build();
    const result = await uc.execute(anAiAccount(), {
      action: "register",
      providerId: "anthropic",
      apiKey: API_KEY,
    });
    expect(result.ok).toBe(false);
    // 断る前に鍵が保管庫まで届いていないこと。
    expect(vault.seenKeys).toEqual([]);
  });

  it("登録すると、戻り値には末尾 4 文字しか出ない", async () => {
    const { uc } = build();
    const result = await uc.execute(anOwner(), {
      action: "register",
      providerId: "anthropic",
      apiKey: API_KEY,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(result.value)).not.toContain(API_KEY);
    expect(result.value.rows[0]?.credential?.last4).toBe(API_KEY.slice(-4));
  });

  it("操作の記録に鍵が入らない（誰がどの提供元を登録したかまで）", async () => {
    const { uc, audit } = build();
    await uc.execute(anOwner(), { action: "register", providerId: "anthropic", apiKey: API_KEY });
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0]?.action).toBe("llm_credential.registered");
    expect(JSON.stringify(audit.entries[0])).not.toContain(API_KEY);
    expect(JSON.stringify(audit.entries[0])).toContain(API_KEY.slice(-4));
  });

  it("目録に無い提供元は受け付けない", async () => {
    const { uc, vault } = build();
    const result = await uc.execute(anOwner(), {
      action: "register",
      providerId: "anthropik",
      apiKey: API_KEY,
    });
    expect(result.ok).toBe(false);
    expect(vault.seenKeys).toEqual([]);
  });

  it("失効させると、その旨が記録され一覧にも出る", async () => {
    const { uc, audit } = build({ vault: fakeVault([summary()]) });
    const result = await uc.execute(anOwner(), { action: "revoke", providerId: "anthropic" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows[0]?.credential?.status).toBe("revoked");
    expect(result.value.rows[0]?.unavailableReason).toContain("失効");
    expect(audit.entries[0]?.action).toBe("llm_credential.revoked");
  });

  it("疎通確認に成功すると、確かめた事実が残る", async () => {
    const { uc, vault, connectivity } = build({ vault: fakeVault([summary()]) });
    const result = await uc.execute(anOwner(), {
      action: "verify",
      providerId: "anthropic",
      modelId: "m-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(connectivity.calls).toHaveLength(1);
    expect(vault.rows.get("anthropic")?.lastVerification).toBe("ok");
    expect(result.value.verifyFailure).toBeNull();
  });

  it("疎通確認に失敗しても、一覧は返り、理由が読める", async () => {
    const { uc, vault } = build({
      vault: fakeVault([summary()]),
      connectivity: fakeConnectivity(false),
    });
    const result = await uc.execute(anOwner(), {
      action: "verify",
      providerId: "anthropic",
      modelId: "m-1",
    });
    // **画面を空にしない。** 失敗を例外にすると、状態を読む場所ごと消える。
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows).toHaveLength(1);
    expect(result.value.verifyFailure?.code).toBe("UNAUTHENTICATED");
    expect(vault.rows.get("anthropic")?.lastVerification).toBe("failed");
    expect(result.value.rows[0]?.unavailableReason).toContain("疎通確認");
  });

  it("鍵が未登録なら、その旨が理由に出る", async () => {
    const { uc } = build();
    const result = await uc.execute(anOwner(), { action: "list" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows[0]?.unavailableReason).toContain("登録されていません");
  });

  it("モデルが 0 件なら、鍵より先にそちらを理由に出す", async () => {
    // 鍵を入れても呼べる先が無い状態で「鍵を入れてください」と言わない。
    const { uc } = build({ vault: fakeVault([summary()]), catalog: fakeCatalog({}) });
    const result = await uc.execute(anOwner(), { action: "list" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows[0]?.unavailableReason).toContain("モデル");
  });

  it("使える状態なら理由は出ない", async () => {
    const { uc } = build({ vault: fakeVault([summary({ lastVerification: "ok" })]) });
    const result = await uc.execute(anOwner(), { action: "list" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows[0]?.unavailableReason).toBeNull();
  });
});
