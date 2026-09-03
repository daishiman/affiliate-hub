/** @tier 1 @req REQ-P04 @types permission-matrix, equivalence, boundary */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { domainError, err, ok } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";

/**
 * 評価基準を 1 つ立てる操作と、商品 1 つに点を入れる操作。
 *
 * 要点は 2 つ。指標の欄は**画面から来た名前ではなく許可された一覧から**作ること、
 * そして点の空欄を 0 点と読み替えないこと。0 点は「測って 0 だった」、
 * 空欄は「まだ測っていない」で、順位に与える意味がまるで違う。
 */

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

let signedIn: ActorContext | null = { ...SAMPLE_ACTOR, roles: ["owner"] };
const executeModel = vi.fn();
const executeScoreCard = vi.fn();

const CRITERIA = [
  { key: "durability", label: "丈夫さ" },
  { key: "price", label: "値段" },
] as const;

vi.mock("@/presentation/composition", () => ({
  signedInActor: async () => signedIn,
  rankingCriteriaOptions: () => CRITERIA,
  rankingUseCases: async () => ({
    saveModel: { execute: executeModel },
    saveScoreCard: { execute: executeScoreCard },
  }),
}));

const { createRankingModelAction, saveScoreCardAction } = await import(
  "@/presentation/admin/material/ranking-form-action"
);

const IDLE = { status: "idle", message: "" } as const;

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

beforeEach(() => {
  signedIn = { ...SAMPLE_ACTOR, roles: ["owner"] };
  executeModel.mockReset();
  executeScoreCard.mockReset();
  revalidatePath.mockReset();
});

describe("createRankingModelAction", () => {
  it("未ログインなら、FormData を 1 度も読まずに断る", async () => {
    signedIn = null;
    const get = vi.fn();
    const state = await createRankingModelAction(IDLE, { get } as unknown as FormData);

    expect(state.status).toBe("failed");
    expect(get).not.toHaveBeenCalled();
    expect(executeModel).not.toHaveBeenCalled();
  });

  it("画面から来た知らない指標は拾わず、許可された一覧の分だけを組み立てる", async () => {
    executeModel.mockResolvedValue(ok({ modelId: "m 1", version: "v1" }));
    await createRankingModelAction(
      IDLE,
      form({
        weight_durability: "60",
        threshold_durability: "40",
        measurement_durability: "落として測る",
        weight_価格: "40",
      }),
    );

    const input = executeModel.mock.calls[0][1];
    expect(input.criteria.map((c: { key: string }) => c.key)).toEqual(["durability", "price"]);
    expect(input.criteria[0]).toEqual({
      key: "durability",
      weightPercent: 60,
      passThresholdPercent: 40,
      measurement: "落として測る",
    });
    // 送られてこなかった指標は 0 で埋める。合計が 100% に届かないことは domain が断る。
    expect(input.criteria[1]).toEqual({
      key: "price",
      weightPercent: 0,
      passThresholdPercent: 0,
      measurement: "",
    });
  });

  it("立てられたら、点を入れる画面まで案内し、3 つの画面を描き直す", async () => {
    executeModel.mockResolvedValue(ok({ modelId: "m 1", version: "2026-08" }));
    const state = await createRankingModelAction(
      IDLE,
      form({
        categoryId: "cat-1",
        version: "2026-08",
        audience: "初心者",
        effectiveFrom: "2026-08-01",
        reason: "重さの比重を上げた",
      }),
    );

    expect(executeModel.mock.calls[0][1]).toMatchObject({
      categoryId: "cat-1",
      version: "2026-08",
      audience: "初心者",
      effectiveFrom: "2026-08-01",
      reason: "重さの比重を上げた",
    });
    expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/admin/rankings/models",
      "/admin/rankings/scores",
      "/admin/rankings",
    ]);
    expect(state.status).toBe("done");
    expect(state.scoreEntryPath).toBe("/admin/rankings/scores?model=m%201");
  });

  it("domain が断ったら、断りの文と原因の欄を返し、描き直さない", async () => {
    executeModel.mockResolvedValue(
      err(domainError("CONFLICT", "重みの合計が 100% になりません。", { field: "criteria" })),
    );
    const state = await createRankingModelAction(IDLE, form({ version: "v1" }));

    expect(state.status).toBe("failed");
    expect(state.field).toBe("criteria");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("saveScoreCardAction", () => {
  it("未ログインなら、FormData を 1 度も読まずに断る", async () => {
    signedIn = null;
    const get = vi.fn();
    const state = await saveScoreCardAction(IDLE, { get } as unknown as FormData);

    expect(state.status).toBe("failed");
    expect(get).not.toHaveBeenCalled();
    expect(executeScoreCard).not.toHaveBeenCalled();
  });

  it("空欄の指標は落とし、0 と書いた指標は 0 点として残す", async () => {
    executeScoreCard.mockResolvedValue(ok({ scoredCount: 1 }));
    await saveScoreCardAction(IDLE, form({ score_durability: "0", score_price: "" }));

    expect(executeScoreCard.mock.calls[0][1].scorePercents).toEqual({ durability: 0 });
  });

  it("数でない点は落とし、根拠は 1 行にも読点にも分けて読む", async () => {
    executeScoreCard.mockResolvedValue(ok({ scoredCount: 2 }));
    const state = await saveScoreCardAction(
      IDLE,
      form({
        modelId: "m-1",
        productId: "p-1",
        score_durability: "測れず",
        score_price: "80",
        evidenceRefs: "ev-1, ev-2\nev-3",
        testedAt: "2026-08-20",
      }),
    );

    const input = executeScoreCard.mock.calls[0][1];
    expect(input.scorePercents).toEqual({ price: 80 });
    expect(input.evidenceRefs).toEqual(["ev-1", "ev-2", "ev-3"]);
    expect(input.testedAt).toBe("2026-08-20");
    expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/admin/rankings",
      "/admin/rankings/scores",
    ]);
    expect(state).toEqual({
      status: "done",
      message: "2 項目の点を登録しました。順位はこの点で計算し直されます。",
      rankingPath: "/admin/rankings",
    });
  });

  it("domain が断ったら、断りの文を返し、描き直さない", async () => {
    executeScoreCard.mockResolvedValue(err(domainError("CONFLICT", "検証記録がありません。")));
    const state = await saveScoreCardAction(IDLE, form({ productId: "p-1" }));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("検証記録がありません。");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
