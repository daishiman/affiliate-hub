/** @tier 1 @req REQ-E19, REQ-E21 @types permission-matrix, equivalence, boundary */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { domainError, err, ok } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";

/**
 * 根拠・言えること・検証記録を登録する 3 つの操作。
 *
 * 3 つとも「空欄をどう読むか」で意味が変わる。確かさの空欄は 0% ではなく
 * 「決めていない」、点の空欄は 0 点ではなく「測っていない」。
 * 測ったときの条件は決めうちの欄にせず、「名前: 値」の行で受ける。
 */

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

let signedIn: ActorContext | null = { ...SAMPLE_ACTOR, roles: ["owner"] };
const executeEvidence = vi.fn();
const executeClaim = vi.fn();
const executeTestRun = vi.fn();

const CRITERIA = [
  { key: "durability", label: "丈夫さ" },
  { key: "price", label: "値段" },
] as const;

vi.mock("@/presentation/composition", () => ({
  signedInActor: async () => signedIn,
  rankingCriteriaOptions: () => CRITERIA,
  evidenceUseCases: async () => ({
    saveEvidence: { execute: executeEvidence },
    saveClaim: { execute: executeClaim },
    saveTestRun: { execute: executeTestRun },
  }),
}));

const { createEvidenceAction, createClaimAction, createTestRunAction } = await import(
  "@/presentation/admin/material/evidence-form-action"
);

const IDLE = { status: "idle", message: "" } as const;

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

beforeEach(() => {
  signedIn = { ...SAMPLE_ACTOR, roles: ["owner"] };
  executeEvidence.mockReset();
  executeClaim.mockReset();
  executeTestRun.mockReset();
  revalidatePath.mockReset();
});

describe("createEvidenceAction", () => {
  it("未ログインなら、FormData を 1 度も読まずに断る", async () => {
    signedIn = null;
    const get = vi.fn();
    const state = await createEvidenceAction(IDLE, { get } as unknown as FormData);

    expect(state.status).toBe("failed");
    expect(get).not.toHaveBeenCalled();
    expect(executeEvidence).not.toHaveBeenCalled();
  });

  it("欄は前後の空白を落として渡り、登録後は番号を画面に出す", async () => {
    executeEvidence.mockResolvedValue(ok({ evidenceId: "ev 1", title: "実測値" }));
    const state = await createEvidenceAction(
      IDLE,
      form({
        type: "measurement",
        title: " 実測値 ",
        sourceOwner: "自社",
        urlOrAssetId: "asset-1",
        excerptOrSummary: "30 分で満充電",
        licenseOrPermission: "自社撮影",
        capturedAt: "2026-08-20",
      }),
    );

    expect(executeEvidence.mock.calls[0][1]).toEqual({
      type: "measurement",
      title: "実測値",
      sourceOwner: "自社",
      urlOrAssetId: "asset-1",
      excerptOrSummary: "30 分で満充電",
      licenseOrPermission: "自社撮影",
      capturedAt: "2026-08-20",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/evidence");
    expect(state.evidenceId).toBe("ev 1");
    expect(state.message).toContain("番号は ev 1 です。");
    expect(state.claimEntryPath).toBe("/admin/evidence/claims/new?evidence=ev%201");
  });

  it("domain が断ったら、断りの文と原因の欄を返し、描き直さない", async () => {
    executeEvidence.mockResolvedValue(
      err(domainError("CONFLICT", "抜粋が長すぎます。", { field: "excerptOrSummary" })),
    );
    const state = await createEvidenceAction(IDLE, form({ title: "実測値" }));

    expect(state.status).toBe("failed");
    expect(state.field).toBe("excerptOrSummary");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("createClaimAction", () => {
  it("未ログインなら、FormData を 1 度も読まずに断る", async () => {
    signedIn = null;
    const get = vi.fn();
    const state = await createClaimAction(IDLE, { get } as unknown as FormData);

    expect(state.status).toBe("failed");
    expect(get).not.toHaveBeenCalled();
    expect(executeClaim).not.toHaveBeenCalled();
  });

  it("確かさの空欄は 0% ではなく、まんなかの 50 で渡る", async () => {
    executeClaim.mockResolvedValue(ok({ statement: "軽い" }));
    await createClaimAction(IDLE, form({ productId: "p-1", confidencePercent: "" }));

    expect(executeClaim.mock.calls[0][1].confidencePercent).toBe(50);
  });

  it("根拠は複数行で受け、登録後は商品のページまで案内する", async () => {
    executeClaim.mockResolvedValue(ok({ statement: "1 日もつ" }));
    const state = await createClaimAction(
      IDLE,
      form({
        productId: "p 1",
        statement: "1 日もつ",
        type: "measurement",
        evidenceIds: "ev-1\n\n ev-2 ",
        confidencePercent: "80",
        validFrom: "2026-08-01",
        validUntil: "2027-08-01",
      }),
    );

    const input = executeClaim.mock.calls[0][1];
    expect(input.evidenceIds).toEqual(["ev-1", "ev-2"]);
    expect(input.confidencePercent).toBe(80);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/evidence");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/products/p%201");
    expect(state.productPath).toBe("/admin/products/p%201");
    expect(state.message).toContain("承認するまでは記事に使えません。");
  });

  it("domain が断ったら、断りの文を返し、描き直さない", async () => {
    executeClaim.mockResolvedValue(err(domainError("CONFLICT", "根拠が足りません。")));
    const state = await createClaimAction(IDLE, form({ productId: "p-1" }));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("根拠が足りません。");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("createTestRunAction", () => {
  it("未ログインなら、FormData を 1 度も読まずに断る", async () => {
    signedIn = null;
    const get = vi.fn();
    const state = await createTestRunAction(IDLE, { get } as unknown as FormData);

    expect(state.status).toBe("failed");
    expect(get).not.toHaveBeenCalled();
    expect(executeTestRun).not.toHaveBeenCalled();
  });

  it("測っていない観点は落とし、測った条件は「名前: 値」の行で残る", async () => {
    executeTestRun.mockResolvedValue(ok({ testRunId: "tr-1", methodVersion: "v2" }));
    const state = await createTestRunAction(
      IDLE,
      form({
        productId: "p-1",
        methodVersion: "v2",
        testerIds: "u-1\nu-2",
        equipment: "はかり",
        environment: "気温: 25\n湿度：40\n屋内",
        rawResults: "重さ: 1200",
        score_durability: "70",
        score_price: "",
        evidenceIds: "ev-1",
        startedAt: "2026-08-20",
        completedAt: "2026-08-21",
      }),
    );

    const input = executeTestRun.mock.calls[0][1];
    expect(input.normalizedScorePercents).toEqual({ durability: 70 });
    expect(input.testerIds).toEqual(["u-1", "u-2"]);
    // 区切りの無い行も落とさない。落とすと「書いたのに保存されていない」が黙って起きる。
    expect(input.environment).toEqual({ 気温: "25", 湿度: "40", 屋内: "" });
    expect(input.rawResults).toEqual({ 重さ: "1200" });
    expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/admin/evidence",
      "/admin/rankings/scores",
    ]);
    expect(state.testRunId).toBe("tr-1");
    expect(state.message).toContain("方法 v2");
  });

  it("domain が断ったら、断りの文を返し、描き直さない", async () => {
    executeTestRun.mockResolvedValue(err(domainError("CONFLICT", "測った人がいません。")));
    const state = await createTestRunAction(IDLE, form({ productId: "p-1" }));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("測った人がいません。");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
