"use server";

import { revalidatePath } from "next/cache";
import { settingsUseCases, signedInActor } from "@/presentation/composition";
import type { BrandFormState, WorkspaceFormState } from "./settings-form-state";
import { readAvoidPhrases } from "./settings-form-state";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";

/**
 * ブランドと作業場所を保存する操作。
 *
 * `currentActor()` ではなく `signedInActor()` を使う理由は
 * `evidence-form-action.ts` と同じ。前者は身元を確かめられないとき
 * **見本の身元へ落ちる**。落ちた身元で問い合わせ先が書き換わると、
 * 読者が訂正を求める先を、誰が決めたのか分からなくなる。
 *
 * 空欄を「未設定」として入れるか空文字として入れるかは application 側が決める。
 * ここで `null` へ寄せると、口が 2 つに増えた日に片方だけ緩くなる。
 */

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function saveBrandAction(
  _prev: BrandFormState,
  formData: FormData,
): Promise<BrandFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("ブランドの保存");

  const result = await (await settingsUseCases()).saveBrand.execute(actor, {
    // 空なら新しく作る。直すときだけ隠し欄に番号が入っている。
    brandId: text(formData, "brandId"),
    displayName: text(formData, "displayName"),
    legalName: text(formData, "legalName"),
    contactEmail: text(formData, "contactEmail"),
    positioning: text(formData, "positioning"),
    politeness: text(formData, "politeness"),
    firstPerson: text(formData, "firstPerson"),
    vocabulary: text(formData, "vocabulary"),
    avoidPhrases: readAvoidPhrases(String(formData.get("avoidPhrases") ?? "")),
    disclaimer: text(formData, "disclaimer"),
    locale: text(formData, "locale"),
    timeZone: text(formData, "timeZone"),
    defaultCta: text(formData, "defaultCta"),
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/settings/workspaces");

  return {
    status: "done",
    /*
     * 足りないものがあっても「保存しました」と言い切る。
     * 「保存できませんでした」と読める書き方にすると、
     * 埋め終わるまで保存しない人が出て、途中の入力が失われる。
     */
    message:
      result.value.missing.length === 0
        ? `ブランド「${result.value.displayName}」を保存しました。公開に必要な項目はすべて埋まっています。`
        : `ブランド「${result.value.displayName}」を保存しました。公開の前に ${result.value.missing.join("・")} が要ります。`,
    brandId: result.value.brandId,
    missing: result.value.missing,
  };
}

export async function updateWorkspaceAction(
  _prev: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("作業場所の設定");

  const result = await (await settingsUseCases()).updateWorkspace.execute(actor, {
    name: text(formData, "name"),
    plan: text(formData, "plan"),
    timezone: text(formData, "timezone"),
    currency: text(formData, "currency"),
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/settings/workspaces");

  return {
    status: "done",
    message:
      result.value.overLimits.length === 0
        ? `作業場所「${result.value.workspaceName}」の設定を保存しました。区分は${result.value.planLabel}です。`
        : `設定を保存しました。区分は${result.value.planLabel}です。上限を超えているもの: ${result.value.overLimits.join("、")}。既にあるものは消えません。これ以上は増やせません。`,
    overLimits: result.value.overLimits,
  };
}
