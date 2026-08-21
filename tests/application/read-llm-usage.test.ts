/** @tier 1 */
import { describe, expect, it } from "vitest";
import type { LlmUsagePort, LlmUsageSummary } from "@/application/ports/llm-usage";
import { createReadLlmUsageUseCase } from "@/application/usecases/generation/read-llm-usage";
import { asWorkspaceId, ok } from "@/domain/shared";
import type { ActorContext, WorkspaceId } from "@/domain/shared";

/**
 * 生成 AI の利用量を読む。
 *
 * 見ているのは 3 つ。
 * ①権限の無い人に見せない ②通貨をまたいで足さない
 * ③0 件のときに理由が出る（空白のまま返さない）。
 *
 * @req REQ-SEC01
 * @types permission-matrix, equivalence, boundary
 */

const WS = asWorkspaceId("ws_a") as WorkspaceId;
const FROM = new Date("2026-08-01T00:00:00Z");
const TO = new Date("2026-08-31T00:00:00Z");

const actor = (role: string): ActorContext =>
  ({
    workspaceId: WS,
    userId: "u_1",
    roles: [role],
    isAiServiceAccount: false,
  }) as unknown as ActorContext;

function row(over: Partial<LlmUsageSummary> = {}): LlmUsageSummary {
  return {
    providerId: "anthropic",
    modelId: "claude-opus-5",
    calls: 2,
    inputTokens: 1_000,
    outputTokens: 400,
    estimatedCostMinor: 7,
    currency: "JPY",
    ...over,
  };
}

const usageOf = (rows: readonly LlmUsageSummary[]): LlmUsagePort => ({
  summarize: async () => ok(rows),
});

describe("生成 AI の利用量を読む", () => {
  it("権限が無ければ断る", async () => {
    const result = await createReadLlmUsageUseCase({ usage: usageOf([]) }).execute(
      actor("contributor"),
      { from: FROM, to: TO },
    );
    expect(result.ok).toBe(false);
  });

  it("提供元とモデルの内訳をそのまま返す", async () => {
    const result = await createReadLlmUsageUseCase({
      usage: usageOf([row(), row({ providerId: "openai", modelId: "gpt-5" })]),
    }).execute(actor("owner"), { from: FROM, to: TO });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows).toHaveLength(2);
  });

  it("通貨ごとに合計を分ける（またいで足さない）", async () => {
    const result = await createReadLlmUsageUseCase({
      usage: usageOf([
        row(),
        row({ modelId: "claude-sonnet-5" }),
        row({ providerId: "openai", currency: "USD", estimatedCostMinor: 5 }),
      ]),
    }).execute(actor("owner"), { from: FROM, to: TO });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totals).toHaveLength(2);
    const jpy = result.value.totals.find((t) => t.currency === "JPY");
    expect(jpy?.estimatedCostMinor).toBe(14);
    expect(jpy?.calls).toBe(4);
  });

  it("0 件なら理由を出す（空白のまま返さない）", async () => {
    const result = await createReadLlmUsageUseCase({ usage: usageOf([]) }).execute(actor("owner"), {
      from: FROM,
      to: TO,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.emptyReason).toBeTruthy();
  });

  it("概算であることの但し書きが必ず付く", async () => {
    const result = await createReadLlmUsageUseCase({ usage: usageOf([row()]) }).execute(
      actor("owner"),
      { from: FROM, to: TO },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.estimateNote).toContain("概算");
  });

  it("期間が逆さまなら断る（0 件と見分けが付かなくなるため）", async () => {
    const result = await createReadLlmUsageUseCase({ usage: usageOf([]) }).execute(actor("owner"), {
      from: TO,
      to: FROM,
    });
    expect(result.ok).toBe(false);
  });
});
