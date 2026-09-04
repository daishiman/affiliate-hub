import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/infrastructure/identity/session-actor";
import { decideEntry, isGuardedPath } from "@/infrastructure/identity/entry-gate";
import { decideHostRouting } from "@/domain/authoring/site-host-routing";
import { buildSecurityHeaders } from "@/infrastructure/http/security-headers";
import { readSiteBaseDomain } from "@/infrastructure/platform/site-base-domain";

/**
 * 画面を一括で守る入口。
 *
 * **なぜ `proxy.ts` ではなく、非推奨の `middleware.ts` なのか。**
 *
 * Next.js 16 はこの仕組みを `proxy.ts` へ改名し、そちらは Node の実行環境で動く。
 * ところが Cloudflare Workers 側（`@opennextjs/cloudflare` 1.20.2）は
 * それを受け取れず、ビルドが
 * 「Node.js middleware is not currently supported」で止まる（実際に止めた）。
 * Next.js 自身の移行案内も
 * 「edge で動かしたいなら `middleware` を使い続けよ」と書いている
 * （`node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`）。
 *
 * **つまりこれは古いまま放置しているのではなく、いま動く唯一の置き場所である。**
 * 両者が揃った日に `proxy.ts` へ移す。移せる合図は上記のビルドが通ること。
 *
 * ここが見るのは**「ログインしているか」だけ**である。役は見ない。
 * 判定そのものは [[entry-gate]] にあり、このファイルは配線だけを持つ。
 * 入口の中に判定を書くと、画面を丸ごと動かさない限り確かめられなくなる。
 *
 * **この門ができても、奥の判定は要る。**
 * 変更を起こす操作（`"use server"`）は独立した URL を持たず、
 * それを使っている画面への POST として届く。つまり
 * `matcher` を変えたり操作を別の画面へ移したりすると、
 * ここの守りは**黙って外れる**（Next.js の docs にも同じ注意がある）。
 * だから「何をしてよいか」は、いまどおり各ユースケースが断る。
 */
export const config = {
  /**
   * 管理画面の門に加えて、**住所でブログを振り分ける**ためにほぼ全 path を通す。
   *
   * 守る対象が増えたわけではない。`isGuardedPath` が今までどおり
   * `/admin` だけを門の対象にするので、読者のページ・サインイン画面・
   * ログインの往復は素通しである（ここへ `/api/auth` の門を作ると
   * 誰もログインできなくなる、という性質は変わっていない）。
   *
   * 除いているのは画面の部品 (`_next`)・Cloudflare の内部 (`cdn-cgi`)・
   * 拡張子付きの静的ファイルで、これらは住所に関係なく同じものを返す。
   */
  matcher: ["/((?!_next/|cdn-cgi/|.*\\.[\\w]+$).*)"],
};

export async function middleware(request: NextRequest): Promise<NextResponse> {
  // 1. 住所（ホスト名）でブログを決める。**認証より先**に行う。
  //    後にすると、ブログの住所で開いた読者向けページが
  //    管理画面の門の判定を通ることになる。
  const routing = decideHostRouting({
    host: request.headers.get("host"),
    pathname: request.nextUrl.pathname,
    baseDomain: await readSiteBaseDomain(),
  });
  if (routing.kind === "not-found") {
    // ブログの住所からは管理画面を開かせない。**転送しない**のは、
    // 転送先の存在（＝管理画面がどこにあるか）を教えてしまうため。
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (routing.kind === "rewrite") {
    const target = new URL(request.nextUrl);
    target.pathname = routing.pathname;
    // 転送 (redirect) ではなく差し替え (rewrite)。
    // 読者のアドレス欄は `<URL名>.<基底ドメイン>` のままにする。
    return NextResponse.rewrite(target);
  }

  // 2. 本体の画面。ここから先は今までどおり管理画面だけを守る。
  if (!isGuardedPath(request.nextUrl.pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
  const decision = await decideEntry(token, await tryGetSessionReader(), new Date());
  if (decision.kind === "通す") return NextResponse.next();

  // 戻り先（どの画面を開こうとしたか）は付けない。付けるなら、
  // 外のアドレスへ飛ばされないことを検査で固定してからにする。
  // 断る言葉は入口と奥で分ける。ここは「ログインしてください」だけを意味する。
  const signin = new URL("/signin", request.nextUrl);
  const response = NextResponse.redirect(signin);
  // Proxy が直接返す応答は Next 設定の headers が Cloudflare adapter で落ちる。
  // 値を書き写さず、通常応答と同じ正本を redirect にも適用する。
  for (const { key, value } of buildSecurityHeaders("admin")) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * 通行証を確かめる相手（D1）。取れなければ `null`。
 *
 * `null` は「ログインしていない」ではなく「**確かめられない**」で、
 * [[entry-gate]] はそれを通さない側へ倒す。
 */
async function tryGetSessionReader() {
  try {
    const { tryGetDb } = await import("@/infrastructure/persistence/d1/connection");
    const db = await tryGetDb();
    if (db === null) return null;
    const { createD1SessionReader } = await import(
      "@/infrastructure/identity/session-repository"
    );
    return createD1SessionReader(db);
  } catch {
    return null;
  }
}
