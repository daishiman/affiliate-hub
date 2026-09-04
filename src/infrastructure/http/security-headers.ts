/**
 * 配信境界で必ず付ける応答ヘッダー。
 *
 * **なぜ `next.config.ts` の中に直接書かないのか。**
 *
 * 設定ファイルの中へ書くと、この方針は「アプリを丸ごと起動しない限り
 * 読めない値」になる。何を付ける決まりなのかを確かめる手段が、
 * 実際にサーバーを立てて `curl` を叩くことだけになり、
 * 決まりが変わったことに検査が気づけない。
 *
 * ここを純関数にしておくと、方針そのものを単体で確かめられる。
 * `next.config.ts` は「この関数の返り値を配る」配線だけを持つ。
 * [[entry-gate]] が門の判定を入口から切り離しているのと同じ理由である。
 *
 * **付ける先を 3 つに分けている理由。**
 *
 * 読者のページと管理画面では、守りたいものが違う。
 * 読者のページは埋め込みや検索エンジンに開かれている必要があり、
 * 管理画面は逆に、外の枠に嵌め込まれること自体を断りたい。
 * ログインの往復は、外の認証提供元との行き来がある。
 * 1 つの方針で全部を覆うと、いちばん緩い場所に全体が引きずられる。
 */

/** ヘッダーを付ける相手。URL の前方一致で決まる。 */
export type SurfaceKind =
  /** 読者が見る公開ページ。`/`, `/s/...` など。 */
  | "public"
  /** 運営者だけが入る管理画面。`/admin/...`。 */
  | "admin"
  /** ログインの往復。`/signin`, `/api/auth/...`。 */
  | "auth";

export type HeaderRule = {
  readonly key: string;
  readonly value: string;
};

/**
 * どの面に属する URL かを決める。
 *
 * 前方一致だけで決めるのは、判定を URL の形だけで閉じるためである。
 * cookie や DB を見に行くと、ヘッダーを付ける処理が
 * 「確かめられなかったとき何を付けるか」まで抱えることになる。
 */
export function surfaceOf(pathname: string): SurfaceKind {
  if (
    pathname === "/signin" ||
    pathname === "/api/auth" ||
    pathname.startsWith("/api/auth/")
  ) {
    return "auth";
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  return "public";
}

/**
 * すべての面に共通で付けるもの。
 *
 * ここに置いてよいのは「面によって強さを変える理由が無い」ものだけである。
 * 面ごとに値が変わるものを共通へ上げると、いちばん緩い値が全体の値になる。
 */
export const COMMON_HEADERS: readonly HeaderRule[] = [
  // 拡張子や中身から型を推測させない。推測されると、
  // 画像として保存させたものが script として実行されうる。
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 外部サイトへ遷移するとき、こちらの URL 全体を渡さない。
  // 記事の下書き URL のような、パスに意味がある場所を守る。
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 使っていない装置の権限を、既定で閉じる。
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // https で来た人に、次からは最初から https で来させる。
  // preload は付けない。付けると取り消しに数か月かかり、
  // 独自ドメイン運用が始まる前に決め打ちすべきでない。
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

export function surfaceHeaders(surface: SurfaceKind): readonly HeaderRule[] {
  const frameAncestors = surface === "public" ? "'self'" : "'none'";
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `frame-ancestors ${frameAncestors}`,
    // Next RSCはインラインの水和scriptを生成する。静的配信を保つため、
    // request nonceではなくこの1点だけunsafe-inlineを許す。
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "media-src 'self' https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "form-action 'self'",
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    {
      key: "X-Frame-Options",
      value: surface === "public" ? "SAMEORIGIN" : "DENY",
    },
  ];
}

/**
 * その面に付ける全ヘッダー。共通 → 面固有の順に重ね、同じ key は面固有が勝つ。
 *
 * 後勝ちにしてあるのは、面固有側で共通の値を**強める**ことを許すためである。
 * 弱める向きに使われていないかは、検査で固定する。
 */
export function buildSecurityHeaders(surface: SurfaceKind): readonly HeaderRule[] {
  const merged = new Map<string, string>();
  for (const rule of COMMON_HEADERS) merged.set(rule.key, rule.value);
  for (const rule of surfaceHeaders(surface)) merged.set(rule.key, rule.value);
  return [...merged].map(([key, value]) => ({ key, value }));
}

export type SecurityHeaderRouteRule = {
  readonly source: string;
  readonly surface: SurfaceKind;
  readonly headers: readonly HeaderRule[];
};

/**
 * Nextのheadersは後勝ちなので、全公開面→より狭い管理面・認証面の順に置く。
 * route文字列をnext.configへ写さず、この正本から配る。
 */
export function securityHeaderRouteRules(): readonly SecurityHeaderRouteRule[] {
  return [
    { source: "/:path*", surface: "public", headers: buildSecurityHeaders("public") },
    { source: "/admin/:path*", surface: "admin", headers: buildSecurityHeaders("admin") },
    { source: "/signin", surface: "auth", headers: buildSecurityHeaders("auth") },
    { source: "/api/auth/:path*", surface: "auth", headers: buildSecurityHeaders("auth") },
  ];
}
