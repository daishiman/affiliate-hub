"use server";

import { revalidatePath } from "next/cache";
import { rankingCriteriaOptions, rankingUseCases, signedInActor } from "@/presentation/composition";
import type { RankingModelFormState, ScoreCardFormState } from "./ranking-form-state";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";

/**
 * 順位づけの基準を 1 つ立てる操作、と、商品 1 つに点を入れる操作。
 *
 * `currentActor()` ではなく `signedInActor()` を使う理由は
 * `content-package-form-action.ts` と同じで、前者は身元を確かめられないとき
 * **見本の身元へ落ちる**。落ちた身元で基準が立てられると、
 * 誰が決めた測り方なのか分からないまま順位が公開される。
 *
 * 重みの合計・禁止された指標・点の範囲を断るのはすべて domain 側。
 * 画面へ写すと写した側だけが古くなる。
 */

/** 数字の欄を読む。空欄は 0 として扱わず、`undefined` にして domain へ渡さない。 */
function readNumber(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? "").trim();
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isNaN(value) ? null : value;
}

export async function createRankingModelAction(
  _prev: RankingModelFormState,
  formData: FormData,
): Promise<RankingModelFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("評価基準の登録");

  /*
   * 指標の欄は「許可された指標の一覧」から作る。
   * 画面から来た名前をそのまま信じて集めると、綴りを間違えた指標が
   * 重み 0 の項目として保存され、合計 100% にならない理由が読めなくなる。
   */
  const criteria = rankingCriteriaOptions().map((option) => ({
    key: option.key,
    weightPercent: readNumber(formData, `weight_${option.key}`) ?? 0,
    measurement: String(formData.get(`measurement_${option.key}`) ?? ""),
    passThresholdPercent: readNumber(formData, `threshold_${option.key}`) ?? 0,
  }));

  const result = await (await rankingUseCases()).saveModel.execute(actor, {
    categoryId: String(formData.get("categoryId") ?? ""),
    version: String(formData.get("version") ?? ""),
    audience: String(formData.get("audience") ?? ""),
    effectiveFrom: String(formData.get("effectiveFrom") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    criteria,
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/rankings/models");
  // 点を入れる画面の選択肢もここで増える。作った直後に点を入れに行って
  // 「さっき作った基準が無い」となるのを防ぐ。
  revalidatePath("/admin/rankings/scores");
  revalidatePath("/admin/rankings");

  return {
    status: "done",
    message: `評価基準「${result.value.version}」を登録しました。次は商品に点を入れます。`,
    scoreEntryPath: `/admin/rankings/scores?model=${encodeURIComponent(result.value.modelId)}`,
  };
}

export async function saveScoreCardAction(
  _prev: ScoreCardFormState,
  formData: FormData,
): Promise<ScoreCardFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("商品の評価の登録");

  const scorePercents: Record<string, number> = {};
  for (const option of rankingCriteriaOptions()) {
    const value = readNumber(formData, `score_${option.key}`);
    // 空欄は「まだ測っていない」。0 点と読み替えない。0 と書けば 0 点になる。
    if (value !== null) scorePercents[option.key] = value;
  }

  const result = await (await rankingUseCases()).saveScoreCard.execute(actor, {
    modelId: String(formData.get("modelId") ?? ""),
    productId: String(formData.get("productId") ?? ""),
    scorePercents,
    // 1 行に複数書けるようにする。検証は 1 回とは限らない。
    evidenceRefs: String(formData.get("evidenceRefs") ?? "")
      .split(/[\n,]/)
      .map((r) => r.trim()),
    testedAt: String(formData.get("testedAt") ?? ""),
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/rankings");
  revalidatePath("/admin/rankings/scores");

  return {
    status: "done",
    message: `${result.value.scoredCount} 項目の点を登録しました。順位はこの点で計算し直されます。`,
    rankingPath: "/admin/rankings",
  };
}
