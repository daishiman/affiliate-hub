"use server";

import { revalidatePath } from "next/cache";
import type { ChannelKind } from "@/domain/distribution";
import { currentActor, distributionUseCases } from "@/presentation/composition";
import type { SchedulePublicationState } from "./schedule-publication-state";

/**
 * 記事の画面から配信を作る操作。
 *
 * ここは**4 つ目の入口**で、REST・WebMCP・バックエンド MCP と同じ
 * `schedule` ユースケースを呼ぶ。承認の確認も、出し先の決め方も、
 * 二重登録の防止もユースケース側にある。画面側へ写さない。
 * 写した時点で「画面からは出せないが AI からは出せる」が生まれる。
 */
export async function schedulePublicationAction(
  _prev: SchedulePublicationState,
  formData: FormData,
): Promise<SchedulePublicationState> {
  const variantId = String(formData.get("variantId") ?? "");
  const channelKind = String(formData.get("channelKind") ?? "") as ChannelKind;
  const scheduledAt = String(formData.get("scheduledAt") ?? "");

  const result = await distributionUseCases().schedule.execute(await currentActor(), {
    variantId,
    channelKind,
    scheduledAt,
  });

  if (!result.ok) {
    return {
      status: "failed",
      // 次にすることが書いてあるならそちらを出す。原因だけ出しても直せない。
      message: result.error.suggestedAction ?? result.error.message,
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
