/**
 * @tier 1
 * @req REQ-BOPS12
 * @types decision-table, equivalence, boundary, permission-matrix
 *
 * 記事の表紙（サムネイル）を登録する・外す入口。
 *
 * --- なぜここを見るのか ---
 *
 * 実測（2026-09-08）で分岐 **0.0%**。書いた日から一度も通っていない。
 * この口は 6 通りの断り方を持つのに、画面からはどれも同じ「失敗しました」に
 * 見える。断る場所を取り違えても見た目では分からない。
 *
 * 見るのは 4 つ。
 *
 * 1. **身元と保存先が揃うまで業務側へ行かない。**未ログインで表紙が
 *    差し替わると、誰が差し替えたか分からない絵が記事の先頭に載る。
 * 2. **幅は名前で受け取る。**`derived-640` が来なかった日に、
 *    1280 の絵が 640 として配られてはならない。
 * 3. **「もともと無い」と「外した」を言い分ける。**どちらも成功だが、
 *    運営者が次に取る行動が違う。
 * 4. **作り直す画面は記事 1 本ぶんだけ。**
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { domainError, err, ok } from "@/domain/shared";
import { THUMBNAIL_WIDTHS } from "@/domain/blogops";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

let signedIn: ActorContext | null = { ...SAMPLE_ACTOR, roles: ["owner"] };
let storageReady = true;
const setThumbnail = vi.fn();
const removeThumbnail = vi.fn();

vi.mock("@/presentation/composition", () => ({
  signedInActor: async () => signedIn,
  blogOpsEntry: async () =>
    storageReady
      ? {
          ready: true,
          setThumbnail: { execute: setThumbnail },
          removeThumbnail: { execute: removeThumbnail },
        }
      : { ready: false, reason: "保存先 (D1) が用意されていません。" },
}));

const { manageArticleThumbnailAction } = await import(
  "@/presentation/admin/publish/article-thumbnail-action"
);

const IDLE = { status: "idle", message: "" } as const;

/** 絵 1 枚。中身は問われない（画素を見るデコーダは workerd に無い）。 */
function image(bytes: number, type = "image/webp"): File {
  return new File([new Uint8Array(bytes)], "cover.webp", { type });
}

function form(
  entries: Record<string, string>,
  files: Record<string, File> = {},
): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  for (const [key, file] of Object.entries(files)) data.append(key, file);
  return data;
}

beforeEach(() => {
  signedIn = { ...SAMPLE_ACTOR, roles: ["owner"] };
  storageReady = true;
  setThumbnail.mockReset();
  removeThumbnail.mockReset();
  revalidatePath.mockReset();
  setThumbnail.mockResolvedValue(ok({ derivedWidths: [...THUMBNAIL_WIDTHS] }));
  removeThumbnail.mockResolvedValue(ok({ removed: true }));
});

describe("業務側へ行く前に断る", () => {
  it("身元を確かめられないなら、保存先も見ずに止まる", async () => {
    signedIn = null;
    const state = await manageArticleThumbnailAction(
      IDLE,
      form({ articleId: "art-1", intent: "set" }, { original: image(8) }),
    );
    expect(state.status).toBe("failed");
    expect(setThumbnail).not.toHaveBeenCalled();
    expect(removeThumbnail).not.toHaveBeenCalled();
  });

  it("保存先が無いなら、その理由をそのまま返す", async () => {
    storageReady = false;
    const state = await manageArticleThumbnailAction(
      IDLE,
      form({ articleId: "art-1", intent: "set" }, { original: image(8) }),
    );
    expect(state).toEqual({
      status: "failed",
      message: "保存先 (D1) が用意されていません。",
    });
    expect(setThumbnail).not.toHaveBeenCalled();
  });

  it.each(["", "publish", "SET"])("知らない操作 %o は断る", async (intent) => {
    const state = await manageArticleThumbnailAction(
      IDLE,
      form({ articleId: "art-1", intent }, { original: image(8) }),
    );
    expect(state.status).toBe("failed");
    expect(state.field).toBe("intent");
    expect(setThumbnail).not.toHaveBeenCalled();
  });

  it.each([
    ["欄そのものが無い", undefined],
    ["中身が空", image(0)],
    ["File ではなく文字列", "cover.webp"],
  ])("登録なのに原本が %s なら、業務側へ行かずに断る", async (_label, original) => {
    const data = form({ articleId: "art-1", intent: "set" });
    if (original instanceof File) data.append("original", original);
    else if (typeof original === "string") data.append("original", original);
    const state = await manageArticleThumbnailAction(IDLE, data);
    expect(state).toEqual({
      status: "failed",
      message: "画像を選んでください。",
      field: "original",
    });
    expect(setThumbnail).not.toHaveBeenCalled();
  });
});

