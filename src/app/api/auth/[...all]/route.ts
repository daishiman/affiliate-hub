import { tryGetAuth } from "@/infrastructure/identity/better-auth";

/**
 * ログインの入口。Google との往復はすべてここを通る。
 *
 * **設定が揃っていないときに、それらしく動かさない。**
 * 揃っていなければ 503 と「何が足りないか」を返す。
 * ここで 200 を返すと、ログインしていない人が
 * 「ログインしたつもり」で画面を触ることになる。
 */
async function handler(request: Request): Promise<Response> {
  const auth = await tryGetAuth();
  if (auth === null) {
    return Response.json(
      {
        error: "AUTH_NOT_CONFIGURED",
        message:
          "ログインの設定がまだ済んでいません（Google の識別子と秘密の値、許可するアドレスの登録が必要です）。",
      },
      { status: 503 },
    );
  }
  return auth.handler(request);
}

export const GET = handler;
export const POST = handler;
