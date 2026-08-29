import { parseNonEmptyLines } from "./non-empty-lines";
import type { AdminActionState } from "./use-case-result";

/**
 * ブランドと作業場所を直す欄の状態。
 *
 * `"use server"` の付いたファイルからは非同期の関数以外を出せないので、
 * 型と定数はここに置く（`evidence-form-state.ts` と同じ理由）。
 *
 * 2 つを 1 つのファイルにしているのは、**どちらも「公開できるか」を動かす**から。
 * ブランドの問い合わせ先が空でも、作業場所の上限に達していても、
 * 止まるのは同じ公開である。状態の形が別々に育つと、片方だけ
 * 「何が足りないか」を返さない作りに気づく場所が無くなる。
 */
export type BrandFormState = AdminActionState & {
  /** 保存できたときだけ入る。作った直後に一覧から探し直さないための番号。 */
  readonly brandId?: string;
  /**
   * 保存できたときだけ入る。公開の前に埋める必要が残っている項目。
   *
   * **空でなくても保存は成功している。** 途中まで埋めた状態を保存できないと、
   * 問い合わせ先を調べている間に他の入力が消える。
   */
  readonly missing?: readonly string[];
};

export const INITIAL_BRAND_FORM_STATE: BrandFormState = {
  status: "idle",
  message: "",
};

export type WorkspaceFormState = AdminActionState & {
  /**
   * 保存できたときだけ入る。契約の区分を下げて上限を超えたもの。
   *
   * 超えていても**消さない**（`createUpdateWorkspaceUseCase` を見よ）。
   * ここに出るのは「これ以上増やせない」という知らせであって、
   * 何かが失われたという知らせではない。
   */
  readonly overLimits?: readonly string[];
};

export const INITIAL_WORKSPACE_FORM_STATE: WorkspaceFormState = {
  status: "idle",
  message: "",
};

/**
 * 1 行 1 つの言い回しを読み取る。
 *
 * 使わない言い回しは数が決まっていない。欄を決めうちにすると、
 * **禁止したい言い回しを 1 つ足すたびに画面の作り替えが要る。**
 * 空行は落とす（改行だけの行が「空文字を禁止する」規則になると、
 * どの文も禁止に当たる）。
 */
export const readAvoidPhrases = parseNonEmptyLines;
