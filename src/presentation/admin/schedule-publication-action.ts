"use server";

import { revalidatePath } from "next/cache";
import type { ChannelKind } from "@/domain/distribution";
import { distributionUseCases, signedInActor } from "@/presentation/composition";
import type { SchedulePublicationState } from "./schedule-publication-state";
import { notSignedInText, refusalText } from "@/presentation/refusal-text";

/**
 * 記事の画面から配信を作る操作。
 *
 * ここは**4 つ目の入口**で、REST・WebMCP・バックエンド MCP と同じ
 * `schedule` ユースケースを呼ぶ。承認の確認も、出し先の決め方も、
 * 二重登録の防止もユースケース側にある。画面側へ写さない。
 * 写した時点で「画面からは出せないが AI からは出せる」が生まれる。
 *
 * --- 身元の取り方について ---
 * `currentActor()` ではなく `signedInActor()` を使う。前者は身元を
 * 確かめられないとき**見本の身元へ落ちる**ので、ログインしていない人の操作が
 * ユースケースまで届く。届いた先の砦は**役の一覧**で、あれは人が編集する表である。
 *
 * 配信の予約は**押した後に元へ戻す口が無い**。決めた時刻が来れば外へ出ていき、
 * 出た後に引き戻せない（`ah-dao`）。
 */
export async function schedulePublicationAction(
  _prev: SchedulePublicationState,
  formData: FormData,
): Promise<SchedulePublicationState> {
  const actor = await signedInActor();
  if (actor === null) {
    // **`formData` を読む前に断る。** 読んでから断ると、断り文が
    // 「この欄が足りません」に化けて、押した人は欄を埋めて何度も試す。
    return { status: "failed", message: notSignedInText("配信の予約") };
  }

  const variantId = String(formData.get("variantId") ?? "");
  const channelKind = String(formData.get("channelKind") ?? "") as ChannelKind;
  const scheduledAt = String(formData.get("scheduledAt") ?? "");

  const result = await (await distributionUseCases()).schedule.execute(actor, {
    variantId,
    channelKind,
    scheduledAt,
  });

  if (!result.ok) {
    return {
      status: "failed",
      // 次にすることが書いてあるならそちらを出す。原因だけ出しても直せない。
      message: refusalText(result.error),
      field: result.error.field,
    };
  }

  revalidatePath(`/admin/content/${variantId}`);
  revalidatePath("/admin/distribution");
  revalidatePath("/admin/distribution/calendar");

  return {
    status: "done",
    message: result.value.alreadyExisted
      ? "同じ内容の配信がすでに登録されています。新しくは作りませんでした。"
      : `${result.value.card.channelLabel} への配信を登録しました（${result.value.card.stateLabel}）。`,
    alreadyExisted: result.value.alreadyExisted,
    publicationPath: `/admin/distribution/${result.value.card.publicationId}`,
    manualExportNotice: result.value.manualExportNotice,
  };
}
