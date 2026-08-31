/**
 * @tier 1
 * @req REQ-UX02
 * @types equivalence, decision-table
 *
 * 管理画面の「作る・直す・消す」を押したときに動くもの。
 *
 * --- なぜユースケースを差し替えるのか ---
 * ここで見たいのは**画面から届いた形をユースケースの入力へ直す部分**である。
 * 見本の保管庫は保存も削除も断るので、本物を通すと全部が同じ断りに落ち、
 * 「空欄を触らないこと」「同一性の鍵を 1 つだけ受けること」といった
 * 直し方の分かれ目が**緑のまま何も確かめなくなる**。
 * 断る判断そのものは `tests/application/edit-product.test.ts` が本物で見ている。
 *
 * --- ここで守りたいこと ---
 * 1. **ログインしていない人には、黙って何も起きないのではなく理由が返る。**
 * 2. **空欄は「触らない」。** 消したいときだけ消す印を付ける。
 *    空文字を消去の合図にすると、打ち間違えと消すつもりが見分けられない。
 * 3. **広告表記は画面から受け取らない。** 正本は domain 側の 1 か所。
 * 4. **軸が欠けたブログは落とす。** 空文字で埋めた書き出しを枠に残さない。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { READER_DISCLOSURE_TEXT } from "@/domain/compliance";
import { type DomainError, type Result, domainError, err, ok } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));

/** ログインできているか。誰であるかとは別の軸。 */
let loggedIn = true;

/** 差し替えたユースケースが受け取った入力。届いた形の直し方を、ここで読む。 */
const seen: Record<string, unknown> = {};

/** 次に返す結果。既定は成功で、断りを見たい回だけ差し替える。 */
let productCreate: Result<unknown, DomainError>;
let productUpdate: Result<unknown, DomainError>;
let productRemove: Result<unknown, DomainError>;
let contentCreate: Result<unknown, DomainError>;
let contentUpdate: Result<unknown, DomainError>;
let contentRemove: Result<unknown, DomainError>;
let conceptDrafts: Result<unknown, DomainError>;
let siteRemove: Result<unknown, DomainError>;
let siteList: Result<unknown, DomainError>;

function recording(name: string, read: () => Result<unknown, DomainError>) {
  return {
    execute: async (_actor: unknown, input: unknown) => {
      seen[name] = input;
      return read();
    },
  };
}

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    signedInActor: async () => (loggedIn ? SAMPLE_ACTOR : null),
    productEditingUseCases: async () => ({
      create: recording("product.create", () => productCreate),
      update: recording("product.update", () => productUpdate),
      remove: recording("product.remove", () => productRemove),
    }),
    contentEditingUseCases: async () => ({
      create: recording("content.create", () => contentCreate),
      update: recording("content.update", () => contentUpdate),
      remove: recording("content.remove", () => contentRemove),
      createConceptDrafts: recording("content.drafts", () => conceptDrafts),
    }),
    siteEditingUseCases: async () => ({
      remove: recording("site.remove", () => siteRemove),
    }),
    platformUseCases: async () => ({
      listSites: recording("platform.listSites", () => siteList),
    }),
  };
});

const { createProductAction, updateProductAction } = await import(
  "@/presentation/admin/material/product-form-action"
);
const { createContentVariantAction, updateContentVariantAction } = await import(
  "@/presentation/admin/write/content-form-action"
);
const { deleteContentVariantAction, deleteManagedSiteAction, deleteProductAction } = await import(
  "@/presentation/admin/delete-form-action"
);
const { createConceptDraftsAction } = await import("@/presentation/admin/write/concept-drafts-action");

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

/** `redirect()` は本物のまま受け止める。差し替えると行き先の間違いが緑になる。 */
async function movedTo(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (thrown) {
    const digest = String((thrown as { digest?: unknown }).digest ?? "");
    if (digest.startsWith("NEXT_REDIRECT")) {
      return digest.split(";").find((part) => part.startsWith("/")) ?? "";
    }
    throw thrown;
  }
  throw new Error("移動が起きませんでした。");
}

