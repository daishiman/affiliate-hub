/** @tier 1 @req REQ-P08, REQ-E12 @types permission-matrix, equivalence, state-transition */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { domainError, err, ok } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";

/**
 * 消す・取り下げる・止める操作。
 *
 * 5 つとも `signedInActor()` を使う。`currentActor()` は身元を確かめられない
 * とき見本の身元へ落ちるので、**誰が消したか分からない削除**が起きる。
 * 断る条件（公開中か、参照が何本あるか）は 1 つもここに無い。
 * 測るのは「未ログインで止まること」と「戻り先の道」だけにしてある。
 */

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

let signedIn: ActorContext | null = { ...SAMPLE_ACTOR, roles: ["owner"] };
const removeProduct = vi.fn();
const removeContent = vi.fn();
const removeSite = vi.fn();
const cancelPublication = vi.fn();
const disableLink = vi.fn();

vi.mock("@/presentation/composition", () => ({
  signedInActor: async () => signedIn,
  productEditingUseCases: async () => ({ remove: { execute: removeProduct } }),
  contentEditingUseCases: async () => ({ remove: { execute: removeContent } }),
  siteEditingUseCases: async () => ({ remove: { execute: removeSite } }),
  distributionUseCases: async () => ({ cancel: { execute: cancelPublication } }),
  affiliateUseCases: async () => ({ disableLink: { execute: disableLink } }),
}));

const {
  deleteProductAction,
  deleteContentVariantAction,
  deleteManagedSiteAction,
  cancelPublicationAction,
  disableAffiliateLinkAction,
} = await import("@/presentation/admin/delete-form-action");

const IDLE = { status: "idle", message: "" } as const;

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

beforeEach(() => {
  signedIn = { ...SAMPLE_ACTOR, roles: ["owner"] };
  for (const spy of [removeProduct, removeContent, removeSite, cancelPublication, disableLink]) {
    spy.mockReset();
  }
  revalidatePath.mockReset();
});

const ACTIONS = [
  { name: "商品の削除", action: deleteProductAction, spy: removeProduct },
  { name: "記事の削除", action: deleteContentVariantAction, spy: removeContent },
  { name: "ブログの取り下げ", action: deleteManagedSiteAction, spy: removeSite },
  { name: "配信の取りやめ", action: cancelPublicationAction, spy: cancelPublication },
  { name: "成果リンクを止める", action: disableAffiliateLinkAction, spy: disableLink },
] as const;

describe("消す操作は、身元を確かめられないなら 1 つも進まない", () => {
  it.each(ACTIONS)("$name", async ({ action, spy }) => {
    signedIn = null;
    const get = vi.fn();
    const state = await action(IDLE, { get } as unknown as FormData);

    expect(state.status).toBe("failed");
    expect(get).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteProductAction", () => {
  it("消えた物の名前で知らせ、一覧へ戻す", async () => {
    removeProduct.mockResolvedValue(ok({ name: "掃除機A" }));
    const state = await deleteProductAction(IDLE, form({ productId: "p-1", reason: "重複" }));

    expect(removeProduct.mock.calls[0][1]).toEqual({ productId: "p-1", reason: "重複" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/products");
    expect(state).toEqual({
      status: "done",
      message: "掃除機A を消しました。",
      listPath: "/admin/products",
    });
  });

  it("断られたら、原因の欄を返し、一覧を描き直さない", async () => {
    removeProduct.mockResolvedValue(
      err(domainError("CONFLICT", "公開中の記事から参照されています。", { field: "productId" })),
    );
    const state = await deleteProductAction(IDLE, form({ productId: "p-1" }));

    expect(state.status).toBe("failed");
    expect(state.field).toBe("productId");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteContentVariantAction", () => {
  it("見出しが無い記事は、識別子ではなく言葉で言う", async () => {
    removeContent.mockResolvedValue(ok({ title: null }));
    const state = await deleteContentVariantAction(IDLE, form({ variantId: "v-1" }));

    // 「v-1 を消しました」では、消えた後に何のことか誰も分からない。
    expect(state.message).toBe("見出しの無い記事 を消しました。");
  });

  it("見出しがあればそれを使う", async () => {
    removeContent.mockResolvedValue(ok({ title: "はじめての選び方" }));
    const state = await deleteContentVariantAction(IDLE, form({ variantId: "v-1" }));

    expect(state.message).toBe("はじめての選び方 を消しました。");
    expect(state.listPath).toBe("/admin/content");
  });
});

describe("deleteManagedSiteAction", () => {
  it("取り下げたと言い、ブログの一覧へ戻す", async () => {
    removeSite.mockResolvedValue(ok({ name: "うちのブログ" }));
    const state = await deleteManagedSiteAction(IDLE, form({ siteSlug: "blog", reason: "統合" }));

    expect(revalidatePath).toHaveBeenCalledWith("/admin/sites");
    expect(state.message).toBe("うちのブログ を取り下げました。");
  });
});

describe("cancelPublicationAction", () => {
  it("一覧とその 1 件の両方を描き直す", async () => {
    cancelPublication.mockResolvedValue(ok({ card: { channelLabel: "X" } }));
    const state = await cancelPublicationAction(IDLE, form({ publicationId: "pub-1" }));

    expect(revalidatePath).toHaveBeenCalledWith("/admin/distribution");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/distribution/pub-1");
    expect(state.message).toBe("X への配信を取りやめました。");
  });

  it("すでに外へ出た配信は、遷移表の断りをそのまま伝える", async () => {
    cancelPublication.mockResolvedValue(
      err(domainError("CONFLICT", "すでに配信済みです。", { field: "publicationId" })),
    );
    const state = await cancelPublicationAction(IDLE, form({ publicationId: "pub-1" }));

    expect(state.status).toBe("failed");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("disableAffiliateLinkAction", () => {
  it("ユースケースが作った文をそのまま出し、一覧へ戻す", async () => {
    disableLink.mockResolvedValue(ok({ message: "3 本の記事から出なくなりました。" }));
    const state = await disableAffiliateLinkAction(
      IDLE,
      form({ affiliateLinkId: "a-1", reason: "提携終了" }),
    );

    expect(state).toEqual({
      status: "done",
      message: "3 本の記事から出なくなりました。",
      listPath: "/admin/affiliate/links",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/affiliate/links");
  });
});
