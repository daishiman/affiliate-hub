/** @tier 1 @req REQ-P08 @types authorization, secret-boundary */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { domainError } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

let signedIn: ActorContext | null = { ...SAMPLE_ACTOR, roles: ["owner"] };
const executeRegister = vi.fn();

vi.mock("@/presentation/composition", () => ({
  signedInActor: async () => signedIn,
  distributionUseCases: async () => ({
    registerConnection: { execute: executeRegister },
  }),
}));

const { registerBlueskyConnectionAction } = await import(
  "@/presentation/admin/bluesky-connection-action"
);

const IDLE = { status: "idle", message: "" } as const;

beforeEach(() => {
  signedIn = { ...SAMPLE_ACTOR, roles: ["owner"] };
  executeRegister.mockReset();
  revalidatePath.mockReset();
});

describe("Bluesky接続を登録する管理画面操作", () => {
  it("未ログインならFormDataを読む前に止め、見本actorへ落とさない", async () => {
    signedIn = null;
    const get = vi.fn(() => "読んではいけない値");

    const state = await registerBlueskyConnectionAction(IDLE, { get } as unknown as FormData);

    expect(state).toMatchObject({ status: "failed" });
    expect(state.message).toContain("ログイン");
    expect(get).not.toHaveBeenCalled();
    expect(executeRegister).not.toHaveBeenCalled();
  });

  it("画面入力を受け取らず、Bluesky用の固定Secret参照だけを既存ユースケースへ渡す", async () => {
    executeRegister.mockResolvedValue({
      ok: true,
      value: {
        connectionId: "conn_bluesky",
        kind: "bluesky",
        accountLabel: "@publisher.example",
        usable: true,
        unavailableReason: null,
      },
    });
    const get = vi.fn(() => "利用者が差し替えようとした値");

    const state = await registerBlueskyConnectionAction(IDLE, { get } as unknown as FormData);

    expect(get).not.toHaveBeenCalled();
    expect(executeRegister).toHaveBeenCalledWith(signedIn, {
      channelKind: "bluesky",
      accountLabel: "Bluesky",
      credentialRef: "channel/conn_bluesky/credentials",
    });
    expect(state).toEqual({
      status: "done",
      message:
        "Blueskyの「@publisher.example」として接続しました。認証で確認したDIDも接続先として固定しました。",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/distribution");
  });

  it("owner/workspace_admin以外を既存ユースケースが拒否した理由と次の手を日本語で返す", async () => {
    executeRegister.mockResolvedValue({
      ok: false,
      error: domainError("FORBIDDEN", "外部媒体との接続管理を行う権限がありません。", {
        suggestedAction: "ワークスペース管理者に依頼してください。",
      }),
    });

    const state = await registerBlueskyConnectionAction(IDLE, new FormData());

    expect(state).toEqual({
      status: "failed",
      message:
        "外部媒体との接続管理を行う権限がありません。\nワークスペース管理者に依頼してください。",
      field: undefined,
    });
  });
});