const IDLE = { status: "idle", message: "" } as const;
const REFUSED = err(
  domainError("VALIDATION_FAILED", "受け取れません。", { field: "specifications" }),
);

beforeEach(() => {
  loggedIn = true;
  for (const key of Object.keys(seen)) delete seen[key];
  productCreate = ok({ productId: "p_1", name: "Alpha" });
  productUpdate = ok({ productId: "p_1", name: "Alpha", referencingArticles: 2 });
  productRemove = ok({ productId: "p_1", name: "Alpha" });
  contentCreate = ok({ variantId: "cv_1", title: "題" });
  contentUpdate = ok({ variantId: "cv_1", title: "題", approvalCleared: true });
  contentRemove = ok({ variantId: "cv_1", title: "題" });
  conceptDrafts = ok({ created: ["cv_1", "cv_2"] });
  siteRemove = ok({ siteSlug: "s1", name: "見本ブログ" });
  siteList = ok({ items: [{ slug: "s1", name: "見本ブログ" }], nextCursor: null });
});

describe("商品を登録する操作", () => {
  it("ログインしていなければ、理由を添えて断る", async () => {
    loggedIn = false;
    const state = await createProductAction(IDLE, form({ brand: "A", name: "B" }));
    expect(state.status).toBe("failed");
    expect(state.message.trim()).not.toBe("");
  });

  it("仕様の書き方が分からない行は、その行を引用して断る", async () => {
    const state = await createProductAction(
      IDLE,
      form({ brand: "A", name: "B", specifications: "重さだけ書いた行" }),
    );
    expect(state.status).toBe("failed");
    expect(state.field).toBe("specifications");
    expect(state.message).toContain("重さだけ書いた行");
  });

  it("同一性の鍵は、種類と値の両方が揃ったときだけ渡す", async () => {
    await createProductAction(
      IDLE,
      form({ brand: "A", name: "B", specifications: "重さ: 1.5", identityKind: "jan" }),
    );
    expect(seen["product.create"]).toMatchObject({ identityKeys: [] });

    await createProductAction(
      IDLE,
      form({
        brand: "A",
        name: "B",
        specifications: "重さ: 1.5",
        identityKind: "jan",
        identityValue: "4900000000000",
      }),
    );
    expect(seen["product.create"]).toMatchObject({
      identityKeys: [{ kind: "jan", value: "4900000000000" }],
    });
  });

  it("空欄の任意項目は渡さない（触らない）", async () => {
    await createProductAction(
      IDLE,
      form({ brand: "A", name: "B", specifications: "重さ: 1.5", manufacturer: "   " }),
    );
    const input = seen["product.create"] as Record<string, unknown>;
    expect(input.manufacturer).toBeUndefined();
    expect(input.description).toBeUndefined();
  });

  it("業務側が断れば、その理由と欄をそのまま画面へ返す", async () => {
    productCreate = REFUSED;
    const state = await createProductAction(IDLE, form({ brand: "A", name: "B" }));
    expect(state.status).toBe("failed");
    expect(state.field).toBe("specifications");
  });

  it("通れば、できた商品を見に行く先を返す", async () => {
    const state = await createProductAction(
      IDLE,
      form({ brand: "A", name: "B", specifications: "重さ: 1.5" }),
    );
    expect(state.status).toBe("done");
    expect(state.productPath).toBe("/admin/products/p_1");
  });
});

