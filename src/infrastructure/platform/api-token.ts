import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * 外部から来た呼び出しの身元確認。
 *
 * **この判定は 1 箇所しかない。** REST（`/api/tools`）も MCP（`/api/mcp`）も
 * ここを通る。入口ごとに書くと、片方だけ緩いまま残る。
 *
 * - `bearer`      : 発行済みトークンと一致。読み書きの両方を実行できる。
 * - `same-origin` : 自サイトの画面からの呼び出し（WebMCP を含む）。読み取りのみ。
 *
 * **ここが決めるのは「呼んでよい相手か」だけで、「どの作業場所の誰か」ではない。**
 * `MCP_TOKEN` は製品全体に 1 つしかなく、作業場所にも人にも結びついていない。
 * したがって `bearer` で通ったことを身元の根拠に使ってはいけない。使うと
 * 身元の分からない呼び出しが管理用のデータを読めることになる（`ah-p9e`）。
 * 身元は連携の鍵（`X-Integration-Key`）から `resolveIntegrationAccess()` が
 * 組み立て、鍵が無ければ読者の範囲に落ちる。門と身元は別のものなので、
 * 名乗る見出しも `Authorization` と `X-Integration-Key` に分けてある。
 *
 * トークンの値はこのファイルの外へ出さない。ログにも、エラー本文にも載せない。
 * 登録は利用者本人が別のターミナルで `wrangler secret put MCP_TOKEN` を実行する。
 */
export type AuthScope = "bearer" | "same-origin";

export type AuthResult =
  | { readonly ok: true; readonly scope: AuthScope }
  | { readonly ok: false; readonly status: number; readonly message: string };

/** 長さと内容を定数時間で比べる。比較にかかる時間から答えを推測させない。 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function authenticateApiRequest(request: Request): Promise<AuthResult> {
  const { env } = await getCloudflareContext({ async: true });
  const token = env.MCP_TOKEN;

  // 未設定なら開けっ放しにせず閉じる（fail-closed）。
  if (!token) {
    return {
      ok: false,
      status: 503,
      message:
        "接続用のトークンが未登録です。ご自身のターミナルで `wrangler secret put MCP_TOKEN` を実行してください（値をこの画面やチャットに貼らないでください）。",
    };
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return safeEqual(authorization.slice("Bearer ".length), token)
      ? { ok: true, scope: "bearer" }
      : { ok: false, status: 401, message: "トークンが一致しません。" };
  }

  // 自サイトの画面（WebMCP を含む）からの呼び出し。
  // `Sec-Fetch-Site` はブラウザの fetch では偽装できないが、curl 等からは付けられる。
  // したがってこれは「書き込みを守る仕組み」ではなく
  // 「公開ページと同じ読み取り範囲を許すだけのもの」として扱う。
  if (request.headers.get("sec-fetch-site") === "same-origin") {
    return { ok: true, scope: "same-origin" };
  }

  return { ok: false, status: 401, message: "Authorization: Bearer <token> が必要です。" };
}
