import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/infrastructure/identity/session-actor";
import { decideEntry, isGuardedPath } from "@/infrastructure/identity/entry-gate";

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
  // 守るのは管理画面だけ。読者のページ・サインイン画面・ログインの往復は通す。
  // ここへ `/api/auth` を含めると、誰もログインできなくなる。
  matcher: ["/admin", "/admin/:path*"],
};

export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (!isGuardedPath(request.nextUrl.pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
  const decision = await decideEntry(token, await tryGetSessionReader(), new Date());
  if (decision.kind === "通す") return NextResponse.next();

  // 戻り先（どの画面を開こうとしたか）は付けない。付けるなら、
  // 外のアドレスへ飛ばされないことを検査で固定してからにする。
  // 断る言葉は入口と奥で分ける。ここは「ログインしてください」だけを意味する。
  const signin = new URL("/signin", request.nextUrl);
  return NextResponse.redirect(signin);
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