describe("商品を直す操作", () => {
  it("ログインしていなければ断る", async () => {
    loggedIn = false;
    const state = await updateProductAction(IDLE, form({ productId: "p_1" }));
    expect(state.status).toBe("failed");
  });

  it("仕様の書き方が分からない行は断る", async () => {
    const state = await updateProductAction(
      IDLE,
      form({ productId: "p_1", specifications: "壊れた行" }),
    );
    expect(state.field).toBe("specifications");
  });

  it("仕様欄が空なら、仕様には触らない", async () => {
    await updateProductAction(IDLE, form({ productId: "p_1", specifications: "   " }));
    expect((seen["product.update"] as Record<string, unknown>).specifications).toBeUndefined();
  });

  it("消す印が付いた欄だけを `null`（消す）にする", async () => {
    await updateProductAction(
      IDLE,
      form({ productId: "p_1", manufacturer: "Alpha 社", clearManufacturer: "on" }),
    );
    const input = seen["product.update"] as Record<string, unknown>;
    // 印が勝つ。値が入っていても消す。
    expect(input.manufacturer).toBeNull();
    // 印が無い欄は触らない。
    expect(input.description).toBeUndefined();
  });

  it("業務側が断れば、その理由を画面へ返す", async () => {
    productUpdate = REFUSED;
    const state = await updateProductAction(IDLE, form({ productId: "p_1" }));
    expect(state.status).toBe("failed");
  });

  it("通れば、及ぶ記事の本数を添えて返す", async () => {
    const state = await updateProductAction(IDLE, form({ productId: "p_1", name: "新" }));
    expect(state.status).toBe("done");
    expect(state.referencingArticles).toBe(2);
  });
});

describe("記事を作る・直す操作", () => {
  it("ログインしていなければ、作るのも直すのも断る", async () => {
    loggedIn = false;
    expect((await createContentVariantAction(IDLE, form({}))).status).toBe("failed");
    expect((await updateContentVariantAction(IDLE, form({}))).status).toBe("failed");
  });

  it("広告表記は画面から受け取らず、domain の正本を渡す", async () => {
    await createContentVariantAction(IDLE, form({ contentPackageId: "cp_1", disclosure: "偽の表記" }));
    expect((seen["content.create"] as Record<string, unknown>).disclosure).toBe(
      READER_DISCLOSURE_TEXT.body,
    );
  });

  it("題が空欄なら渡さない（本文と要約は空でも渡して業務側に断らせる）", async () => {
    await createContentVariantAction(IDLE, form({ contentPackageId: "cp_1", title: "  " }));
    const input = seen["content.create"] as Record<string, unknown>;
    expect(input.title).toBeUndefined();
    expect(input.body).toBe("");
  });

  it("作るのが断られたら理由を返し、通れば見に行く先を返す", async () => {
    contentCreate = REFUSED;
    expect((await createContentVariantAction(IDLE, form({}))).status).toBe("failed");

    contentCreate = ok({ variantId: "cv_9", title: null });
    const done = await createContentVariantAction(IDLE, form({}));
    expect(done.status).toBe("done");
    expect(done.message).toContain("名前のない記事");
    expect(done.variantPath).toBe("/admin/content/cv_9");
  });

  it("直せるのは題・要約・本文だけで、空欄は触らない", async () => {
    await updateContentVariantAction(
      IDLE,
      form({ variantId: "cv_1", title: "新しい題", body: "  ", angle: "data_first" }),
    );
    const input = seen["content.update"] as Record<string, unknown>;
    expect(input.title).toBe("新しい題");
    expect(input.body).toBeUndefined();
    expect(input.angle).toBeUndefined();
  });

  it("承認が外れたことを知らせる", async () => {
    const state = await updateContentVariantAction(IDLE, form({ variantId: "cv_1" }));
    expect(state.status).toBe("done");
    expect(state.approvalCleared).toBe(true);
  });

  it("直すのが断られたら理由を返す", async () => {
    contentUpdate = REFUSED;
    expect((await updateContentVariantAction(IDLE, form({ variantId: "cv_1" }))).status).toBe(
      "failed",
    );
  });
});

