import { parseNonEmptyLines } from "../non-empty-lines";
import type { AdminActionState } from "../use-case-result";

/**
 * 根拠・言えること・検証記録を登録する欄の状態。
 *
 * `"use server"` の付いたファイルからは、非同期の関数以外を出せない。
 * 型と定数はここに置く（`ranking-form-state.ts` と同じ理由）。
 *
 * 3 つで 1 つのファイルにしているのは、**どれか 1 つだけでは記事に使えない**から。
 * 状態の形が別々に育つと、「根拠は登録できたが、それを指す主張が登録できない」
 * ような中途の作りに気づく場所が無くなる。
 */
export type EvidenceFormState = AdminActionState & {
  /**
   * 登録できたときだけ入る。登録した根拠の番号。
   *
   * **画面に出す。** 主張の欄はこの番号で根拠を指すので、
   * 出さないと一覧へ戻って探し直すことになる。
   */
  readonly evidenceId?: string;
  /** 登録できたときだけ入る。続けて主張を書きに行く先。 */
  readonly claimEntryPath?: string;
};

export const INITIAL_EVIDENCE_FORM_STATE: EvidenceFormState = {
  status: "idle",
  message: "",
};

export type ClaimFormState = AdminActionState & {
  /** 登録できたときだけ入る。登録先の商品のページ。 */
  readonly productPath?: string;
};

export const INITIAL_CLAIM_FORM_STATE: ClaimFormState = {
  status: "idle",
  message: "",
};

export type TestRunFormState = AdminActionState & {
  /** 登録できたときだけ入る。この記録を根拠として指すための番号。 */
  readonly testRunId?: string;
};

export const INITIAL_TEST_RUN_FORM_STATE: TestRunFormState = {
  status: "idle",
  message: "",
};

/**
 * 「名前: 値」の行を読み取る。
 *
 * 測ったときの条件（気温・湿度）や生の測定値は、項目が決まっていない。
 * 決めうちの欄にすると、測った人が**欄に無い条件を書き残せない**。
 * 書き残せない条件は、次に測る人が同じ条件を再現できないということ。
 */
export function readKeyValueLines(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    // 全角のコロンも受ける。日本語で書いていると自然に混ざる。
    const at = trimmed.search(/[:：]/);
    // 区切りが無い行は落とさず、値の無い項目として残す。落とすと
    // 「書いたのに保存されていない」が黙って起きる。
    if (at < 0) {
      out[trimmed] = "";
      continue;
    }
    const key = trimmed.slice(0, at).trim();
    if (key === "") continue;
    out[key] = trimmed.slice(at + 1).trim();
  }
  return out;
}

/** 1 行 1 件の欄を読む。空行は捨てる。 */
export const readLines = parseNonEmptyLines;
