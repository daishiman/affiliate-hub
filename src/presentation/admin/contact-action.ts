"use server";

import { revalidatePath } from "next/cache";
import { contactUseCases, signedInActor } from "@/presentation/composition";
import { notSignedInText, refusalText } from "@/presentation/refusal-text";
import type { ContactHandledState } from "./contact-state";

/**
 * 問い合わせに「対応済み」の印を付ける / 外す。
 *
 * 身元は `currentActor()` ではなく `signedInActor()` で取る。
 * 前者は身元を確かめられないとき**見本の身元へ落ちる**ので、
 * ログインしていない人の操作がユースケースまで届く（`ah-dao` と同じ理由）。
 * ここで扱うのは読者が書いた文章で、誰が読んだかを言えない状態にはできない。
 *
 * 権限（`feedback.status_update`）はユースケース側が見る。
 * ここで見ると、入口ごとに判定が分かれて片方が緩くなる。
 */
export async function markContactHandledAction(
  _prev: ContactHandledState,
  formData: FormData,
): Promise<ContactHandledState> {
  const actor = await signedInActor();
  if (actor === null) {
    // `formData` を読む前に断る。読んでから断ると、断り文が
    // 「どの問い合わせか分かりません」に化けて、原因が身元だと伝わらない。
    return { status: "failed", message: notSignedInText("問い合わせの対応状況の変更") };
  }

  const id = String(formData.get("id") ?? "");
  if (id === "") {
    return { status: "failed", message: "どの問い合わせかが分かりませんでした。", field: "id" };
  }
  // 既定は「対応済みにする」。外すときだけ `handled=no` を送る。
  const handled = String(formData.get("handled") ?? "yes") !== "no";

  const result = await (await contactUseCases()).markHandled.execute(actor, { id, handled });
  if (!result.ok) {
    return { status: "failed", message: refusalText(result.error), field: result.error.field };
  }

  revalidatePath("/admin/contact");
  return {
    status: "done",
    message: handled
      ? "対応済みにしました。未対応へ戻すこともできます。"
      : "未対応へ戻しました。一覧に出ます。",
  };
}
