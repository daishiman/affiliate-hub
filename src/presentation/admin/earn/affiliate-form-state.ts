import type { AdminActionState } from "../use-case-result";

/**
 * 提携先と提携条件を登録する欄の状態。
 *
 * `"use server"` の付いたファイルからは、非同期の関数以外を出せない。
 * 型と定数はここに置く（`ranking-form-state.ts` と同じ理由）。
 *
 * 2 つを 1 つのファイルにまとめているのは、**提携先だけあっても収益にならない**から。
 * 提携先は「どの ASP のどのアカウントか」、提携条件は「その下で何をいくらで紹介できるか」。
 * 片方だけ登録できる状態を作ると、記事にリンクを出す一歩手前で必ず止まる。
 */
export type AffiliateAccountFormState = AdminActionState & {
  /** 登録できたときだけ入る。次に提携条件を足しに行く先。 */
  readonly programEntryPath?: string;
};

export const INITIAL_AFFILIATE_ACCOUNT_FORM_STATE: AffiliateAccountFormState = {
  status: "idle",
  message: "",
};

export type AffiliateProgramFormState = AdminActionState & {
  /** 登録できたときだけ入る。一覧で確かめに行く先。 */
  readonly affiliatePath?: string;
};

export const INITIAL_AFFILIATE_PROGRAM_FORM_STATE: AffiliateProgramFormState = {
  status: "idle",
  message: "",
};
