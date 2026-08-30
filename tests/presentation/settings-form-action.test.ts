/** @tier 1 @req REQ-P01, REQ-E04 @types permission-matrix, equivalence, screen-states */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { domainError, err, ok } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";

/**
 * ブランドと作業場所の保存。
 *
 * どちらも「足りないものがあっても保存はする」形で、知らせの文だけが変わる。
 * ここで測るのは、その分かれ目が**足りないものの件数**で決まっていること。
 * 保存できたのに「できませんでした」と読める文を出すと、
 * 埋め終わるまで保存しない人が出て、途中の入力が失われる。
 */

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

let signedIn: ActorContext | null = { ...SAMPLE_ACTOR, roles: ["owner"] };
const executeBrand = vi.fn();
const executeWorkspace = vi.fn();

vi.mock("@/presentation/composition", () => ({
  signedInActor: async () => signedIn,
  settingsUseCases: async () => ({
    saveBrand: { execute: executeBrand },
    updateWorkspace: { execute: executeWorkspace },
  }),
}));

const { saveBrandAction, updateWorkspaceAction } = await import(
  "@/presentation/admin/maintain/settings-form-action"
);

const IDLE = { status: "idle", message: "" } as const;

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

beforeEach(() => {
  signedIn = { ...SAMPLE_ACTOR, roles: ["owner"] };
  executeBrand.mockReset();
  executeWorkspace.mockReset();
  revalidatePath.mockReset();
});

describe("saveBrandAction", () => {
  it("未ログインなら、FormData を 1 度も読まずに断る", async () => {
    signedIn = null;
    const get = vi.fn();
    const state = await saveBrandAction(IDLE, { get } as unknown as FormData);

    expect(state.status).toBe("failed");
    expect(get).not.toHaveBeenCalled();
    expect(executeBrand).not.toHaveBeenCalled();
  });

  it("欄は前後の空白を落として渡り、使わない言い回しは 1 行 1 件で割れる", async () => {
    executeBrand.mockResolvedValue(ok({ brandId: "b-1", displayName: "うちの店", missing: [] }));
    const state = await saveBrandAction(
      IDLE,
      form({
        brandId: " ",
        displayName: " うちの店 ",
        legalName: "株式会社うち",
        contactEmail: "info@example.com",
        positioning: "初心者向け",
        politeness: "です・ます",
        firstPerson: "私たち",
        vocabulary: "やさしい",
        avoidPhrases: "絶対\n\n 最安 ",
        disclaimer: "広告を含みます",
        locale: "ja-JP",
        timeZone: "Asia/Tokyo",
        defaultCta: "詳しく見る",
      }),
    );

    const input = executeBrand.mock.calls[0][1];
    expect(input.brandId).toBe("");
    expect(input.displayName).toBe("うちの店");
    expect(input.avoidPhrases).toEqual(["絶対", "最安"]);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/settings/workspaces");
    expect(state.brandId).toBe("b-1");
    expect(state.message).toContain("公開に必要な項目はすべて埋まっています。");
  });

  it("足りないものがあっても保存は済んだと言い切り、続けて要るものを並べる", async () => {
    executeBrand.mockResolvedValue(
      ok({ brandId: "b-1", displayName: "うちの店", missing: ["連絡先", "免責"] }),
    );
    const state = await saveBrandAction(IDLE, form({ displayName: "うちの店" }));

    expect(state.status).toBe("done");
    expect(state.message).toContain("保存しました");
    expect(state.message).toContain("連絡先・免責 が要ります。");
    expect(state.missing).toEqual(["連絡先", "免責"]);
  });

  it("断られたら、断りの文と原因の欄を返し、描き直さない", async () => {
    executeBrand.mockResolvedValue(
      err(domainError("CONFLICT", "連絡先の形が違います。", { field: "contactEmail" })),
    );
    const state = await saveBrandAction(IDLE, form({ contactEmail: "だめ" }));

    expect(state.status).toBe("failed");
    expect(state.field).toBe("contactEmail");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateWorkspaceAction", () => {
  it("未ログインなら、FormData を 1 度も読まずに断る", async () => {
    signedIn = null;
    const get = vi.fn();
    const state = await updateWorkspaceAction(IDLE, { get } as unknown as FormData);

    expect(state.status).toBe("failed");
    expect(get).not.toHaveBeenCalled();
    expect(executeWorkspace).not.toHaveBeenCalled();
  });

  it("上限を超えていなければ、区分だけを知らせる", async () => {
    executeWorkspace.mockResolvedValue(
      ok({ workspaceName: "うち", planLabel: "無料", overLimits: [] }),
    );
    const state = await updateWorkspaceAction(
      IDLE,
      form({ name: " うち ", plan: "free", timezone: "Asia/Tokyo", currency: "JPY" }),
    );

    expect(executeWorkspace.mock.calls[0][1]).toEqual({
      name: "うち",
      plan: "free",
      timezone: "Asia/Tokyo",
      currency: "JPY",
    });
    expect(state.message).toBe("作業場所「うち」の設定を保存しました。区分は無料です。");
    expect(state.overLimits).toEqual([]);
  });

  it("上限を超えているときは、既にあるものが消えないことまで伝える", async () => {
    executeWorkspace.mockResolvedValue(
      ok({ workspaceName: "うち", planLabel: "無料", overLimits: ["ブログ", "担当者"] }),
    );
    const state = await updateWorkspaceAction(IDLE, form({ plan: "free" }));

    expect(state.status).toBe("done");
    expect(state.message).toContain("ブログ、担当者");
    expect(state.message).toContain("既にあるものは消えません。");
  });

  it("断られたら、断りの文を返し、描き直さない", async () => {
    executeWorkspace.mockResolvedValue(err(domainError("FORBIDDEN", "区分を変える権限がありません。")));
    const state = await updateWorkspaceAction(IDLE, form({ plan: "pro" }));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("区分を変える権限がありません。");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
