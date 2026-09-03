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
  /**
   * 作れたときだけ入る。読者が打つホスト名。住所未設定の環境では `null`。
   *
   * `createdPath` と両方持つのは、**同じブログに 2 通りの入口がある**ことを
   * 画面でそのまま見せるため。片方だけ出すと、住所を設定したのに
   * 管理画面はパスを案内し続ける、という食い違いに気づけない。
   */
  readonly createdHost?: string | null;
  /**
   * 作れたが、まだ足りていないもの。
   *
   * ここに入るのは**読者が開けなくなるほどではない**不足だけである
   * （開けなくなる不足は作成そのものが断られる）。
   * 空でないまま成功と言うのは、後から直せる欄が残っているという意味。
   */
  readonly gaps?: readonly { readonly label: string; readonly remedy: string }[];
};

export const INITIAL_SITE_WIZARD_STATE: SiteWizardState = { status: "idle", message: "" };
