"use server";

import { revalidatePath } from "next/cache";
import type { DomainError } from "@/domain/shared";
import { improvementUseCases, signedInActor } from "@/presentation/composition";
import { refusalText } from "@/presentation/refusal-text";
import type { ImprovementFormState } from "./improvement-state";

/**
 * 改善ループを回す操作。
 *
 * 画面から呼ぶのはここだけで、中身は
 * **REST / WebMCP / バックエンド MCP と同じユースケース**を呼ぶ。
 * 判定の式も、状態の進み方も、ここには 1 行も無い。
 *
 * 1 周は 試作を登録する → 承認する → 始める → 観測を書く → 判定する。
 * 承認を飛ばせないのは仕様 §14.5（見た目だけの変更も人が承認する）による。
 *
 * 身元は `currentActor()` ではなく `signedInActor()` で取る。
 * あちらはログインできていないとき**見本の身元へ落ちる**ので、
 * 見本へ役を 1 つ足した日に、ログインしていない人が比較を始められるようになる。
 * ここは画面を組み立てる場所ではなく**保存を起こす場所**なので、
 * 確かめられないときは渡さない側に倒す（`composition.ts` の使い分けのとおり）。
 */

const IMPROVEMENT_PATH = "/admin/improvement";

/** ログインできていないときの断り。個々の操作名は出さない（何が在るかを教えない）。 */
const NOT_SIGNED_IN: ImprovementFormState = {
  status: "failed",
  message: "ログインし直してください。この操作には、誰が行ったかの記録が要ります。",
};

export async function draftVariantSpecAction(
  _prev: ImprovementFormState,
  formData: FormData,
): Promise<ImprovementFormState> {
  const siteSlug = String(formData.get("siteSlug") ?? "");
  const label = String(formData.get("label") ?? "");
  // 軸は画面が並べた分だけ届く。ここで軸の名前を書き起こさない
  // （書き起こすと、軸を 1 つ足した日に画面と食い違う）。
  const settings = formData
    .getAll("dimensionKey")
    .map((key, index) => ({
      dimensionKey: String(key),
      value: String(formData.getAll("dimensionValue")[index] ?? ""),
    }));

  const actor = await signedInActor();
  if (actor === null) return NOT_SIGNED_IN;

  const result = await (await improvementUseCases()).draftSpec.execute(actor, {
    siteSlug,
    label,
    settings,
  });
  if (!result.ok) return failed(result.error);

  revalidatePath(IMPROVEMENT_PATH);
  return { status: "done", message: result.value.message };
}

export async function approveVariantSpecAction(
  _prev: ImprovementFormState,
  formData: FormData,
): Promise<ImprovementFormState> {
  const actor = await signedInActor();
  if (actor === null) return NOT_SIGNED_IN;

  const result = await (await improvementUseCases()).approveSpec.execute(actor, {
    siteSlug: String(formData.get("siteSlug") ?? ""),
    specId: String(formData.get("specId") ?? ""),
  });
  if (!result.ok) return failed(result.error);

  revalidatePath(IMPROVEMENT_PATH);
  return { status: "done", message: result.value.message };
}

export async function startLoopRunAction(
  _prev: ImprovementFormState,
  formData: FormData,
): Promise<ImprovementFormState> {
  const actor = await signedInActor();
  if (actor === null) return NOT_SIGNED_IN;

  const minimum = String(formData.get("minimumSamples") ?? "");
  const result = await (await improvementUseCases()).start.execute(actor, {
    siteSlug: String(formData.get("siteSlug") ?? ""),
    baselineSpecId: String(formData.get("baselineSpecId") ?? ""),
    candidateSpecId: String(formData.get("candidateSpecId") ?? ""),
    primaryMetric: String(formData.get("primaryMetric") ?? ""),
    // 空欄は「既定のまま」。0 に読み替えない（0 件で判定できることになる）。
    minimumSamples: minimum.trim() === "" ? undefined : Number(minimum),
  });
  if (!result.ok) return failed(result.error);

  revalidatePath(IMPROVEMENT_PATH);
  return { status: "done", message: result.value.message };
}

/**
 * 実施中の 1 件に対する操作（観測・判定・打ち切り）。
 *
 * 3 つを 1 つの入口にまとめている。ボタンごとに入口を分けると、
 * 権限の確認を書き忘れる箇所が 3 倍になる（受信箱と同じ理由）。
 */
export async function advanceLoopRunAction(
  _prev: ImprovementFormState,
  formData: FormData,
): Promise<ImprovementFormState> {
  const runId = String(formData.get("runId") ?? "");
  const intent = String(formData.get("intent") ?? "");
  const actor = await signedInActor();
  if (actor === null) return NOT_SIGNED_IN;
  const useCases = await improvementUseCases();

  if (intent === "observe") {
    const result = await useCases.observe.execute(actor, {
      runId,
      baselineValue: Number(formData.get("baselineValue") ?? Number.NaN),
      baselineSamples: Number(formData.get("baselineSamples") ?? Number.NaN),
      candidateValue: Number(formData.get("candidateValue") ?? Number.NaN),
      candidateSamples: Number(formData.get("candidateSamples") ?? Number.NaN),
    });
    if (!result.ok) return failed(result.error);
    revalidatePath(IMPROVEMENT_PATH);
    return { status: "done", message: result.value.message };
  }

  if (intent === "conclude") {
    const result = await useCases.conclude.execute(actor, { runId });
    if (!result.ok) return failed(result.error);
    revalidatePath(IMPROVEMENT_PATH);
    return { status: "done", message: result.value.message };
  }

  if (intent === "stop") {
    const result = await useCases.stop.execute(actor, {
      runId,
      reason: String(formData.get("reason") ?? ""),
    });
    if (!result.ok) return failed(result.error);
    revalidatePath(IMPROVEMENT_PATH);
    return { status: "done", message: result.value.message };
  }

  return {
    status: "failed",
    message: "できることは、観測値を書く・判定する・打ち切る、の 3 つです。",
  };
}

function failed(error: DomainError): ImprovementFormState {
  return { status: "failed", message: refusalText(error), field: error.field };
}
