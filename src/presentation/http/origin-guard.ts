import { requestOriginFromWebRequest } from "@/presentation/composition";

/**
 * 自分のオリジンの機能だけを公開する（ブログ層 §14.6、統合仕様 §3「オリジン制約」）。
 *
 * ページ内 AI 向けの入口は、ブラウザから呼ばれる。
 * ブラウザから呼ばれるということは、**別のサイトに置かれたページからも呼べる**ということ。
 * 何もしないと、利用者がよそのサイトを開いているだけで、
 * そのサイトの JavaScript がこちらのログイン状態を使って操作できてしまう。
 *
 * ここで見るのは 2 つだけ。
 *   1. `Origin` が付いていて、こちらのオリジンと違う → 断る
 *   2. `Origin` が付いていない（サーバー同士の呼び出し・curl）→ 通す
 *
 * 2 を通してよいのは、その経路が別に持っている鍵（Bearer）で守られているため。
 * `Origin` はブラウザが勝手に付けるもので、ブラウザ以外は付けない。
 * 「付いていない = ブラウザ以外」なので、ここでの判定対象にならない。
 */

export type OriginDecision =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string; readonly origin: string };

/**
 * 追加で許すオリジンの環境変数名。
 * 管理画面と読者ブログを別のドメインで動かす構成に備えて置く。
 * 空のままなら「自分のオリジンだけ」。
 */
export const ALLOWED_ORIGINS_FLAG = "ALLOWED_ORIGINS";

export function allowedOriginsFrom(
  env: Readonly<Record<string, string | undefined>> = {},
): readonly string[] {
  const raw = env[ALLOWED_ORIGINS_FLAG];
  if (raw === undefined || raw.trim() === "") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

export function checkOrigin(
  request: Request,
  extraAllowed: readonly string[] = [],
): OriginDecision {
  const origin = request.headers.get("origin");
  // ブラウザ以外からの呼び出し。鍵で守られている経路なので、ここでは判定しない。
  if (origin === null || origin === "" || origin === "null") return { ok: true };

  const selfOrigin = requestOriginFromWebRequest(request);
  if (selfOrigin === null) {
    return { ok: false, reason: "呼び出し先の URL を読み取れませんでした。", origin };
  }

  if (origin === selfOrigin || extraAllowed.includes(origin)) return { ok: true };

  return {
    ok: false,
    reason: "このページからは実行できません。運営画面を開いた状態で操作してください。",
    origin,
  };
}

/** 断るときの応答。理由を返すのは、呼んだ側が原因を切り分けられるようにするため。 */
export function originRejection(decision: Extract<OriginDecision, { ok: false }>): Response {
  return Response.json(
    {
      error: {
        code: "FORBIDDEN",
        message: decision.reason,
        suggestedAction: "この機能を使うサイトを運営者に確認してください。",
        field: null,
        retryable: false,
      },
    },
    { status: 403 },
  );
}
