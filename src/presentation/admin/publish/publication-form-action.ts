"use server";

import { revalidatePath } from "next/cache";
import type { ChannelKind } from "@/domain/distribution";
import { distributionUseCases, signedInActor } from "@/presentation/composition";
import type { PublicationFormState } from "./publication-form-state";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";

/**
 * 送信前の配信を直す操作。
 *
 * 直せるのは出し先と出す時刻の 2 つ。どの記事を出すかは直せない。
 * 記事を差し替えられると、**承認したものと違う文章が承認済みの配信で外へ出る**。
 *
 * 出し始めた後は直せない（判断はユースケース側にある）。画面が
 * 状態で分岐すると、状態を 1 つ足した日に画面だけが古くなる。
 *
 * 時刻の空欄は「触らない」ではなく**「予約を外して即時にする」**。
 * この画面はいまの時刻を入れて開くので、消した＝外したいで正しい。
 */
export async function updatePublicationAction(
  _prev: PublicationFormState,
  formData: FormData,
): Promise<PublicationFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("配信の修正");

  const publicationId = String(formData.get("publicationId") ?? "");

  const result = await (await distributionUseCases()).update.execute(actor, {
    publicationId,
    channelKind: String(formData.get("channelKind") ?? "") as ChannelKind,
    scheduledAt: String(formData.get("scheduledAt") ?? ""),
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/distribution");
  revalidatePath("/admin/distribution/calendar");
  revalidatePath(`/admin/distribution/${publicationId}`);

  return {
    status: "done",
    message: `${result.value.card.channelLabel} への配信を直しました（${result.value.card.stateLabel}）。`,
    publicationPath: `/admin/distribution/${result.value.card.publicationId}`,
    manualExportNotice: result.value.manualExportNotice,
  };
}
