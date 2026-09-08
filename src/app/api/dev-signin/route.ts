import { cookies } from "next/headers";
import { tryGetDb } from "@/infrastructure/persistence/d1/connection";
import { devSignInDecision, findDevUserId } from "@/infrastructure/identity/dev-signin";
import { SESSION_COOKIE_NAME } from "@/infrastructure/identity/session-actor";
import { createD1SessionIssuer } from "@/infrastructure/identity/session-issuer";

/**
 * 手元で画面を確かめるためだけの入口。判定は [[dev-signin]] が持つ。
 *
 * **開いていないときは 404 を返す。** 403 だと「口はあるが断られた」と分かり、
 * 積んだ環境で探す手掛かりになる。無い口は、無いように見せる。
 *
 * 通行証は本番と同じ [[session-issuer]] が出す。ここが短絡させているのは
 * **Google との往復だけ**で、担当者の登録の確認は素通しにしていない。
 */
export async function POST(): Promise<Response> {
  const decision = await devSignInDecision();
  if (decision.kind === "closed") {
    return new Response("Not Found", { status: 404 });
  }

  const db = await tryGetDb();
  if (db === null) {
    return new Response("保存先（D1）がありません。`pnpm db:migrate:local` を先に実行してください。", {
      status: 503,
    });
  }

  const userId = await findDevUserId(db, decision.email);
  if (userId === null) {
    return new Response(
      `${decision.email} の担当者がまだ居ません。\`pnpm seed:local\` を先に実行してください。`,
      { status: 409 },
    );
  }

  const outcome = await createD1SessionIssuer(db).issue(userId, decision.email, new Date());
  if (outcome.kind !== "issued") {
    return new Response(
      outcome.kind === "not_member"
        ? `${decision.email} はどの作業場所の担当でもありません。\`pnpm seed:local\` を実行してください。`
        : `通行証を出せませんでした: ${outcome.reason}`,
      { status: outcome.kind === "not_member" ? 403 : 500 },
    );
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, outcome.session.token, {
    httpOnly: true,
    // 手元は http なので付けない。付けると cookie が保存されず、入れたのに入れない。
    secure: false,
    sameSite: "lax",
    path: "/",
    expires: outcome.session.expiresAt,
  });

  return new Response(null, { status: 303, headers: { Location: "/admin" } });
}
