/**
 * 「気になる商品」の押しどころが返す形。
 *
 * `"use server"` のファイルからは非同期の関数しか外へ出せないので、
 * 型と初期値だけをここに置く。同じファイルに書くと、定数が
 * サーバ動作として公開され、外から呼べる入口が黙って 1 つ増える。
 */
export type ShortlistFormState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  /** どの欄が原因か。欄の下に出す。 */
  readonly field?: string;
};

export const INITIAL_SHORTLIST_FORM_STATE: ShortlistFormState = { status: "idle", message: "" };
