/** @tier 1 @req REQ-B18, REQ-R06 @types permission-matrix, state-transition, equivalence */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { domainError, err, ok } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";

/**
 * 問い合わせに「対応済み」の印を付ける / 外す。
 *
 * 既定は「対応済みにする」で、外すときだけ `handled=no` を送る。
 * この既定を取り違えると、一覧を開いただけで未対応が消えることになる。
 * 権限を見るのはユースケース側なので、ここでは身元と欄だけを測る。
 */

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

let signedIn: ActorContext | null = { ...SAMPLE_ACTOR, roles: ["owner"] };
const executeMarkHandled = vi.fn();

vi.mock("@/presentation/composition", () => ({
  signedInActor: async () => signedIn,
  contactUseCases: async () => ({ markHandled: { execute: executeMarkHandled } }),
}));

const { markContactHandledAction } = await import("@/presentation/admin/maintain/contact-action");

const IDLE = { status: "idle", message: "" } as const;

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

beforeEach(() => {
  signedIn = { ...SAMPLE_ACTOR, roles: ["owner"] };
  executeMarkHandled.mockReset();
  revalidatePath.mockReset();
});

describe("markContactHandledAction", () => {
  it("未ログインなら、FormData を 1 度も読まずに断る", async () => {
    signedIn = null;
    const get = vi.fn();
    const state = await markContactHandledAction(IDLE, { get } as unknown as FormData);

    expect(state.status).toBe("failed");
    // 読んでから断ると、断り文が「どの問い合わせか分かりません」に化ける。
    expect(state.message).not.toContain("どの問い合わせか");
    expect(get).not.toHaveBeenCalled();
    expect(executeMarkHandled).not.toHaveBeenCalled();
  });

  it("番号が無ければ、欄を名指しして断り、ユースケースまで運ばない", async () => {
    const state = await markContactHandledAction(IDLE, form({}));

    expect(state).toEqual({
      status: "failed",
      message: "どの問い合わせかが分かりませんでした。",
      field: "id",
    });
    expect(executeMarkHandled).not.toHaveBeenCalled();
  });

  it("既定は「対応済みにする」で、一覧を描き直す", async () => {
    executeMarkHandled.mockResolvedValue(ok({}));
    const state = await markContactHandledAction(IDLE, form({ id: "c-1" }));

    expect(executeMarkHandled.mock.calls[0][1]).toEqual({ id: "c-1", handled: true });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/contact");
    expect(state.message).toBe("対応済みにしました。未対応へ戻すこともできます。");
  });

  it("`handled=no` のときだけ、未対応へ戻す", async () => {
    executeMarkHandled.mockResolvedValue(ok({}));
    const state = await markContactHandledAction(IDLE, form({ id: "c-1", handled: "no" }));

    expect(executeMarkHandled.mock.calls[0][1]).toEqual({ id: "c-1", handled: false });
    expect(state.message).toBe("未対応へ戻しました。一覧に出ます。");
  });

  it("`handled` に知らない値が来たら、外さず「対応済みにする」に倒す", async () => {
    executeMarkHandled.mockResolvedValue(ok({}));
    await markContactHandledAction(IDLE, form({ id: "c-1", handled: "maybe" }));

    expect(executeMarkHandled.mock.calls[0][1].handled).toBe(true);
  });

  it("断られたら、断りの文と原因の欄を返し、描き直さない", async () => {
    executeMarkHandled.mockResolvedValue(
      err(domainError("FORBIDDEN", "この操作の権限がありません。", { field: "id" })),
    );
    const state = await markContactHandledAction(IDLE, form({ id: "c-1" }));

    expect(state.status).toBe("failed");
    expect(state.field).toBe("id");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
