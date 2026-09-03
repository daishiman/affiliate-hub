/** @tier 1 @req REQ-P07 @types permission-matrix, equivalence */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { domainError, err, ok } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";

/**
 * ブログの固定文書を 1 枚保存する操作。
 *
 * 画面の都合（本文は 1 欄）を保存の形（段落の配列）へ直す仕事がここにある。
 * 空行で割る規則と、管理画面と読者の画面を**両方**描き直すことを固定する。
 * 片方だけだと、直した本人には新しい文が見え、読者には古い文が残る。
 */

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

let signedIn: ActorContext | null = { ...SAMPLE_ACTOR, roles: ["owner"] };
const executeSave = vi.fn();

vi.mock("@/presentation/composition", () => ({
  signedInActor: async () => signedIn,
  siteDocumentUseCases: async () => ({ save: { execute: executeSave } }),
}));

const { saveSiteDocumentAction } = await import("@/presentation/admin/publish/site-document-action");

const IDLE = { status: "idle", message: "" } as const;

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

beforeEach(() => {
  signedIn = { ...SAMPLE_ACTOR, roles: ["owner"] };
  executeSave.mockReset();
  revalidatePath.mockReset();
});

describe("saveSiteDocumentAction", () => {
  it("未ログインなら、FormData を 1 度も読まずに断る", async () => {
    signedIn = null;
    const get = vi.fn();
    const state = await saveSiteDocumentAction(IDLE, { get } as unknown as FormData);

    expect(state.status).toBe("failed");
    expect(get).not.toHaveBeenCalled();
    expect(executeSave).not.toHaveBeenCalled();
  });

  it("本文は空行で段落に割り、空白だけの段落は残さない", async () => {
    executeSave.mockResolvedValue(ok({}));
    await saveSiteDocumentAction(
      IDLE,
      form({
        siteSlug: "blog",
        key: "about",
        title: "このブログについて",
        body: " 1 段落目 \n\n   \n\n2 段落目\n続き\n\n\n",
      }),
    );

    expect(executeSave.mock.calls[0][1]).toEqual({
      siteSlug: "blog",
      key: "about",
      title: "このブログについて",
      body: ["1 段落目", "2 段落目\n続き"],
    });
  });

  it("保存できたら、管理画面と読者の画面を両方とも描き直す", async () => {
    executeSave.mockResolvedValue(ok({}));
    const state = await saveSiteDocumentAction(
      IDLE,
      form({ siteSlug: "my blog", key: "about", title: "案内", body: "本文" }),
    );

    expect(revalidatePath).toHaveBeenCalledWith("/admin/sites/my%20blog/documents");
    expect(revalidatePath).toHaveBeenCalledTimes(2);
    expect(revalidatePath.mock.calls[1][1]).toBe("layout");
    expect(state).toEqual({ status: "done", message: "保存しました。読者の画面にも出ています。" });
  });

  it("断られたら、断りの文と原因の欄を返し、描き直さない", async () => {
    executeSave.mockResolvedValue(
      err(domainError("CONFLICT", "この見出しは使えません。", { field: "key" })),
    );
    const state = await saveSiteDocumentAction(IDLE, form({ siteSlug: "blog", key: "だめ" }));

    expect(state.status).toBe("failed");
    expect(state.field).toBe("key");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
