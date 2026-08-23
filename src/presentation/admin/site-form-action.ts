"use server";

import { revalidatePath } from "next/cache";
import type { DifferentiationAxes } from "@/domain/authoring";
import { signedInActor, siteEditingUseCases } from "@/presentation/composition";
import type { SiteFormState } from "./site-form-state";
import { failureFromDomainError, notSignedInFailure } from "./use-case-result";

/**
 * 差別化の 10 軸のうち、この操作が受け取ってよいもの。
 *
 * **送られてきたキーをそのまま通さない。** 通すと、画面に無い名前の軸を
 * 足した書き込みが作れてしまい、設計図に読む人のいない項目が残る。
 */
const AXIS_KEYS: readonly (keyof DifferentiationAxes)[] = [
  "targetReader",
  "searchIntent",
  "articlePurpose",
  "evaluationAxis",
  "usageScene",
  "uniqueExperience",
  "comparisonScope",
  "conclusionStance",
  "internalLinkStrategy",
  "ctaStrategy",
];

/**
 * ブログの設計図を直す操作。
 *
 * URL 名とパターンは扱わない。ユースケース側が受け取らないのと同じ理由で、
 * URL 名を変えると読者へ配った住所が消え、パターンを変えると
 * 公開済みの記事の置き場所がその場で無くなる。
 */
export async function updateManagedSiteAction(
  _prev: SiteFormState,
  formData: FormData,
): Promise<SiteFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("ブログの修正");

  const siteSlug = String(formData.get("siteSlug") ?? "");

  const differentiation: Partial<Record<keyof DifferentiationAxes, string>> = {};
  for (const key of AXIS_KEYS) {
    const value = emptyToUndefined(formData.get(`axis.${key}`));
    if (value !== undefined) differentiation[key] = value;
  }

  const result = await (await siteEditingUseCases()).update.execute(actor, {
    siteSlug,
    name: emptyToUndefined(formData.get("name")),
    purpose: emptyToUndefined(formData.get("purpose")),
    genre: emptyToUndefined(formData.get("genre")),
    /*
     * 入り切りの欄だけは、空欄を「触らない」と読まない。
     *
     * チェックの外れた箱は送られてこないので、空欄と区別が付かない。
     * 画面はいまの値を入れて開くので、外れている＝外したいで正しい。
     */
    emitLlmsTxt: formData.get("emitLlmsTxt") !== null,
    differentiation: Object.keys(differentiation).length === 0 ? undefined : differentiation,
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/sites");
  revalidatePath(`/admin/sites/${siteSlug}`);

  return {
    status: "done",
    message:
      result.value.changedLabels.length === 0
        ? "入力した内容は、いま入っている値と同じでした。"
        : `${result.value.changedLabels.join(" / ")} を直しました。`,
    sitePath: `/admin/sites/${result.value.siteSlug}`,
    changedLabels: result.value.changedLabels,
  };
}

/** 空欄は「触らない」。渡さないことでユースケースに伝える。 */
function emptyToUndefined(value: FormDataEntryValue | null): string | undefined {
  const text = String(value ?? "").trim();
  return text === "" ? undefined : text;
}
