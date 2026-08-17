"use server";

import { revalidatePath } from "next/cache";
import { currentActor, publicationCalendarUseCases } from "@/presentation/composition";
import type { RescheduleState } from "./reschedule-state";

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

export async function reschedulePublicationAction(
  _prev: RescheduleState,
  formData: FormData,
): Promise<RescheduleState> {
  const publicationId = String(formData.get("publicationId") ?? "");
  const scheduledAt = String(formData.get("scheduledAt") ?? "");

  const result = await publicationCalendarUseCases().reschedule.execute(await currentActor(), {
    publicationId,
    scheduledAt,
  });

  if (!result.ok) {
    return {
      status: "failed",
      // 直し方が分かる言葉を優先する。原因の説明だけでは次の操作が決まらない。
      message: result.error.suggestedAction ?? result.error.message,
      field: result.error.field,
    };
  }

  revalidatePath("/admin/distribution/calendar");
  revalidatePath("/admin/distribution");
  return { status: "done", message: result.value.message };
}
