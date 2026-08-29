/** @tier 1 @req REQ-UX02, REQ-P10 @types equivalence, boundary, tenant-isolation */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { domainError, err, ok } from "@/domain/shared";

/**
 * 読者の「気になる」の保存と取り外し。
 *
 * 見るところは 3 つ。押した時刻をサーバで決めること、空欄の補足を
 * **鍵ごと落とす**こと（空文字を入れると画面に空の見出しが立つ）、
 * そして合言葉が押した瞬間にだけ配られること。
 */

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const executeSave = vi.fn();
const executeRemove = vi.fn();
const READER = { kind: "reader" } as const;

vi.mock("@/presentation/composition", () => ({
  readerActor: () => READER,
  readerUseCases: async () => ({
    saveToShortlist: { execute: executeSave },
    removeFromShortlist: { execute: executeRemove },
  }),
}));

const ensureReaderIdentity = vi.fn(async () => "reader-key-1");
vi.mock("@/presentation/site/reader-identity", () => ({ ensureReaderIdentity }));

const { saveToShortlistAction, removeFromShortlistAction } = await import(
  "@/presentation/site/shortlist-action"
);

const IDLE = { status: "idle", message: "" } as const;

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

beforeEach(() => {
  executeSave.mockReset();
  executeRemove.mockReset();
  revalidatePath.mockReset();
  ensureReaderIdentity.mockClear();
});

describe("saveToShortlistAction", () => {
  it("空欄の補足は、空文字ではなく鍵ごと落とす", async () => {
    executeSave.mockResolvedValue(ok({}));
    await saveToShortlistAction(
      IDLE,
      form({ siteSlug: "blog", productId: "p-1", productName: "商品", oneLine: "  " }),
    );

    const item = executeSave.mock.calls[0][1].item;
    expect(item).not.toHaveProperty("oneLine");
    expect(item).not.toHaveProperty("fromArticleHref");
  });

  it("押した時刻はサーバで決め、合言葉を添えて保存し、一覧を描き直す", async () => {
    executeSave.mockResolvedValue(ok({}));
    const before = Date.now();
    const state = await saveToShortlistAction(
      IDLE,
      form({
        siteSlug: "blog",
        productId: "p-1",
        productName: " 商品 ",
        fromArticleHref: "/s/blog/a",
        oneLine: "軽い",
      }),
    );

    const [actor, input] = executeSave.mock.calls[0];
    expect(actor).toBe(READER);
    expect(input.readerKey).toBe("reader-key-1");
    expect(input.item.productName).toBe("商品");
    expect(input.item.fromArticleHref).toBe("/s/blog/a");
    expect(input.item.oneLine).toBe("軽い");
    expect(Date.parse(input.item.savedAt)).toBeGreaterThanOrEqual(before);
    expect(ensureReaderIdentity).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/s/blog/shortlist");
    expect(state).toEqual({ status: "done", message: "「気になる」に保存しました。" });
  });

  it("断られたら、断りの文と原因の欄を返し、描き直さない", async () => {
    executeSave.mockResolvedValue(
      err(domainError("CONFLICT", "この商品は見つかりません。", { field: "productId" })),
    );
    const state = await saveToShortlistAction(IDLE, form({ siteSlug: "blog", productId: "x" }));

    expect(state.status).toBe("failed");
    expect(state.field).toBe("productId");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("removeFromShortlistAction", () => {
  it("外すときも合言葉を添え、同じ一覧を描き直す", async () => {
    executeRemove.mockResolvedValue(ok({}));
    const state = await removeFromShortlistAction(
      IDLE,
      form({ siteSlug: "blog", productId: " p-1 " }),
    );

    expect(executeRemove.mock.calls[0][1]).toEqual({
      siteSlug: "blog",
      readerKey: "reader-key-1",
      productId: "p-1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/s/blog/shortlist");
    expect(state).toEqual({ status: "done", message: "「気になる」から外しました。" });
  });

  it("断られたら、断りの文を返し、描き直さない", async () => {
    executeRemove.mockResolvedValue(err(domainError("NOT_IMPLEMENTED", "保存先がありません。")));
    const state = await removeFromShortlistAction(IDLE, form({ siteSlug: "blog" }));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("保存先がありません。");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
