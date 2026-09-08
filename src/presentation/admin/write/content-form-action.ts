"use server";

import { revalidatePath } from "next/cache";
import type { ContentAngle, CtaType } from "@/domain/authoring";
import { READER_DISCLOSURE_TEXT } from "@/domain/compliance/disclosure";
import { contentEditingUseCases, signedInActor } from "@/presentation/composition";
import type { ContentFormState } from "./content-form-state";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";

/**
 * 記事の枠を 1 本作る操作。
 *
 * **広告表記は画面から受け取らない。** 出さなければならない文言であって
 * 書く人が決めるものではない。欄にすると、消せる・書き換えられる・
 * 打ち間違えられるの 3 つが同時に起きる。正本は domain の
 * `READER_DISCLOSURE_TEXT` 一か所に置き、ここはそれを写すだけにする。
 *
 * `currentActor()` ではなく `signedInActor()` を使うのは
 * `product-form-action.ts` と同じ理由で、前者は身元を確かめられないとき
 * **見本の身元へ落ちる**。
 */
export async function createContentVariantAction(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("記事の作成");

  const result = await (await contentEditingUseCases()).create.execute(actor, {
    contentPackageId: String(formData.get("contentPackageId") ?? ""),
    channel: String(formData.get("channel") ?? ""),
    format: String(formData.get("format") ?? ""),
    authorPersonaId: String(formData.get("authorPersonaId") ?? ""),
    audiencePersonaId: String(formData.get("audiencePersonaId") ?? ""),
    angle: String(formData.get("angle") ?? "") as ContentAngle,
    cta: String(formData.get("cta") ?? "") as CtaType,
    disclosure: READER_DISCLOSURE_TEXT.body,
    title: emptyToUndefined(formData.get("title")),
    body: String(formData.get("body") ?? ""),
    summary: String(formData.get("summary") ?? ""),
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/content");
  revalidatePath("/admin/content/matrix");

  return {
    status: "done",
    message: `${result.value.title ?? "名前のない記事"} を作りました。`,
    variantPath: `/admin/content/${result.value.variantId}`,
  };
}

/**
 * 記事の文章を直す操作。
 *
 * 直せるのは題・要約・本文の 3 つだけ。切り口も出し先も直せない。
 * それらを後から変えられると、**同じ 1 本が別の企画のものに化ける**。
 * 出し先を変えたいときは、その出し先の枠を新しく作る。
 */
export async function updateContentVariantAction(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("記事の修正");

  const variantId = String(formData.get("variantId") ?? "");

  const result = await (await contentEditingUseCases()).update.execute(actor, {
    variantId,
    // 空欄は「触らない」。消す印は置かない——題も要約も本文も、
    // 空にしてよい欄が無い（空の記事は業務側が断る）。
    title: emptyToUndefined(formData.get("title")),
    body: emptyToUndefined(formData.get("body")),
    summary: emptyToUndefined(formData.get("summary")),
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/${variantId}`);

  return {
    status: "done",
    message: `${result.value.title ?? "名前のない記事"} を直しました。`,
    variantPath: `/admin/content/${result.value.variantId}`,
    approvalCleared: result.value.approvalCleared,
  };
}

/** 空欄は「触らない」。渡さないことでユースケースに伝える。 */
function emptyToUndefined(value: FormDataEntryValue | null): string | undefined {
  const text = String(value ?? "").trim();
  return text === "" ? undefined : text;
}
