/** @tier 1 @req REQ-P01, REQ-R01 @types permission-matrix, permission-matrix, equivalence */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { domainError, err, ok } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";

/**
 * 担当者を招く・役割を変える・担当を外す、1 本の口。
 *
 * 見るところは 2 つ。知らない役割を名簿へ通さないことと、
 * `intent` の値でどの操作へ振り分けるか。振り分けが崩れると、
 * 「役割を変えたつもりが担当を外していた」が黙って起きる。
 */

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

let signedIn: ActorContext | null = { ...SAMPLE_ACTOR, roles: ["owner"] };
const executeMembers = vi.fn();

vi.mock("@/presentation/composition", () => ({
  signedInActor: async () => signedIn,
  settingsUseCases: async () => ({ manageMembers: { execute: executeMembers } }),
}));

const { manageMemberAction } = await import("@/presentation/admin/maintain/member-action");

const IDLE = { status: "idle", message: "" } as const;

function form(pairs: readonly (readonly [string, string])[]): FormData {
  const data = new FormData();
  for (const [key, value] of pairs) data.append(key, value);
  return data;
}

beforeEach(() => {
  signedIn = { ...SAMPLE_ACTOR, roles: ["owner"] };
  executeMembers.mockReset();
  revalidatePath.mockReset();
});

describe("manageMemberAction", () => {
  it("未ログインなら、FormData を 1 度も読まずに断る", async () => {
    signedIn = null;
    const get = vi.fn();
    const state = await manageMemberAction(IDLE, { get } as unknown as FormData);

    expect(state.status).toBe("failed");
    expect(get).not.toHaveBeenCalled();
    expect(executeMembers).not.toHaveBeenCalled();
  });

  it("招くときは、知らない役割を落として名簿へ渡す", async () => {
    executeMembers.mockResolvedValue(ok({ message: "招きました。" }));
    const state = await manageMemberAction(
      IDLE,
      form([
        ["intent", "invite"],
        ["invitedEmail", "a@example.com"],
        ["displayName", "新しい人"],
        ["roles", "writer"],
        // 表に無い役割。通すと「役割はあるのに何もできない担当者」ができる。
        ["roles", "superuser"],
        ["roles", "reviewer"],
      ]),
    );

    expect(executeMembers.mock.calls[0][1]).toEqual({
      action: "invite",
      invitedEmail: "a@example.com",
      displayName: "新しい人",
      roles: ["writer", "reviewer"],
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/settings");
    expect(state).toEqual({ status: "done", message: "招きました。" });
  });

  it("役割を変えるときは、名簿の行の番号と理由を添えて渡す", async () => {
    executeMembers.mockResolvedValue(ok({ message: "変えました。" }));
    await manageMemberAction(
      IDLE,
      form([
        ["intent", "change_roles"],
        ["membershipId", "m-1"],
        ["roles", "publisher"],
        ["reason", "公開を任せる"],
      ]),
    );

    expect(executeMembers.mock.calls[0][1]).toEqual({
      action: "change_roles",
      membershipId: "m-1",
      roles: ["publisher"],
      reason: "公開を任せる",
    });
  });

  it("intent が空でも知らない値でも、取り消しへ落ちる", async () => {
    executeMembers.mockResolvedValue(ok({ message: "外しました。" }));
    await manageMemberAction(IDLE, form([["membershipId", "m-2"]]));
    await manageMemberAction(
      IDLE,
      form([
        ["intent", "なにか別のもの"],
        ["membershipId", "m-3"],
        ["reason", "退職"],
      ]),
    );

    expect(executeMembers.mock.calls[0][1]).toEqual({
      action: "revoke",
      membershipId: "m-2",
      reason: "",
    });
    expect(executeMembers.mock.calls[1][1]).toEqual({
      action: "revoke",
      membershipId: "m-3",
      reason: "退職",
    });
  });

  it("断られたら、断りの文と原因の欄を返し、描き直さない", async () => {
    executeMembers.mockResolvedValue(
      err(domainError("FORBIDDEN", "最後のオーナーは外せません。", { field: "membershipId" })),
    );
    const state = await manageMemberAction(IDLE, form([["membershipId", "m-1"]]));

    expect(state.status).toBe("failed");
    expect(state.field).toBe("membershipId");
    expect(state.message).toContain("最後のオーナーは外せません。");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
