"use server";

import { revalidatePath } from "next/cache";
import { blogOpsEntry, signedInActor } from "@/presentation/composition";
import { parseIntentOrFailure } from "./blog-action-input";
import type { BlogOpsState } from "./blog-ops-state";
import { failureFromDomainError, notSignedInFailure } from "./use-case-result";

/**
 * 読者が付けた評価を伏せる／戻す。
 *
 * **消す口を作っていない。** 票は行として残し、印だけを付け替える。
 * 消す形にすると「伏せた」と「最初から無かった」が同じ姿になり、
 * 伏せた判断そのものを後から確かめられない。
 *
 * 伏せると戻すを 1 つの口にしているのは、画面が同じ 1 つの欄
 * （なぜそうするのか）を両方に使うためである。
 */
export async function manageBlogRatingAction(
  _prev: BlogOpsState,
  formData: FormData,
): Promise<BlogOpsState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("評価の非表示");

  const entry = await blogOpsEntry();
  if (!entry.ready) return { status: "failed", message: entry.reason };

  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const articleId = text("articleId");
  const intent = parseIntentOrFailure(text("intent"), ["hide", "show"] as const);
  if (!intent.ok) return intent.failure;
  const hidden = intent.value === "hide";

  const result = await entry.setRatingHidden.execute(actor, {
    articleId,
    ratingId: text("ratingId"),
    hidden,
    reason: text("reason"),
  });
  if (!result.ok) {
    return failureFromDomainError(result.error);
  }

  revalidatePath(`/admin/blog/evaluate/${encodeURIComponent(articleId)}`);
  // 平均と件数が動くので、一覧の側も作り直す。
  revalidatePath("/admin/blog/evaluate");
  return {
    status: "done",
    message: hidden
      ? "この評価を伏せました。行は残っているので、あとで戻せます。"
      : "この評価を戻しました。平均と件数に入り直します。",
  };
}
