"use server";

import { revalidatePath } from "next/cache";
import { metricsRebuildEntry, signedInActor } from "@/presentation/composition";
import type { MetricsRebuildState } from "./metrics-rebuild-state";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";

/**
 * 日次集計を、日付を指定してやり直す。
 *
 * --- 身元は `signedInActor` で取る ---
 * `currentActor()` はログインできていないとき見本の身元へ落ちる。ここは
 * 画面を組み立てる場所ではなく**保存を起こす場所**なので、確かめられない
 * ときは渡さない側に倒す（`improvement-action.ts` と同じ判断）。
 *
 * --- 作り直したら画面も作り直す ---
 * やり直しの目的は「画面に出ている数字を直すこと」なので、成功したのに
 * 古い数字が出たままだと、直ったのかどうかを運営者が確かめられない。
 */
const audiencePath = (siteSlug: string) =>
  `/admin/sites/${encodeURIComponent(siteSlug)}/audience`;

export async function rebuildDailyMetricsAction(
  _prev: MetricsRebuildState,
  formData: FormData,
): Promise<MetricsRebuildState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("日次集計のやり直し");

  const entry = await metricsRebuildEntry();
  if (!entry.ready) return { status: "failed", message: entry.reason };

  const siteSlug = String(formData.get("siteSlug") ?? "").trim();
  const day = String(formData.get("day") ?? "").trim();

  const result = await entry.rebuild.execute(actor, { siteSlug, day });
  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath(audiencePath(siteSlug));
  revalidatePath(`/admin/sites/${encodeURIComponent(siteSlug)}/revenue`);

  /*
   * 0 件は失敗ではない。「その日に観測が 1 件も無かった」である。
   * ここを「やり直しました」で片付けると、日付を打ち間違えた人が
   * 直ったと思い込む。何件を作り直したかを必ず言う。
   */
  if (result.value.rebuilt === 0) {
    return {
      status: "done",
      message: `${result.value.day} には、このブログの観測が 1 件もありませんでした。集計は変えていません。`,
    };
  }
  return {
    status: "done",
    message: `${result.value.day} の集計を作り直しました（${result.value.rebuilt} 件）。`,
  };
}
