"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SiteWizardStep } from "@/domain/authoring";
import { currentActor, siteBuilderUseCases, signedInActor } from "@/presentation/composition";
import type { SiteWizardState } from "./site-wizard-state";
import { notSignedInText, refusalText } from "@/presentation/refusal-text";

/**
 * ブログ作成ウィザードの操作。
 *
 * 画面から呼ぶのはこの 3 つだけで、中身は
 * **REST / WebMCP / バックエンド MCP と同じユースケース**を呼ぶ。
 * 「ブログを 1 本増やす」ためにここへ分岐を書かない。
 * 書いた時点で、ブログごとにコードが増える設計に戻ってしまう。
 */

// 型と初期値は `site-wizard-state.ts` にある。
// `"use server"` のファイルからは非同期の関数しか外へ出せないため。
const WIZARD_PATH = "/admin/sites/new";

/** 新しい下書きを始める。始めた時点ではまだ公開されない。 */
export async function startSiteDraftAction(): Promise<void> {
  const result = await (await siteBuilderUseCases()).startDraft.execute(await currentActor(), {});
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

  const result = await (await siteBuilderUseCases()).saveStep.execute(await currentActor(), {
    draftId,
    step,
    answers,
    categoriesText: answers.categoriesText,
    articleTypes: formData.getAll("articleTypes").map(String),
  });

  if (!result.ok) {
    return {
      status: "failed",
      message: refusalText(result.error),
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
 *
 * --- 身元の取り方について ---
 * `currentActor()` ではなく `signedInActor()` を使う。前者は身元を
 * 確かめられないとき**見本の身元へ落ちる**ので、ログインしていない人の操作が
 * ユースケースまで届く。届いた先の砦は**役の一覧**で、あれは人が編集する表である。
 *
 * ブログを作るのは**取り返しがつかない**。消す口はどこにも無く、
 * 作った時点で読者からも見える。2026-08-19 の実測では、ログインしていない状態で
 * ブログが本当に 1 本増えた（7 本 → 8 本、`ah-dao`）。
 *
 * 同じファイルの `startSiteDraftAction` / `saveSiteDraftStepAction` はまだ
 * `currentActor()` のままである。下書きは作り直せる・上書きできるので、
 * 取り返しがつかない側から先に塞いだ。残りは `docs/product/open-doors.md` に載っている。
 */
export async function createSiteFromDraftAction(
  _prev: SiteWizardState,
  formData: FormData,
): Promise<SiteWizardState> {
  const actor = await signedInActor();
  if (actor === null) {
    // **`formData` を読む前に断る。** 読んでから断ると、断り文が
    // 「下書きが選ばれていません」に化けて、押した人は選び直して何度も試す。
    return { status: "failed", message: notSignedInText("ブログの作成") };
  }

  const draftId = String(formData.get("draftId") ?? "");

  const result = await (await siteBuilderUseCases()).createSite.execute(actor, { draftId });

  if (!result.ok) {
    return {
      status: "failed",
      message: refusalText(result.error),
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
