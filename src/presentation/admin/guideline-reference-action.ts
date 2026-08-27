"use server";

import { revalidatePath } from "next/cache";
import { guidelineReferenceEntry, signedInActor } from "@/presentation/composition";
import { notSignedInText, refusalText } from "@/presentation/refusal-text";
import type { GuidelineReferenceState } from "./guideline-reference-state";

const PATH = "/admin/settings/seo";

/**
 * SEO/AI 指針の出典を登録する・再確認 (確認日の更新) する。
 *
 * 2 つを 1 つの関数にしているのは、ユースケース側が 1 つの口だからである
 * (`manage_guideline_references`)。画面側だけ 2 つに割ると、
 * 権限の確認と入力の検査が 2 か所に散る。
 *
 * ログインを最初に見る。確かめられないときは formData を読む前に断る。
 */
export async function manageGuidelineReferenceAction(
  _prev: GuidelineReferenceState,
  formData: FormData,
): Promise<GuidelineReferenceState> {
  const actor = await signedInActor();
  if (actor === null) {
    return { status: "failed", message: notSignedInText("指針の出典の登録・再確認") };
  }

  const entry = await guidelineReferenceEntry();
  if (!entry.ready) {
    // 使えない理由をそのまま返す。「登録できませんでした」で終わらせない。
    return { status: "failed", message: entry.reason };
  }

  const intent = String(formData.get("intent") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  const result = await entry.manage.execute(
    actor,
    intent === "recheck"
      ? {
          action: "recheck",
          id: String(formData.get("id") ?? ""),
          checkedAt: String(formData.get("checkedAt") ?? ""),
        }
      : {
          action: "add",
          title: String(formData.get("title") ?? ""),
          url: String(formData.get("url") ?? ""),
          publisher: String(formData.get("publisher") ?? ""),
          region: String(formData.get("region") ?? ""),
          checkedAt: String(formData.get("checkedAt") ?? ""),
          ...(note === "" ? {} : { note }),
        },
  );

  if (!result.ok) {
    return {
      status: "failed",
      message: refusalText(result.error),
      field: result.error.field,
    };
  }

  revalidatePath(PATH);

  return {
    status: "done",
    message:
      intent === "recheck"
        ? "確認日を更新しました。次の見直しは 90 日後です。"
        : "出典を登録しました。90 日を超えると「再確認」と表示されます。",
  };
}
