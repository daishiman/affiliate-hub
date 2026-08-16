/**
 * ブログ作成ウィザードの画面の状態。
 *
 * `site-wizard-action.ts` から分けてある理由:
 * `"use server"` を付けたファイルは**非同期の関数しか外へ出せない**。
 * 型と初期値をそこへ置くと、ビルドが通らなくなる
 * （`A "use server" file can only export async functions, found object.`）。
 *
 * 型検査だけでは気づけない。ビルドまで通して初めて出る種類の決まりなので、
 * 分けた理由をここに書いておく。
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
