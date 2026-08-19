"use server";

import { revalidatePath } from "next/cache";
import { publicationCalendarUseCases, signedInActor } from "@/presentation/composition";
import type { RescheduleState } from "./reschedule-state";
import { notSignedInText, refusalText } from "@/presentation/refusal-text";

/**
 * 投稿予定日の変更。
 *
 * 仕様では「カレンダー上のドラッグで日時を変更」とあるが、
 * 掴んで動かす操作はキーボードだけでは行えない。
 * ここでは**日時を選ぶ入力欄**を正の手段とし、
 * 掴む操作を後から足す場合も、同じこの操作を呼ぶ形にする。
 * そうしておけば「掴んだときだけ検査が甘い」という抜け道ができない。
 */

// 状態の型と初期値は `reschedule-state.ts` にある。

/**
 * --- 身元の取り方について ---
 * `currentActor()` ではなく `signedInActor()` を使う。前者は身元を
 * 確かめられないとき**見本の身元へ落ちる**ので、ログインしていない人の操作が
 * ユースケースまで届く。届いた先の砦は**役の一覧**で、あれは人が編集する表である。
 *
 * 予定日を**前へ**動かすと、まだ確認の済んでいない記事が先に外へ出ていく。
 * 出た後に引き戻す口は無い。2026-08-19 の実測では、ログインしていない状態で
 * 予定日が本当に動いた（`ah-dao`）。
 */
export async function reschedulePublicationAction(
  _prev: RescheduleState,
  formData: FormData,
): Promise<RescheduleState> {
  const actor = await signedInActor();
  if (actor === null) {
    // **`formData` を読む前に断る。** 読んでから断ると、断り文が
    // 「日時を入れてください」に化けて、押した人は日時を変えて何度も試す。
    return { status: "failed", message: notSignedInText("投稿予定日の変更") };
  }

  const publicationId = String(formData.get("publicationId") ?? "");
  const scheduledAt = String(formData.get("scheduledAt") ?? "");

  const result = await (await publicationCalendarUseCases()).reschedule.execute(actor, {
    publicationId,
    scheduledAt,
  });

  if (!result.ok) {
    return {
      status: "failed",
      // 直し方が分かる言葉を優先する。原因の説明だけでは次の操作が決まらない。
      message: refusalText(result.error),
      field: result.error.field,
    };
  }

  revalidatePath("/admin/distribution/calendar");
  revalidatePath("/admin/distribution");
  return { status: "done", message: result.value.message };
}
