import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * 認証結果。
 *
 * - `bearer`      : MCP_TOKEN 一致。全ツールを実行できる。
 * - `same-origin` : 自サイトのページからの呼び出し。読み取り専用ツールのみ。
 */
export type AuthScope = "bearer" | "same-origin";

export type AuthResult =
  | { ok: true; scope: AuthScope }
  | { ok: false; status: number; message: string };

/** タイミング攻撃を避けるため、長さと内容を定数時間で比較する */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function authenticate(request: Request): Promise<AuthResult> {
  const { env } = await getCloudflareContext({ async: true });
  const token = env.MCP_TOKEN;

  // 未設定なら開いたままにせず閉じる (fail-closed)。
  // ローカルは .dev.vars、本番は `wrangler secret put MCP_TOKEN` で設定する。
  if (!token) {
    return {
      ok: false,
      status: 503,
      message: "MCP_TOKEN が未設定です。.dev.vars もしくは wrangler secret で設定してください。",
    };
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return safeEqual(authorization.slice("Bearer ".length), token)
      ? { ok: true, scope: "bearer" }
      : { ok: false, status: 401, message: "トークンが一致しません。" };
  }

  // 自サイトのページ(WebMCP)からの呼び出し。
  // Sec-Fetch-Site はブラウザの fetch からは偽装できないが、curl 等からは付けられる。
  // したがってこれは「書き込みを守る仕組みではなく、公開ページと同じ読み取り範囲を許すもの」。
  // 書き込みツールは scope === "bearer" のみ許可する (route.ts 側で判定)。
  if (request.headers.get("sec-fetch-site") === "same-origin") {
    return { ok: true, scope: "same-origin" };
  }

  return { ok: false, status: 401, message: "Authorization: Bearer <token> が必要です。" };
}
