"use server";

import { revalidatePath } from "next/cache";
import type { IdentityKeyKind } from "@/domain/product";
import { productEditingUseCases, signedInActor } from "@/presentation/composition";
import { type ProductFormState, parseSpecifications } from "./product-form-state";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";

/**
 * 商品を登録する操作。
 *
 * 画面用の別ルートを作らず、REST・WebMCP・MCP と同じ `create_product` の
 * ユースケースを呼ぶ。仕様と出どころを揃えて求めるのも、同一性の鍵の扱いも
 * ユースケース側にある。画面へ写した時点で、写した側だけが古くなる。
 *
 * `currentActor()` ではなく `signedInActor()` を使う理由は
 * `schedule-publication-action.ts` に書いた通りで、前者は身元を確かめられないとき
 * **見本の身元へ落ちる**。落ちた身元で商品が登録できると、誰が入れたか分からない
 * 商品が比較表の列になる。
 */
export async function createProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("商品の登録");

  const specs = parseSpecifications(String(formData.get("specifications") ?? ""));
  if (specs.badLine !== null) {
    return {
      status: "failed",
      field: "specifications",
      message: `「${specs.badLine}」の書き方が分かりません。1 行に「項目名: 値」の形で書いてください。`,
    };
  }

  const identityKind = String(formData.get("identityKind") ?? "");
  const identityValue = String(formData.get("identityValue") ?? "").trim();

  const result = await (await productEditingUseCases()).create.execute(actor, {
    brand: String(formData.get("brand") ?? ""),
    name: String(formData.get("name") ?? ""),
    manufacturer: emptyToUndefined(formData.get("manufacturer")),
    description: emptyToUndefined(formData.get("description")),
    // 同一性の鍵は 1 つだけ受ける。**複数入れる画面にしない。**
    // 2 つ目以降は「同じ商品を指しているか」の判断が要り、それは登録の場で下せない。
    identityKeys:
      identityKind === "" || identityValue === ""
        ? []
        : [{ kind: identityKind as IdentityKeyKind, value: identityValue }],
    specifications: specs.values,
    officialUrl: String(formData.get("officialUrl") ?? ""),
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/products");

  return {
    status: "done",
    message: `${result.value.name} を登録しました。`,
    productPath: `/admin/products/${result.value.productId}`,
  };
}

/**
 * 商品を直す操作。
 *
 * 空欄の扱いが登録と違う。**空欄は「触らない」**で、消したいときは
 * 「この項目を消す」を選ぶ。空文字を消去の合図にすると、
 * 打ち間違えて全部消した操作と、消すつもりの操作が見分けられない。
 */
export async function updateProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("商品の修正");

  const productId = String(formData.get("productId") ?? "");
  const specsText = String(formData.get("specifications") ?? "");
  const specs = parseSpecifications(specsText);
  if (specs.badLine !== null) {
    return {
      status: "failed",
      field: "specifications",
      message: `「${specs.badLine}」の書き方が分かりません。1 行に「項目名: 値」の形で書いてください。`,
    };
  }

  const result = await (await productEditingUseCases()).update.execute(actor, {
    productId,
    brand: emptyToUndefined(formData.get("brand")),
    name: emptyToUndefined(formData.get("name")),
    manufacturer: emptyToNullable(formData.get("manufacturer"), formData.get("clearManufacturer")),
    description: emptyToNullable(formData.get("description"), formData.get("clearDescription")),
    specifications: specsText.trim() === "" ? undefined : specs.values,
    officialUrl: emptyToUndefined(formData.get("officialUrl")),
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);

  return {
    status: "done",
    message: `${result.value.name} を直しました。`,
    productPath: `/admin/products/${result.value.productId}`,
    referencingArticles: result.value.referencingArticles,
  };
}

/** 空欄は「触らない」。渡さないことでユースケースに伝える。 */
function emptyToUndefined(value: FormDataEntryValue | null): string | undefined {
  const text = String(value ?? "").trim();
  return text === "" ? undefined : text;
}

/**
 * 空欄は「触らない」、消す印が付いていれば `null`（＝消す）。
 *
 * 3 通りを 2 つの入力で表す。`undefined` と `null` を 1 つの欄で
 * 表そうとすると、必ずどちらかが空文字に化ける。
 */
function emptyToNullable(
  value: FormDataEntryValue | null,
  clear: FormDataEntryValue | null,
): string | null | undefined {
  if (clear !== null) return null;
  return emptyToUndefined(value);
}
