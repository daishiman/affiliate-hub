/** @tier 1 */
import { describe, expect, it } from "vitest";
import type { LlmProviderCatalogPort } from "@/application/ports/llm-credential";
import type { LlmUsageEntry } from "@/application/ports/llm-usage";
import type { LlmKeyAccess, LlmUsageRecorder } from "@/infrastructure/llm/key-access";
import { ok } from "@/domain/shared";
import type { WorkspaceId } from "@/domain/shared";
import { asWorkspaceId } from "@/domain/shared";
import { createLlmConnectivity } from "@/infrastructure/llm/llm-connectivity";

/**
 * 疎通確認。
 *
 * 一番大事なのは「**まだ作っていない提供元を、成功にしない**」こと。
 * 成功にすると、使えない鍵が「確認済み」として画面に残り、
 * 記事を作ろうとした時点で初めて失敗する。それでは確認の意味が無い。
 *
 * @req REQ-SEC01
 * @types fault-injection, contract
 */

const WS = asWorkspaceId("ws_a") as WorkspaceId;
const API_KEY = "pk-test-0123456789abcdefghijklmn";

const MODEL = {
  modelId: "m-1",
  label: "既定",
  inputPricePerMillionMinor: 450,
  outputPricePerMillionMinor: 2_250,
  currency: "JPY",
};

const catalog = (models: Record<string, (typeof MODEL)[]>): LlmProviderCatalogPort => ({
  listProviders: async () => ok([]),
  listModels: async (providerId) => ok(models[providerId] ?? []),
});

const vault = {
  useKey: async <T>(input: { fn: (apiKey: string) => Promise<T> }) => ok(await input.fn(API_KEY)),
} as unknown as LlmKeyAccess;

function fakeUsage(): { port: LlmUsageRecorder; entries: LlmUsageEntry[] } {
  const entries: LlmUsageEntry[] = [];
  return {
    entries,
    port: {
      record: async (entry) => {
        entries.push(entry);
        return ok(undefined);
      },
    },
  };
}

function fetchReturning(status: number, json: unknown) {
  return (async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => json,
    text: async () => "",
  })) as unknown as typeof fetch;
}

const PONG = {
  model: "m-1",
  stop_reason: "tool_use",
  usage: { input_tokens: 20, output_tokens: 5 },
  content: [{ type: "tool_use", name: "emit_result", input: { ok: true } }],
};

describe("疎通確認", () => {
  it("通れば成功を返し、確認として記録する", async () => {
    const usage = fakeUsage();
    const check = createLlmConnectivity({
      vault,
      catalog: catalog({ anthropic: [MODEL] }),
      usage: usage.port,
      fetchImpl: fetchReturning(200, PONG),
    });
    const result = await check.check({ workspaceId: WS, providerId: "anthropic", modelId: "m-1" });
    expect(result.ok).toBe(true);
    // 下書きと混ざらないこと（記事の数と生成の回数が合わなくなるため）。
    expect(usage.entries[0]?.purpose).toBe("verification");
  });

  it("鍵が拒まれたら失敗を返す（確認済みにしない）", async () => {
    const usage = fakeUsage();
    const check = createLlmConnectivity({
      vault,
      catalog: catalog({ anthropic: [MODEL] }),
      usage: usage.port,
      fetchImpl: fetchReturning(401, null),
    });
    const result = await check.check({ workspaceId: WS, providerId: "anthropic", modelId: "m-1" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UNAUTHENTICATED");
  });

  it("目録に無いモデルは、呼ぶ前に断る", async () => {
    const usage = fakeUsage();
    const check = createLlmConnectivity({
      vault,
      catalog: catalog({ anthropic: [MODEL] }),
      usage: usage.port,
      fetchImpl: fetchReturning(200, PONG),
    });
    const result = await check.check({ workspaceId: WS, providerId: "anthropic", modelId: "m-9" });
    expect(result.ok).toBe(false);
    // 呼んでいないので記録も無い。
    expect(usage.entries).toHaveLength(0);
  });

  it("まだ作っていない提供元は、成功にせず「未対応」と答える", async () => {
    /**
     * 2026-08-18 まではここが `xai` だった。4 社を繋いだので、
     * **まだ作っていない提供元**は Workers AI だけになった（鍵ではなく
     * 実行環境の結び付けで呼ぶため、この手順に乗らない）。
     * 提供元の名前を差し替えただけで、見ているものは変えていない
     * ＝「実装の無い提供元を、確認済みにしない」。
     */
    const usage = fakeUsage();
    const check = createLlmConnectivity({
      vault,
      catalog: catalog({ workers_ai: [MODEL] }),
      usage: usage.port,
      fetchImpl: fetchReturning(200, PONG),
    });
    const result = await check.check({ workspaceId: WS, providerId: "workers_ai", modelId: "m-1" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_IMPLEMENTED");
    expect(result.error.suggestedAction).toBeTruthy();
  });

  it("繋いだ提供元は、確認も下書きと同じ 1 本を通る", async () => {
    /**
     * 確認だけ別の分岐を持っていたころは、**確認は通るのに下書きは未対応**
     * （またはその逆）という、利用者から見て説明の付かない状態が作れた。
     * ここでは xAI に Anthropic の形の応答を返している。同じ 1 本を通っていれば
     * xAI の読み方で読もうとして**形が違う**と答えるはずで、
     * 「未対応」でも「成功」でもない。
     */
    const usage = fakeUsage();
    const check = createLlmConnectivity({
      vault,
      catalog: catalog({ xai: [MODEL] }),
      usage: usage.port,
      fetchImpl: fetchReturning(200, PONG),
    });
    const result = await check.check({ workspaceId: WS, providerId: "xai", modelId: "m-1" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
    // 呼んだので、確認として記録も残る。
    expect(usage.entries[0]?.purpose).toBe("verification");
    expect(usage.entries[0]?.providerId).toBe("xai");
  });

  it("目録の設定が壊れていたら、そのまま返す", async () => {
    const usage = fakeUsage();
    const broken: LlmProviderCatalogPort = {
      listProviders: async () => ok([]),
      listModels: async () => ({
        ok: false as const,
        error: { code: "VALIDATION_FAILED", message: "設定が壊れています。" } as never,
      }),
    };
    const check = createLlmConnectivity({
      vault,
      catalog: broken,
      usage: usage.port,
      fetchImpl: fetchReturning(200, PONG),
    });
    const result = await check.check({ workspaceId: WS, providerId: "anthropic", modelId: "m-1" });
    expect(result.ok).toBe(false);
  });
});
