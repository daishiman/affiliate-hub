"use server";

import { revalidatePath } from "next/cache";
import type { CurrencyCode } from "@/domain/shared";
import { affiliateUseCases, signedInActor } from "@/presentation/composition";
import type { AdjustConversionState } from "./adjust-conversion-state";
import { notSignedInText, refusalText } from "@/presentation/refusal-text";

/**
 * 成果の画面から金額を直す操作。
 *
 * ここは**4 つ目の入口**で、REST・WebMCP・バックエンド MCP と同じ
 * `adjustConversion` ユースケースを呼ぶ。締め済みかどうかの判断も、
 * 権限の確認も、取込額を残すことも、すべてユースケース側にある。
 * 画面側へ写した時点で「画面からは直せるが AI からは直せない」が生まれる。
 *
 * この操作は**担当者ご本人が行う**もので、AI からは実行させない
 * （金額は業務の数字そのもので、ページ内の文章を命令として読み込んだ AI に
 * 触らせてよいものではない）。制限はユースケースの権限確認で効かせている。
 *
 * --- 身元の取り方について ---
 * `currentActor()` ではなく `signedInActor()` を使う。前者は身元を
 * 確かめられないとき**見本の身元へ落ちる**ので、ログインしていない人の操作が
 * ユースケースまで届く。「担当者ご本人が行う」と決めた操作を、
 * 誰か分からないまま通してしまう（`ah-dao`）。
 *
 * 直した額は履歴に残るので「取り返しがつく」側だが、**締めの報告に使われる数字**である。
 * 文章と違って数字は、変わっていても読んだ人が気づけない。
 */
export async function adjustConversionAction(
  _prev: AdjustConversionState,
  formData: FormData,
): Promise<AdjustConversionState> {
  const actor = await signedInActor();
  if (actor === null) {
    // **`formData` を読む前に断る。** 読んでから断ると、断り文が
    // 「金額を入れてください」に化けて、押した人は金額を入れて何度も試す。
    return { status: "failed", message: notSignedInText("成果の金額の修正") };
  }

  const conversionId = String(formData.get("conversionId") ?? "");
  const rawAmount = String(formData.get("amount") ?? "").trim();
  const currency = String(formData.get("currency") ?? "JPY") as CurrencyCode;
  const reason = String(formData.get("reason") ?? "");

  // 空欄をそのまま渡すと「金額は最小単位の整数で指定してください」と返る。
  // 間違ってはいないが、空欄の人が読むと何を直せばよいか分からない。
  if (rawAmount === "") {
    return { status: "failed", message: "直したあとの金額を入れてください。", field: "amount" };
  }
  const amountMinor = Number(rawAmount);

  const uc = await affiliateUseCases();
  const result = await uc.adjustConversion.execute(actor, {
    conversionId,
    amountMinor,
    currency,
    reason,
  });

  if (!result.ok) {
    return {
      status: "failed",
      // 次にすることが書いてあるならそちらを出す。原因だけ出しても直せない。
      message: refusalText(result.error),
      field: result.error.field,
    };
  }

  revalidatePath(`/admin/affiliate/${conversionId}`);
  revalidatePath("/admin/affiliate");

  return {
    status: "done",
    message: `金額を ${result.value.view.effectiveLabel} に直しました。取り込んだ額（${result.value.view.ingestedLabel}）はそのまま残しています。`,
  };
}
