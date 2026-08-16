"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SiteWizardStep } from "@/domain/authoring";
import { currentActor, siteBuilderUseCases } from "@/presentation/composition";

/**
 * ブログ作成ウィザードの操作。
 *
 * 画面から呼ぶのはこの 3 つだけで、中身は
 * **REST / WebMCP / バックエンド MCP と同じユースケース**を呼ぶ。
 * 「ブログを 1 本増やす」ためにここへ分岐を書かない。
 * 書いた時点で、ブログごとにコードが増える設計に戻ってしまう。
 */

export type SiteWizardState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  /** どの欄が原因か。欄の下に出す。 */
  readonly field?: string;
  /** 作れたときだけ入る。読者から見える住所。 */
  readonly createdPath?: string;
};

export const INITIAL_SITE_WIZARD_STATE: SiteWizardState = { status: "idle", message: "" };

const WIZARD_PATH = "/admin/sites/new";

/** 新しい下書きを始める。始めた時点ではまだ公開されない。 */
export async function startSiteDraftAction(): Promise<void> {
  const result = await siteBuilderUseCases().startDraft.execute(await currentActor(), {});
  if (!result.ok) {
    // 始められないのは権限か保存先の問題で、利用者の入力では直せない。
    redirect(`${WIZARD_PATH}?error=${encodeURIComponent(result.error.message)}`);
  }
  revalidatePath(WIZARD_PATH);
  redirect(`${WIZARD_PATH}?draftId=${encodeURIComponent(result.value.draftId)}`);
}

/**
 * 1 段階を保存する。
 *
 * 保存できたら**次の段階へ進める**。同じ画面に留めると、
 * 押した結果が変わらないように見えて、もう一度押される。
 */
export async function saveSiteDraftStepAction(
  _prev: SiteWizardState,
  formData: FormData,
): Promise<SiteWizardState> {
  const draftId = String(formData.get("draftId") ?? "");
  const step = String(formData.get("step") ?? "") as SiteWizardStep;

  // 欄の名前と値をそのまま渡す。画面が段階ごとに組み立てを変えない。
  const answers: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "draftId" || key === "step" || key === "articleTypes") continue;
    if (typeof value === "string") answers[key] = value;
  }

  const result = await siteBuilderUseCases().saveStep.execute(await currentActor(), {
    draftId,
    step,
    answers,
    categoriesText: answers.categoriesText,
    articleTypes: formData.getAll("articleTypes").map(String),
  });

  if (!result.ok) {
    return {
      status: "failed",
      message: result.error.suggestedAction ?? result.error.message,
      field: result.error.field,
    };
  }

  revalidatePath(WIZARD_PATH);
  redirect(`${WIZARD_PATH}?draftId=${encodeURIComponent(draftId)}&step=${result.value.currentStep}`);
}

/**
 * 下書きからブログを作る。
 *
 * ここで増えるのは設計図のデータだけ。画面もルートも既存のものを使う。
 * 作った直後に `/s/<URL名>` を開けば、見本のブログと同じ画面が出る。
 */
export async function createSiteFromDraftAction(
  _prev: SiteWizardState,
  formData: FormData,
): Promise<SiteWizardState> {
  const draftId = String(formData.get("draftId") ?? "");

  const result = await siteBuilderUseCases().createSite.execute(await currentActor(), { draftId });

  if (!result.ok) {
    return {
      status: "failed",
      message: result.error.suggestedAction ?? result.error.message,
      field: result.error.field,
    };
  }

  revalidatePath(WIZARD_PATH);
  revalidatePath("/admin/sites");
  revalidatePath(result.value.readerPath);
  return {
    status: "done",
    message: result.value.summary,
    createdPath: result.value.readerPath,
  };
}
