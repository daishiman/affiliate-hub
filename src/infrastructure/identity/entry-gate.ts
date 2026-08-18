import type { SessionReaderPort } from "./session-repository";

/**
 * 入口の門。**「ログインしているか」だけを見る。**
 *
 * この門が答えるのは 1 つだけで、「役として何をしてよいか」は見ない。
 * 分けてあるのは、同じ判定を 2 か所に置くと必ず食い違うためである。
 * そして食い違ったとき、**浅い方（入口）が先に古くなる**。
 * 役を 1 つ足したとき、奥は直すが入口は忘れる、という向きにしか壊れない。
 *
 * だから役の判定は奥（ユースケース）に 1 か所だけ置き、
 * ここは「通行証が今も有効か」で止める。
 *
 * 断り方も入口と奥で分ける。入口は「ログインしてください」、
 * 奥は「権限がありません」。同じ文言にすると、
 * ログインしているのに権限が無い人が、何度もログインし直すことになる。
 *
 * **`betterAuth(...)` の引数や入口のファイルの中へ直接書かないのは、
 * 判定だけを取り出して確かめられる状態にするためである。**
 * 入口の中に置くと、この判定は画面を丸ごと動かさない限り実行されない。
 */
export type EntryDecision =
  /** 通行証が有効。奥へ通す（そこで役を見る）。 */
  | { readonly kind: "通す" }
  /** 通行証が無い・無効・確かめられない。ログイン画面へ戻す。 */
  | { readonly kind: "ログインへ"; readonly reason: EntryDenialReason };

export type EntryDenialReason =
  /** そもそも通行証を持っていない。 */
  | "通行証なし"
  /** 通行証はあるが、期限切れ・失効済み・偽物のいずれか（区別しない）。 */
  | "通行証が無効"
  /** 保存先に届かず、有効かどうかを確かめられなかった。 */
  | "確認できない";

/**
 * `/admin` の下だけを守る。
 *
 * 読者のページ・サインイン画面・ログインの往復（`/api/auth`）は通す。
 * ここへ門を置くと、誰もログインできなくなる。
 *
 * REST の入口（`/api/tools` など）はここでは見ない。あちらは鍵で入る経路で、
 * 門は各ルートが自分で持っている（`authenticateApiRequest`）。
 * cookie を持たない呼び出しをここで一律に断ると、鍵で入る経路まで止まる。
 */
export function isGuardedPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * 通行証を見て、通すかログインへ戻すかを決める。
 *
 * **確かめられないときは通さない。** ここで「たぶん本人だろう」と通すと、
 * 保存先を落とせば門を外せることになる。
 */
export async function decideEntry(
  token: string | null | undefined,
  sessions: SessionReaderPort | null,
  now: Date,
): Promise<EntryDecision> {
  if (token === null || token === undefined || token.length === 0) {
    return { kind: "ログインへ", reason: "通行証なし" };
  }
  if (sessions === null) return { kind: "ログインへ", reason: "確認できない" };

  const found = await sessions.findValid(token, now);
  if (!found.ok) return { kind: "ログインへ", reason: "確認できない" };
  if (found.value === null) return { kind: "ログインへ", reason: "通行証が無効" };
  return { kind: "通す" };
}
