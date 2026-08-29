import type { AdminActionState } from "./use-case-result";

/**
 * 順位づけの基準と点を登録する欄の状態。
 *
 * `"use server"` の付いたファイルからは、非同期の関数以外を出せない。
 * 型と定数はここに置く（`content-package-form-state.ts` と同じ理由）。
 *
 * 2 つの欄で 1 つのファイルにしているのは、**片方だけでは順位が出ない**から。
 * 状態の形が別々に育つと、「基準は登録できたが点は登録できない」ような
 * 中途の作りに気づく場所が無くなる。
 */
export type RankingModelFormState = AdminActionState & {
  /** 登録できたときだけ入る。次に点を入れに行く先。 */
  readonly scoreEntryPath?: string;
};

export const INITIAL_RANKING_MODEL_FORM_STATE: RankingModelFormState = {
  status: "idle",
  message: "",
};

export type ScoreCardFormState = AdminActionState & {
  /** 登録できたときだけ入る。並び直した順位を見に行く先。 */
  readonly rankingPath?: string;
};

export const INITIAL_SCORE_CARD_FORM_STATE: ScoreCardFormState = {
  status: "idle",
  message: "",
};
