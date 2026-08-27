/** @tier 1 @req REQ-P06 @types permission-matrix, equivalence */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { domainError, err, ok } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";

/**
 * 企画を 1 つ立てる操作。
 *
 * 要点は「複数選べる欄を `getAll` で読む」こと。`get` だと最初の 1 件しか届かず、
 * 3 人選んだのに 1 人だけ保存される——という気づけない欠け方をする。
 * 断る仕事（読者像 0 件・切り口 0 件）は domain 側なので、ここでは測らない。
 */

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

let signedIn: ActorContext | null = { ...SAMPLE_ACTOR, roles: ["owner"] };
const executePackage = vi.fn();

vi.mock("@/presentation/composition", () => ({
  signedInActor: async () => signedIn,
  contentPackageUseCases: async () => ({ savePackage: { execute: executePackage } }),
}));

const { createContentPackageAction } = await import(
  "@/presentation/admin/content-package-form-action"
);

const IDLE = { status: "idle", message: "" } as const;

function form(pairs: readonly (readonly [string, string])[]): FormData {
  const data = new FormData();
  for (const [key, value] of pairs) data.append(key, value);
  return data;
}

beforeEach(() => {
  signedIn = { ...SAMPLE_ACTOR, roles: ["owner"] };
  executePackage.mockReset();
  revalidatePath.mockReset();
});

describe("createContentPackageAction", () => {
  it("未ログインなら、FormData を 1 度も読まずに断る", async () => {
    signedIn = null;
    const get = vi.fn();
    const state = await createContentPackageAction(IDLE, { get } as unknown as FormData);

    expect(state.status).toBe("failed");
    expect(get).not.toHaveBeenCalled();
    expect(executePackage).not.toHaveBeenCalled();
  });

  it("何も選ばなければ、複数選べる欄は空の一覧で渡る", async () => {
    executePackage.mockResolvedValue(ok({ objective: "比べる" }));
    await createContentPackageAction(IDLE, form([]));

    const input = executePackage.mock.calls[0][1];
    expect(input.audiencePersonaIds).toEqual([]);
    expect(input.contentAngles).toEqual([]);
    expect(input.brandId).toBe("");
  });

  it("複数選んだ読者像と切り口が、1 件も欠けずに渡る", async () => {
    executePackage.mockResolvedValue(ok({ objective: "5 台を比べる" }));
    const state = await createContentPackageAction(
      IDLE,
      form([
        ["brandId", "b-1"],
        ["primarySubjectId", "p-1"],
        ["domainScope", "general"],
        ["authorPersonaId", "au-1"],
        ["audiencePersonaIds", "r-1"],
        ["audiencePersonaIds", "r-2"],
        ["audiencePersonaIds", "r-3"],
        ["objective", "5 台を比べる"],
        ["funnelStage", "consideration"],
        ["contentAngles", "comparison"],
        ["contentAngles", "how_to"],
      ]),
    );

    const input = executePackage.mock.calls[0][1];
    expect(input.audiencePersonaIds).toEqual(["r-1", "r-2", "r-3"]);
    expect(input.contentAngles).toEqual(["comparison", "how_to"]);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/content/packages");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/content/new");
    expect(state).toEqual({
      status: "done",
      message: "「5 台を比べる」を企画として登録しました。",
      packageListPath: "/admin/content/packages",
    });
  });

  it("断られたら、断りの文と原因の欄を返し、描き直さない", async () => {
    executePackage.mockResolvedValue(
      err(domainError("CONFLICT", "読者像が 1 つも選ばれていません。", { field: "audiencePersonaIds" })),
    );
    const state = await createContentPackageAction(IDLE, form([["objective", "比べる"]]));

    expect(state.status).toBe("failed");
    expect(state.field).toBe("audiencePersonaIds");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
