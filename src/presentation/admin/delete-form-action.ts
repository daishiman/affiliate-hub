"use server";

import { revalidatePath } from "next/cache";
import {
  affiliateUseCases,
  contentEditingUseCases,
  distributionUseCases,
  productEditingUseCases,
  signedInActor,
  siteEditingUseCases,
} from "@/presentation/composition";
import type { DeleteFormState } from "./delete-form-state";
import { failureFromDomainError, notSignedInFailure } from "./use-case-result";

/**
 * 消す操作。3 つとも「識別子と理由を渡して、消えた物の名前を受け取る」同じ形。
 *
 * **断る判断は 1 つもここに書かない。** 公開中かどうか、参照している記事が
 * 何本あるかはユースケースが数えて断る。画面側に条件を写すと、
 * 条件が 1 つ増えた日に画面だけが古いまま「消せます」と言う。
 *
 * `currentActor()` ではなく `signedInActor()` を使う。前者は身元を確かめられない
 * とき**見本の身元へ落ちる**。落ちた身元で消せると、誰が消したか分からない
 * 削除の記録が残る。
 */
export async function deleteProductAction(
  _prev: DeleteFormState,
  formData: FormData,
): Promise<DeleteFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("商品の削除");

  const result = await (await productEditingUseCases()).remove.execute(actor, {
    productId: String(formData.get("productId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/products");

  return {
    status: "done",
    message: `${result.value.name} を消しました。`,
    listPath: "/admin/products",
  };
}

export async function deleteContentVariantAction(
  _prev: DeleteFormState,
  formData: FormData,
): Promise<DeleteFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("記事の削除");

  const result = await (await contentEditingUseCases()).remove.execute(actor, {
    variantId: String(formData.get("variantId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/content");

  return {
    status: "done",
    // 見出しが無いまま消した記事もある。名前の代わりに識別子で言わない——
    // 識別子を出しても、消えた後では何のことか誰も分からない。
    message: `${result.value.title ?? "見出しの無い記事"} を消しました。`,
    listPath: "/admin/content",
  };
}

export async function deleteManagedSiteAction(
  _prev: DeleteFormState,
  formData: FormData,
): Promise<DeleteFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("ブログの取り下げ");

  const result = await (await siteEditingUseCases()).remove.execute(actor, {
    siteSlug: String(formData.get("siteSlug") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/sites");

  return {
    status: "done",
    message: `${result.value.name} を取り下げました。`,
    listPath: "/admin/sites",
  };
}

/**
 * 予定していた配信を取りやめる。
 *
 * 上の 3 つと違い、記録そのものは消えない。**残したまま「出ない」へ移す。**
 * 配信は外へ出る操作なので、出さなかった事実も後から辿れる必要がある。
 * だから戻り先は一覧ではなく、その配信の詳細のままにしてある。
 *
 * すでに外へ出たものを取りやめられないのは domain の遷移表が決めている。
 * ここには条件を書かない。書けば、遷移表が 1 行変わった日に画面だけが古くなる。
 */
export async function cancelPublicationAction(
  _prev: DeleteFormState,
  formData: FormData,
): Promise<DeleteFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("配信の取りやめ");

  const publicationId = String(formData.get("publicationId") ?? "");
  const result = await (await distributionUseCases()).cancel.execute(actor, { publicationId });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/distribution");
  revalidatePath(`/admin/distribution/${publicationId}`);

  return {
    status: "done",
    message: `${result.value.card.channelLabel} への配信を取りやめました。`,
    listPath: "/admin/distribution",
  };
}

/**
 * 成果リンクを止める。
 *
 * 上の 4 つと違い、**行は 1 つも消えない。** `disabled_at` が立つだけで、
 * 記事に貼ったままでも公開のときに読者へ出なくなる。
 * 消さないのは、読者が実際に見た商品名と URL を残すためで、
 * 「この値段だと書いてあったから買った」に後から答えられるのはこの行だけである。
 *
 * だから戻り先は一覧のまま。止めた直後に、同じ商品を新しいリンクとして
 * 登録し直す作業が続くので、その入口が見えている場所へ戻す。
 */
export async function disableAffiliateLinkAction(
  _prev: DeleteFormState,
  formData: FormData,
): Promise<DeleteFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("成果リンクを止める");

  const result = await (await affiliateUseCases()).disableLink.execute(actor, {
    affiliateLinkId: String(formData.get("affiliateLinkId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/affiliate/links");

  return {
    status: "done",
    message: result.value.message,
    listPath: "/admin/affiliate/links",
  };
}
