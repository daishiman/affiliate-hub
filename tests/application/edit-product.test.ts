/**
 * @tier 1
 * @req REQ-UX02
 * @types equivalence, decision-table
 *
 * 商品の登録・修正・削除。管理画面から人が押す 3 つの操作の分かれ目を、
 * 画面を通さずここで確かめる。
 *
 * --- ここで守りたいこと ---
 * 1. **根拠を消す変更だけを、参照の本数で断る。** 値を直すのは断らない。
 *    仕様は改訂されるので直せないほうが困る。困るのは「どこに書いてあったか」が
 *    消えて、記事の主張から根拠への線が切れることだけ。
 * 2. **消した理由を必ず書かせる。** 消した後に `after` は残らないので、
 *    差分からは「なぜ」が永久に読めない。
 * 3. **記録に書けなかったことを成功に混ぜない。** 保存はできて記録が書けないとき、
 *    「保存はした」と添えたうえで断りとして返す。
 */
import { describe, expect, it } from "vitest";
import {
  type EditProductDeps,
  createCreateProductUseCase,
  createDeleteProductUseCase,
  createUpdateProductUseCase,
} from "@/application/usecases/product/edit-product";
import { type Product, type ProductIdentityKey } from "@/domain/product";
import { type ProductId, type WorkspaceId, ok, taggedString } from "@/domain/shared";
import { SAMPLE_PRODUCTS, SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { aNobody, anOwner } from "../support/actors";
import { failing, testDeps } from "../support/doubles";

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const owner = anOwner({ workspaceId: WS });
const nobody = aNobody({ workspaceId: WS });

/** 見本の企画がこの商品を主題にしている。参照ありの側。 */
const REFERENCED = String(SAMPLE_PRODUCTS[0]!.id);
/** どの企画にも使われていない商品。参照なしの側。 */
const UNREFERENCED = String(SAMPLE_PRODUCTS[1]!.id);

/**
 * 見本の保管庫は保存も削除も断る（保存できない保管庫は消すこともできない）。
 * 分かれ目の先を見たいので、既定では受け取れるようにしておく。
 */
function deps(over: Partial<EditProductDeps> = {}): EditProductDeps {
  const base = testDeps({
    products: {
      save: async (p: Product) => ok(p),
      remove: async () => ok(true as const),
    },
  });
  return {
    products: base.products,
    packages: base.contentPackages,
    auditLog: base.auditLog,
    ids: base.ids,
    ...over,
  };
}

const KEYS: readonly ProductIdentityKey[] = [{ kind: "model_number", value: "AS-15" }];

function aCreateInput(over: Record<string, unknown> = {}) {
  return {
    brand: "Alpha",
    name: "Alpha Studio 15",
    identityKeys: KEYS,
    specifications: { weight_g: 1500 },
    officialUrl: "https://example.com/alpha-15",
    ...over,
  } as Parameters<ReturnType<typeof createCreateProductUseCase>["execute"]>[1];
}

describe("商品を登録する", () => {
  it("その権限が無い人には断る", async () => {
    const result = await createCreateProductUseCase(deps()).execute(nobody, aCreateInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });

  it("仕様が 1 つも無いと、どの欄の話かを添えて断る", async () => {
    const result = await createCreateProductUseCase(deps()).execute(
      owner,
      aCreateInput({ specifications: {} }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
      expect(result.error.field).toBe("specifications");
    }
  });

  it("出どころが空欄だと断る（空白だけも空欄と同じ）", async () => {
    const result = await createCreateProductUseCase(deps()).execute(
      owner,
      aCreateInput({ officialUrl: "   " }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe("officialUrl");
  });

  it("任意の欄を省いても登録できる", async () => {
    const result = await createCreateProductUseCase(deps()).execute(owner, aCreateInput());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe("Alpha Studio 15");
  });

  it("分類・製造元・説明を添えても登録できる", async () => {
    const result = await createCreateProductUseCase(deps()).execute(
      owner,
      aCreateInput({
        manufacturer: "Alpha 社",
        categoryId: "cat_laptop",
        description: "動画編集向け",
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("保管庫が受け取れなければ、その断りをそのまま返す", async () => {
    const broken = deps({
      products: testDeps({ products: { save: async () => failing<Product>() } }).products,
    });
    const result = await createCreateProductUseCase(broken).execute(owner, aCreateInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("記録が書けないときは「登録はした」と添えて断る", async () => {
    const noLog = deps({ auditLog: testDeps({ auditLog: { append: async () => failing() } }).auditLog });
    const result = await createCreateProductUseCase(noLog).execute(owner, aCreateInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("商品は登録しました");
  });
});

describe("商品を直す", () => {
  it("その権限が無い人には断る", async () => {
    const result = await createUpdateProductUseCase(deps()).execute(nobody, {
      productId: UNREFERENCED,
      name: "別名",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });

  it("ブランド限定担当者には参照企画の件数も明かさず、保存先も読まない", async () => {
    let referencesRead = false;
    const guarded = deps({
      packages: testDeps({
        contentPackages: {
          list: async () => {
            referencesRead = true;
            return failing();
          },
        },
      }).contentPackages,
    });
    const scoped = anOwner({
      workspaceId: WS,
      scopedBrandIds: [taggedString<"BrandId">("brand-limited")],
    });

    const result = await createUpdateProductUseCase(guarded).execute(scoped, {
      productId: REFERENCED,
      officialUrl: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("TENANT_MISMATCH");
    expect(referencesRead).toBe(false);
  });

  it("無い商品は、一覧から選び直すよう添えて断る", async () => {
    const result = await createUpdateProductUseCase(deps()).execute(owner, {
      productId: "p_nonexistent",
      name: "別名",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("商品を引けなければ、その断りをそのまま返す", async () => {
    const broken = deps({
      products: testDeps({ products: { findById: async () => failing<Product | null>() } }).products,
    });
    const result = await createUpdateProductUseCase(broken).execute(owner, {
      productId: UNREFERENCED,
      name: "別名",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("参照の本数を数えられなければ、そのまま断る（0 本として進めない）", async () => {
    const broken = deps({
      packages: testDeps({ contentPackages: { list: async () => failing() } }).contentPackages,
    });
    const result = await createUpdateProductUseCase(broken).execute(owner, {
      productId: UNREFERENCED,
      name: "別名",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("使われている商品から出どころを消すのは断り、本数を添える", async () => {
    const result = await createUpdateProductUseCase(deps()).execute(owner, {
      productId: REFERENCED,
      officialUrl: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
      expect(result.error.message).toContain("1 本");
      expect(result.error.details).toMatchObject({ referencingArticles: 1, truncated: false });
    }
  });

  it("使われている商品から仕様を全部消すのも同じ理由で断る", async () => {
    const result = await createUpdateProductUseCase(deps()).execute(owner, {
      productId: REFERENCED,
      specifications: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CONFLICT");
  });

  it("数えきれていないときは「以上」と書く", async () => {
    const truncated = deps({
      packages: testDeps({
        contentPackages: {
          list: async (_ws, _page) => {
            const base = await testDeps().contentPackages.list(WS, { limit: 200, cursor: null });
            if (!base.ok) return base;
            return ok({ items: base.value.items, nextCursor: "next" });
          },
        },
      }).contentPackages,
    });
    const result = await createUpdateProductUseCase(truncated).execute(owner, {
      productId: REFERENCED,
      officialUrl: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("1 本以上");
  });

  it("使われていない商品なら、出どころを消せる", async () => {
    const result = await createUpdateProductUseCase(deps()).execute(owner, {
      productId: UNREFERENCED,
      officialUrl: "",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.referencingArticles).toBe(0);
  });

  it("触らなかった欄は元のまま残る", async () => {
    const saved: Product[] = [];
    const capture = deps({
      products: testDeps({
        products: {
          save: async (p: Product) => {
            saved.push(p);
            return ok(p);
          },
        },
      }).products,
    });
    const found = await testDeps().products.findById(WS, SAMPLE_PRODUCTS[1]!.id as ProductId);
    const before = found.ok ? found.value : null;

    const result = await createUpdateProductUseCase(capture).execute(owner, {
      productId: UNREFERENCED,
      name: "新しい名前",
    });
    expect(result.ok).toBe(true);
    const next = saved[0]!;
    expect(next.name).toBe("新しい名前");
    expect(next.officialUrl).toBe(before?.officialUrl ?? null);
    expect(next.specifications).toEqual(before?.specifications);
    expect(next.manufacturer).toBe(before?.manufacturer ?? null);
  });

  it("出どころを差し替えたときだけ、取得日時も置き換える", async () => {
    const saved: Product[] = [];
    const capture = deps({
      products: testDeps({
        products: {
          save: async (p: Product) => {
            saved.push(p);
            return ok(p);
          },
        },
      }).products,
    });
    const before = await testDeps().products.findById(WS, SAMPLE_PRODUCTS[1]!.id as ProductId);
    const original = before.ok && before.value !== null ? before.value.provenance.retrievedAt : null;

    await createUpdateProductUseCase(capture).execute(owner, {
      productId: UNREFERENCED,
      officialUrl: "https://example.com/changed",
      manufacturer: null,
      description: null,
    });
    const next = saved[0]!;
    expect(next.provenance.sourceUrl).toBe("https://example.com/changed");
    expect(next.provenance.retrievedAt.getTime()).not.toBe(original?.getTime());
  });

  it("保管庫が受け取れなければ、その断りをそのまま返す", async () => {
    const broken = deps({
      products: testDeps({ products: { save: async () => failing<Product>() } }).products,
    });
    const result = await createUpdateProductUseCase(broken).execute(owner, {
      productId: UNREFERENCED,
      name: "別名",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("記録が書けないときは「保存はした」と添えて断る", async () => {
    const noLog = deps({ auditLog: testDeps({ auditLog: { append: async () => failing() } }).auditLog });
    const result = await createUpdateProductUseCase(noLog).execute(owner, {
      productId: UNREFERENCED,
      name: "別名",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("商品は保存しました");
  });
});

describe("商品を消す", () => {
  it("その権限が無い人には断る", async () => {
    const result = await createDeleteProductUseCase(deps()).execute(nobody, {
      productId: UNREFERENCED,
      reason: "重複",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });

  it("理由が空欄なら、権限があっても消させない", async () => {
    const result = await createDeleteProductUseCase(deps()).execute(owner, {
      productId: UNREFERENCED,
      reason: "  ",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
      expect(result.error.field).toBe("reason");
    }
  });

  it("無い商品は断る", async () => {
    const result = await createDeleteProductUseCase(deps()).execute(owner, {
      productId: "p_nonexistent",
      reason: "重複",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("参照の本数を数えられなければ、そのまま断る", async () => {
    const broken = deps({
      packages: testDeps({ contentPackages: { list: async () => failing() } }).contentPackages,
    });
    const result = await createDeleteProductUseCase(broken).execute(owner, {
      productId: UNREFERENCED,
      reason: "重複",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("使われている商品は、本数を添えて断る", async () => {
    const result = await createDeleteProductUseCase(deps()).execute(owner, {
      productId: REFERENCED,
      reason: "重複",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
      expect(result.error.details).toMatchObject({ referencingArticles: 1 });
    }
  });

  it("使われていない商品は消せる", async () => {
    const result = await createDeleteProductUseCase(deps()).execute(owner, {
      productId: UNREFERENCED,
      reason: "重複していたため",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.productId).toBe(UNREFERENCED);
  });

  it("保管庫が消せなければ、その断りをそのまま返す", async () => {
    const broken = deps({
      products: testDeps({ products: { remove: async () => failing<true>() } }).products,
    });
    const result = await createDeleteProductUseCase(broken).execute(owner, {
      productId: UNREFERENCED,
      reason: "重複",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("記録が書けないときは「消しました」と添えて断る", async () => {
    const noLog = deps({ auditLog: testDeps({ auditLog: { append: async () => failing() } }).auditLog });
    const result = await createDeleteProductUseCase(noLog).execute(owner, {
      productId: UNREFERENCED,
      reason: "重複",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("商品は消しました");
  });
});
