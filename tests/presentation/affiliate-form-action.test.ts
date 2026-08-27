/** @tier 1 @req REQ-P09, REQ-E10, REQ-E11 @types permission-matrix, equivalence, secrets */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { domainError, err, ok } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";

/**
 * 提携先と提携条件を保存する 2 つの操作。
 *
 * 見るところは 3 つ。番号の空欄は「新しく作る」であること、
 * 数の欄の空欄は 0 ではなく未取得であること、そして
 * **鍵の値がこの経路を通らない**こと（渡るのは保管先の名前だけ）。
 */

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

let signedIn: ActorContext | null = { ...SAMPLE_ACTOR, roles: ["owner"] };
const executeAccount = vi.fn();
const executeProgram = vi.fn();

vi.mock("@/presentation/composition", () => ({
  signedInActor: async () => signedIn,
  affiliateUseCases: async () => ({
    saveAccount: { execute: executeAccount },
    saveProgram: { execute: executeProgram },
  }),
}));

const { saveAffiliateAccountAction, saveAffiliateProgramAction } = await import(
  "@/presentation/admin/affiliate-form-action"
);

const IDLE = { status: "idle", message: "" } as const;

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

beforeEach(() => {
  signedIn = { ...SAMPLE_ACTOR, roles: ["owner"] };
  executeAccount.mockReset();
  executeProgram.mockReset();
  revalidatePath.mockReset();
});

describe("saveAffiliateAccountAction", () => {
  it("未ログインなら、FormData を 1 度も読まずに断る", async () => {
    signedIn = null;
    const get = vi.fn();
    const state = await saveAffiliateAccountAction(IDLE, { get } as unknown as FormData);

    expect(state.status).toBe("failed");
    expect(get).not.toHaveBeenCalled();
    expect(executeAccount).not.toHaveBeenCalled();
  });

  it("番号が空欄なら新しく作る扱いになり、checkbox が来なければ止めない", async () => {
    executeAccount.mockResolvedValue(ok({ accountId: "acc-1", view: { label: "A8" } }));
    await saveAffiliateAccountAction(IDLE, form({ accountId: "  ", asp: "a8" }));

    expect(executeAccount.mock.calls[0][1]).toMatchObject({
      accountId: null,
      asp: "a8",
      label: "",
      publicTrackingId: "",
      credentialRef: "",
      disabled: false,
    });
  });

  it("保存できたら、続きの提携条件の画面まで案内し、両方の画面を描き直す", async () => {
    executeAccount.mockResolvedValue(ok({ accountId: "acc 1", view: { label: "A8" } }));
    const state = await saveAffiliateAccountAction(
      IDLE,
      form({
        accountId: "acc 1",
        asp: "a8",
        label: "A8",
        publicTrackingId: "t-1",
        credentialRef: "secrets/a8",
        disabled: "on",
      }),
    );

    const input = executeAccount.mock.calls[0][1];
    expect(input.accountId).toBe("acc 1");
    expect(input.disabled).toBe(true);
    // 鍵そのものは列としても持たない。渡るのは保管先の名前だけ。
    expect(input.credentialRef).toBe("secrets/a8");
    expect(Object.keys(input)).not.toContain("credential");

    expect(revalidatePath).toHaveBeenCalledWith("/admin/affiliate");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/affiliate/programs/new");
    expect(state.status).toBe("done");
    expect(state.programEntryPath).toBe("/admin/affiliate/programs/new?account=acc%201");
  });

  it("domain が断ったら、断りの文と原因の欄を返し、描き直さない", async () => {
    executeAccount.mockResolvedValue(
      err(domainError("CONFLICT", "同じ提携先があります。", { field: "label" })),
    );
    const state = await saveAffiliateAccountAction(IDLE, form({ label: "A8" }));

    expect(state.status).toBe("failed");
    expect(state.field).toBe("label");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("saveAffiliateProgramAction", () => {
  it("未ログインなら、FormData を 1 度も読まずに断る", async () => {
    signedIn = null;
    const get = vi.fn();
    const state = await saveAffiliateProgramAction(IDLE, { get } as unknown as FormData);

    expect(state.status).toBe("failed");
    expect(get).not.toHaveBeenCalled();
    expect(executeProgram).not.toHaveBeenCalled();
  });

  it("数の欄は、空欄も数でない字も 0 ではなく null で渡る", async () => {
    executeProgram.mockResolvedValue(
      ok({ view: { advertiserName: "X社", rewardLabel: "10%", restrictions: [] } }),
    );
    await saveAffiliateProgramAction(
      IDLE,
      form({ rewardPercent: "", approvalRatePercent: "だいたい", confirmationDays: "30" }),
    );

    const input = executeProgram.mock.calls[0][1];
    expect(input.rewardPercent).toBeNull();
    expect(input.approvalRatePercent).toBeNull();
    expect(input.confirmationDays).toBe(30);
  });

  it("通貨が選ばれていなければ既定を使い、額だけ入って通貨が空の行を作らない", async () => {
    executeProgram.mockResolvedValue(
      ok({ view: { advertiserName: "X社", rewardLabel: "500円", restrictions: [] } }),
    );
    await saveAffiliateProgramAction(IDLE, form({ rewardAmountMinor: "50000" }));

    expect(executeProgram.mock.calls[0][1].rewardCurrency).toBe("JPY");
  });

  it("掲載条件があるときだけ、件数の一文が知らせに足される", async () => {
    executeProgram.mockResolvedValue(
      ok({
        view: { advertiserName: "X社", rewardLabel: "10%", restrictions: ["A", "B"] },
      }),
    );
    const withRestrictions = await saveAffiliateProgramAction(
      IDLE,
      form({ restrictions: "A\n\n B ", rewardCurrency: "USD", ended: "on" }),
    );

    const input = executeProgram.mock.calls[0][1];
    expect(input.restrictions).toEqual(["A", "B"]);
    expect(input.rewardCurrency).toBe("USD");
    expect(input.ended).toBe(true);
    expect(withRestrictions.message).toContain("掲載前に確かめる条件が 2 件あります。");
    expect(withRestrictions.affiliatePath).toBe("/admin/affiliate");

    executeProgram.mockResolvedValue(
      ok({ view: { advertiserName: "X社", rewardLabel: "10%", restrictions: [] } }),
    );
    const withoutRestrictions = await saveAffiliateProgramAction(IDLE, form({}));

    expect(withoutRestrictions.message).not.toContain("掲載前に確かめる条件");
    expect(executeProgram.mock.calls[1][1].ended).toBe(false);
  });

  it("domain が断ったら、断りの文を返し、描き直さない", async () => {
    executeProgram.mockResolvedValue(err(domainError("CONFLICT", "報酬の型が合いません。")));
    const state = await saveAffiliateProgramAction(IDLE, form({ accountId: "acc-1" }));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("報酬の型が合いません。");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
