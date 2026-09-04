"use server";

import { revalidatePath } from "next/cache";
import { DEFAULT_REWARD_CURRENCY } from "@/domain/monetization";
import type { CurrencyCode } from "@/domain/shared";
import { affiliateUseCases, signedInActor } from "@/presentation/composition";
import type {
  AffiliateAccountFormState,
  AffiliateProgramFormState,
} from "./affiliate-form-state";
import { parseNonEmptyLines } from "../non-empty-lines";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";

/**
 * 提携先を登録・変更する操作と、提携条件を登録・変更する操作。
 *
 * `currentActor()` ではなく `signedInActor()` を使う理由は
 * `ranking-form-action.ts` と同じ。前者は身元を確かめられないとき
 * **見本の身元へ落ちる**。落ちた身元で提携先が登録できると、
 * 誰の収益の出どころなのか分からない行が作られる。
 *
 * **接続情報（鍵・パスワード・API キー）をこの経路へ流さない。**
 * 受け取るのは `credentialRef`＝保管先の名前だけで、値そのものは
 * 列としても持たない。画面の説明文でもそう書く。
 */

/** 数字の欄を読む。空欄は 0 として扱わず `null`（＝未取得）にする。 */
function readNumber(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? "").trim();
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isNaN(value) ? null : value;
}

/** 変更のときだけ入る番号を読む。空欄は「新しく作る」。 */
function readId(formData: FormData, name: string): string | null {
  const raw = String(formData.get(name) ?? "").trim();
  return raw === "" ? null : raw;
}

export async function saveAffiliateAccountAction(
  _prev: AffiliateAccountFormState,
  formData: FormData,
): Promise<AffiliateAccountFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("提携先の登録");

  const result = await (await affiliateUseCases()).saveAccount.execute(actor, {
    accountId: readId(formData, "accountId"),
    asp: String(formData.get("asp") ?? ""),
    label: String(formData.get("label") ?? ""),
    publicTrackingId: String(formData.get("publicTrackingId") ?? ""),
    credentialRef: String(formData.get("credentialRef") ?? ""),
    // チェックの付いていない checkbox は FormData に現れない。
    // 「送られてこない＝止めない」で読む。
    disabled: formData.get("disabled") !== null,
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/affiliate");
  // 提携条件の画面の選択肢もここで増える。作った直後に条件を足しに行って
  // 「さっき作った提携先が無い」となるのを防ぐ。
  revalidatePath("/admin/affiliate/programs/new");

  return {
    status: "done",
    message: `提携先「${result.value.view.label}」を保存しました。次はこの提携先の下に提携条件を足します。`,
    programEntryPath: `/admin/affiliate/programs/new?account=${encodeURIComponent(result.value.accountId)}`,
  };
}

export async function saveAffiliateProgramAction(
  _prev: AffiliateProgramFormState,
  formData: FormData,
): Promise<AffiliateProgramFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("提携条件の登録");

  const currency = String(formData.get("rewardCurrency") ?? "").trim();

  const result = await (await affiliateUseCases()).saveProgram.execute(actor, {
    programId: readId(formData, "programId"),
    accountId: String(formData.get("accountId") ?? ""),
    advertiserName: String(formData.get("advertiserName") ?? ""),
    rewardKind: String(formData.get("rewardKind") ?? ""),
    rewardPercent: readNumber(formData, "rewardPercent"),
    rewardAmountMinor: readNumber(formData, "rewardAmountMinor"),
    // 通貨は選ばれていなければ既定を使う。額だけ入って通貨が空の行を作らない。
    rewardCurrency: (currency === ""
      ? DEFAULT_REWARD_CURRENCY
      : currency) as CurrencyCode,
    rewardNote: String(formData.get("rewardNote") ?? ""),
    approvalRatePercent: readNumber(formData, "approvalRatePercent"),
    confirmationDays: readNumber(formData, "confirmationDays"),
    cookieDurationDays: readNumber(formData, "cookieDurationDays"),
    // 1 行に 1 つ。掲載条件は文章で、数も長さも決めうちにできない。
    restrictions: parseNonEmptyLines(String(formData.get("restrictions") ?? "")),
    ended: formData.get("ended") !== null,
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/affiliate");

  return {
    status: "done",
    message:
      `${result.value.view.advertiserName}の提携条件（${result.value.view.rewardLabel}）を保存しました。` +
      (result.value.view.restrictions.length > 0
        ? `掲載前に確かめる条件が ${result.value.view.restrictions.length} 件あります。`
        : ""),
    affiliatePath: "/admin/affiliate",
  };
}