describe("表紙を登録する", () => {
  it("原本と、名前のついた縮小版だけを渡す", async () => {
    await manageArticleThumbnailAction(
      IDLE,
      form(
        { articleId: "art-1", intent: "set", altText: "  海辺の写真  " },
        {
          original: image(64, "image/png"),
          "derived-320": image(8),
          "derived-1280": image(32),
        },
      ),
    );
    const [actor, input] = setThumbnail.mock.calls[0] as [ActorContext, {
      articleId: string;
      mimeType: string;
      original: ArrayBuffer;
      derived: readonly { width: number; bytes: ArrayBuffer }[];
      altText: string;
    }];
    expect(actor).toEqual(signedIn);
    expect(input.articleId).toBe("art-1");
    expect(input.mimeType).toBe("image/png");
    expect(input.original.byteLength).toBe(64);
    expect(input.altText).toBe("海辺の写真");
    // 落ちた 640 は「単に来ない」だけで、残りの幅の対応はずれない。
    expect(input.derived.map((one) => one.width)).toEqual([320, 1280]);
    expect(input.derived.map((one) => one.bytes.byteLength)).toEqual([8, 32]);
  });

  it("中身が空の縮小版は、幅だけ来ても数に入れない", async () => {
    await manageArticleThumbnailAction(
      IDLE,
      form(
        { articleId: "art-1", intent: "set", "derived-640": "" },
        { original: image(64), "derived-320": image(0) },
      ),
    );
    const input = setThumbnail.mock.calls[0]?.[1] as { derived: readonly unknown[] };
    expect(input.derived).toEqual([]);
  });

  it("縮小版が 1 枚も無いことを、成功の文面で言い分ける", async () => {
    setThumbnail.mockResolvedValue(ok({ derivedWidths: [] }));
    const state = await manageArticleThumbnailAction(
      IDLE,
      form({ articleId: "art-1", intent: "set" }, { original: image(64) }),
    );
    expect(state.status).toBe("done");
    expect(state.message).toContain("原本 1 枚をそのまま配ります");
  });

  it("配れる幅を文面に出す", async () => {
    setThumbnail.mockResolvedValue(ok({ derivedWidths: [320, 640] }));
    const state = await manageArticleThumbnailAction(
      IDLE,
      form({ articleId: "art-1", intent: "set" }, { original: image(64) }),
    );
    expect(state.message).toContain("320 / 640");
  });

  it("業務側が断ったら、その理由を出して画面を作り直さない", async () => {
    setThumbnail.mockResolvedValue(
      err(domainError("VALIDATION_FAILED", "対応していない形式です。", { field: "original" })),
    );
    const state = await manageArticleThumbnailAction(
      IDLE,
      form({ articleId: "art-1", intent: "set" }, { original: image(64) }),
    );
    expect(state.status).toBe("failed");
    expect(state.message).toContain("対応していない形式です。");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("成功したら記事 1 本ぶんの画面だけを作り直す", async () => {
    await manageArticleThumbnailAction(
      IDLE,
      form({ articleId: "art-1", intent: "set" }, { original: image(64) }),
    );
    expect(revalidatePath.mock.calls).toEqual([["/admin/blog/articles/art-1"]]);
  });
});

describe("表紙を外す", () => {
  it("外したときと、もともと無かったときで文面を変える", async () => {
    removeThumbnail.mockResolvedValue(ok({ removed: true }));
    const removed = await manageArticleThumbnailAction(
      IDLE,
      form({ articleId: "art-1", intent: "remove" }),
    );
    expect(removed.message).toContain("表紙を外しました。");

    removeThumbnail.mockResolvedValue(ok({ removed: false }));
    const absent = await manageArticleThumbnailAction(
      IDLE,
      form({ articleId: "art-1", intent: "remove" }),
    );
    expect(absent.status).toBe("done");
    expect(absent.message).toBe("この記事にはもともと表紙がありません。");
  });

  it("外すときは原本を要求しない（登録の側の断りを引きずらない）", async () => {
    const state = await manageArticleThumbnailAction(
      IDLE,
      form({ articleId: "art-1", intent: "remove" }),
    );
    expect(state.status).toBe("done");
    expect(setThumbnail).not.toHaveBeenCalled();
    expect(removeThumbnail).toHaveBeenCalledWith(signedIn, { articleId: "art-1" });
  });

  it("業務側が断ったら画面を作り直さない", async () => {
    removeThumbnail.mockResolvedValue(
      err(domainError("NOT_FOUND", "記事が見つかりません (id: art-1)。")),
    );
    const state = await manageArticleThumbnailAction(
      IDLE,
      form({ articleId: "art-1", intent: "remove" }),
    );
    expect(state.status).toBe("failed");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