describe("消す操作", () => {
  it("ログインしていなければ、3 つとも理由を添えて断る", async () => {
    loggedIn = false;
    expect((await deleteProductAction(IDLE, form({}))).message.trim()).not.toBe("");
    expect((await deleteContentVariantAction(IDLE, form({}))).message.trim()).not.toBe("");
    expect((await deleteManagedSiteAction(IDLE, form({}))).message.trim()).not.toBe("");
  });

  it("商品: 断られたら理由、通れば戻り先の一覧を返す", async () => {
    productRemove = REFUSED;
    expect((await deleteProductAction(IDLE, form({ productId: "p_1" }))).status).toBe("failed");

    productRemove = ok({ productId: "p_1", name: "Alpha" });
    const done = await deleteProductAction(IDLE, form({ productId: "p_1", reason: "重複" }));
    expect(done.status).toBe("done");
    expect(done.listPath).toBe("/admin/products");
    expect(seen["product.remove"]).toMatchObject({ productId: "p_1", reason: "重複" });
  });

  it("記事: 見出しが無ければ、識別子ではなく言葉で言う", async () => {
    contentRemove = ok({ variantId: "cv_1", title: null });
    const done = await deleteContentVariantAction(IDLE, form({ variantId: "cv_1", reason: "重複" }));
    expect(done.message).toContain("見出しの無い記事");
    expect(done.listPath).toBe("/admin/content");
  });

  it("記事: 断られたら理由を返す", async () => {
    contentRemove = REFUSED;
    expect((await deleteContentVariantAction(IDLE, form({}))).status).toBe("failed");
  });

  it("ブログ: 断られたら理由、通れば一覧へ戻す", async () => {
    siteRemove = REFUSED;
    expect((await deleteManagedSiteAction(IDLE, form({}))).status).toBe("failed");

    siteRemove = ok({ siteSlug: "s1", name: "見本ブログ" });
    const done = await deleteManagedSiteAction(IDLE, form({ siteSlug: "s1", reason: "終了" }));
    expect(done.status).toBe("done");
    expect(done.listPath).toBe("/admin/sites");
  });
});

describe("コンセプト別の書き出しをまとめて作る操作", () => {
  function conceptForm(entries: Record<string, string>): FormData {
    const data = new FormData();
    data.set("contentPackageId", "cp_1");
    for (const [key, value] of Object.entries(entries)) data.set(key, value);
    return data;
  }

  it("ログインしていなければ、理由を持って元の画面へ戻す", async () => {
    loggedIn = false;
    const to = await movedTo(() => createConceptDraftsAction(conceptForm({})));
    expect(to).toContain("/admin/content/matrix?failed=");
  });

  it("ブログの一覧が引けなければ、理由を持って戻す", async () => {
    siteList = REFUSED;
    const to = await movedTo(() => createConceptDraftsAction(conceptForm({})));
    expect(to).toContain("/admin/content/matrix?failed=");
  });

  it("3 軸が揃ったブログだけを渡し、名前は id から引き直す", async () => {
    await movedTo(() =>
      createConceptDraftsAction(
        conceptForm({
          "concept[s1][audience]": "初心者",
          "concept[s1][searchIntent]": "比較",
          "concept[s1][stance]": "中立",
          // 軸が欠けたブログ。落とす。
          "concept[s2][audience]": "上級者",
          // 形が合わない値。無視する。
          other: "x",
        }),
      ),
    );
    expect(seen["content.drafts"]).toMatchObject({
      contentPackageId: "cp_1",
      targets: [{ siteName: "見本ブログ", audience: "初心者", searchIntent: "比較", stance: "中立" }],
    });
  });

  it("設計図に無い id は、名前の代わりに id のまま渡す", async () => {
    await movedTo(() =>
      createConceptDraftsAction(
        conceptForm({
          "concept[unknown][audience]": "初心者",
          "concept[unknown][searchIntent]": "比較",
          "concept[unknown][stance]": "中立",
        }),
      ),
    );
    const input = seen["content.drafts"] as { targets: readonly { siteName: string }[] };
    expect(input.targets[0]?.siteName).toBe("unknown");
  });

  it("作るのが断られたら、理由を持って元の画面へ戻す", async () => {
    conceptDrafts = REFUSED;
    const to = await movedTo(() => createConceptDraftsAction(conceptForm({})));
    expect(to).toContain("/admin/content/matrix?failed=");
  });

  it("通れば、作った本数を添えて記事の一覧へ移る", async () => {
    const to = await movedTo(() => createConceptDraftsAction(conceptForm({})));
    expect(to).toBe("/admin/content?created=2");
  });
});
