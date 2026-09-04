/** @tier 1 */
import { describe, expect, it } from "vitest";
import type { LlmUsageEntry } from "@/application/ports/llm-usage";
import { asWorkspaceId } from "@/domain/shared";
import type { WorkspaceId } from "@/domain/shared";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";
import { createD1LlmUsage } from "@/infrastructure/persistence/d1/llm-usage-repository";

/**
 * 生成 AI を使った量の記録。
 *
 * 見ているのは「合計が読めること」と「通貨が混ざっても足し合わせないこと」。
 * 別の通貨を黙って足すと、出た数字が何なのか誰にも説明できなくなる。
 *
 * @req REQ-SEC01
 * @types fault-injection, equivalence
 */

const WS = asWorkspaceId("ws_a") as WorkspaceId;
const NOW = new Date("2026-08-18T00:00:00Z");

type Row = {
  workspaceId: string;
  providerId: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostMinor: number;
  currency: string;
  capacityConsumed: boolean;
  occurredAt: Date;
};

function fakeDb(rows: Row[], failing = false) {
  const inserted: Row[] = [];
  const db = {
    insert: () => ({
      values: async (v: Row) => {
        if (failing) throw new Error("D1 unavailable");
        inserted.push(v);
      },
    }),
    select: () => ({
      from: () => ({
        where: () => {
          if (failing) throw new Error("D1 unavailable");
          return Promise.resolve(rows);
        },
      }),
    }),
  };
  return { db: db as unknown as DrizzleD1, inserted };
}

const ENTRY: LlmUsageEntry = {
  workspaceId: WS,
  providerId: "anthropic",
  modelId: "claude-opus-5",
  purpose: "draft",
  inputTokens: 1_000,
  outputTokens: 400,
  estimatedCostMinor: 7,
  currency: "JPY",
  capacityConsumed: true,
  succeeded: true,
};

const usageOf = (db: DrizzleD1) =>
  createD1LlmUsage({ db, ids: { newId: () => "x1" }, now: () => NOW });

function row(over: Partial<Row> = {}): Row {
  return {
    workspaceId: "ws_a",
    providerId: "anthropic",
    modelId: "claude-opus-5",
    inputTokens: 100,
    outputTokens: 50,
    estimatedCostMinor: 3,
    currency: "JPY",
    capacityConsumed: true,
    occurredAt: NOW,
    ...over,
  };
}

describe("生成 AI の利用量", () => {
  it("1 回の呼び出しにつき 1 行を残す", async () => {
    const { db, inserted } = fakeDb([]);
    const result = await usageOf(db).record(ENTRY);
    expect(result.ok).toBe(true);
    expect(inserted[0]?.providerId).toBe("anthropic");
    expect(inserted[0]?.capacityConsumed).toBe(true);
    expect(inserted[0]?.occurredAt).toEqual(NOW);
  });

  it("provider未開始の記録は容量未消費のまま残す", async () => {
    const { db, inserted } = fakeDb([]);
    const result = await usageOf(db).record({ ...ENTRY, capacityConsumed: false });

    expect(result.ok).toBe(true);
    expect(inserted[0]?.capacityConsumed).toBe(false);
  });

  it("保存先が落ちていたら、握りつぶさずに失敗を返す", async () => {
    const { db } = fakeDb([], true);
    const result = await usageOf(db).record(ENTRY);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.retryable).toBe(true);
  });

  it("提供元とモデルごとにまとめる", async () => {
    const { db } = fakeDb([row(), row(), row({ modelId: "claude-sonnet-5" })]);
    const result = await usageOf(db).summarize({ workspaceId: WS, from: NOW, to: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    const opus = result.value.find((s) => s.modelId === "claude-opus-5");
    expect(opus?.calls).toBe(2);
    expect(opus?.inputTokens).toBe(200);
    expect(opus?.estimatedCostMinor).toBe(6);
  });

  it("通貨が違うものを足し合わせない", async () => {
    const { db } = fakeDb([row(), row({ currency: "USD", estimatedCostMinor: 5 })]);
    const result = await usageOf(db).summarize({ workspaceId: WS, from: NOW, to: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value.map((s) => s.currency).sort()).toEqual(["JPY", "USD"]);
  });

  it("集計中に保存先が落ちても、握りつぶさない", async () => {
    const { db } = fakeDb([], true);
    const result = await usageOf(db).summarize({ workspaceId: WS, from: NOW, to: NOW });
    expect(result.ok).toBe(false);
  });
});
