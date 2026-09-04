import { siteSlugFromHost } from "./site-hostname";

/**
 * 届いた要求を、どのブログの画面へ渡すかの**判断だけ**を持つ。
 *
 * 配線（`src/middleware.ts`）から判断を切り離しているのは、
 * 入口の中に書くと画面を丸ごと起動しないと確かめられなくなるためで、
 * 理由は [[entry-gate]] と同じ。ここは文字列しか触らない。
 *
 * **基底ドメインが無い環境では何もしない。**
 * 手元・自動テスト・`*.workers.dev` は今までどおり `/s/<URL名>` で開く。
 * 「住所が未設定」と「住所が間違っている」を混同して全部 404 にすると、
 * 設定を入れる前の環境が丸ごと死ぬ。
 */

export type HostRouting =
  /** 何もしない。本体の画面（管理画面・サインイン）として扱う。 */
  | { readonly kind: "pass" }
  /** ブログの住所だった。この path の画面を出す。 */
  | { readonly kind: "rewrite"; readonly slug: string; readonly pathname: string }
  /** ブログの住所だが、そこに出してはいけない画面。 */
  | { readonly kind: "not-found" };

/**
 * ブログの住所では**出さない**入口。
 *
 * 管理画面と管理用 API をブログの住所からも開けるようにすると、
 * 通行証の有効範囲がブログの数だけ増える。読者の住所は読むだけにする。
 */
const OWNER_ONLY_PREFIXES: readonly string[] = ["/admin", "/api", "/signin", "/mcp"];

/** 住所に関係なく素通しする入口（画面の部品・Cloudflare の内部）。 */
const ALWAYS_PASS_PREFIXES: readonly string[] = ["/_next/", "/cdn-cgi/"];

function hasPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * 住所に関係なく素通しする入口か。
 *
 * 入口側が**住所表を引く前に**これで落とせるようにしてある。画面の部品は
 * 要求のたびに何十件も届くので、そこで D1 を引くと往復が跳ね上がる。
 */
export function isAlwaysPassPath(pathname: string): boolean {
  return ALWAYS_PASS_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * どのブログか決まったあとの、path だけの判断。
 *
 * 基底ドメインのサブドメイン（`<URL名>.<基底ドメイン>`）と独自ドメインは、
 * **ブログを特定するまでの引き方が違うだけで、特定したあとの扱いは同じ**である。
 * ここを 1 本にしていないと、管理画面をブログの住所から開けない規則が
 * 片方の経路にだけ効く、という形が作れてしまう。
 */
export function routeResolvedSite(slug: string, pathname: string): HostRouting {
  if (OWNER_ONLY_PREFIXES.some((prefix) => hasPrefix(pathname, prefix))) {
    return { kind: "not-found" };
  }
  // 住所で来ているのに `/s/...` も付けている要求は受けない。
  // 同じ画面に 2 通りの住所ができると、片方だけ直す変更が通ってしまう。
  if (hasPrefix(pathname, "/s")) return { kind: "not-found" };

  const suffix = pathname === "/" ? "" : pathname;
  return { kind: "rewrite", slug, pathname: `/s/${slug}${suffix}` };
}

export function decideHostRouting(input: {
  readonly host: string | null;
  readonly pathname: string;
  readonly baseDomain: string | null;
}): HostRouting {
  const { host, pathname, baseDomain } = input;
  if (host === null) return { kind: "pass" };
  if (isAlwaysPassPath(pathname)) return { kind: "pass" };

  const slug = siteSlugFromHost(host, baseDomain);
  // 基底ドメインの直下（`example.com` / `www.example.com`）と、
  // そもそも基底ドメインの下に無いホストは本体の画面。
  // **独自ドメインもここへ落ちる** — 判断には住所表が要るので、入口が
  // `routeResolvedSite` を改めて呼ぶ（ここは文字列しか触らない）。
  if (slug === null) return { kind: "pass" };

  return routeResolvedSite(slug, pathname);
}
