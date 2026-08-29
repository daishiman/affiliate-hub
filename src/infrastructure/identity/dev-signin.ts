import "server-only";

import { user as userTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { tryGetWorkerEnv } from "../platform/worker-env";
import type { DrizzleD1 } from "../persistence/d1/link-inbox-repository";

/**
 * 手元で画面を確かめるためだけのログイン。
 *
 * --- なぜ要るのか ---
 *
 * この製品のログインは Google との往復しか持っていない
 * （[[better-auth]]）。往復には Google 側で登録した識別子と秘密の値が要る。
 * 手元にはそれが無い（`.dev.vars` は配らない、[[no-secrets-in-ai-reachable-paths]]）。
 * つまり **手元では誰も `/admin` に入れない**。入れないと、管理画面の
 * 6 枚は「書いたが一度も見ていない画面」のまま残る。
 *
 * --- なぜ危なくない形にできるか ---
 *
 * 危ないのは「合言葉なしで通行証が出る口」が**本番に立つ**ことである。
 * だから旗を 2 つ立て、**両方が同時に立ったときだけ**開ける。
 *
 *   1. `DEV_SIGNIN_ENABLED === "1"` … `.dev.vars`（配らない・git に入らない）でしか立たない。
 *      `wrangler.jsonc` の `vars` に書けば本番にも配られてしまうので、
 *      **書かれていないこと**を検査で固定する（`tests/architecture`）。
 *   2. `NODE_ENV !== "production"` … 積んだ Worker は必ず production である。
 *
 * 1 だけだと「うっかり本番の設定に足した」で開く。2 だけだと「手元でも常に開く」。
 * 片方を破っただけでは開かない形にしてある。
 *
 * --- 誰として入るのか ---
 *
 * ここで人を**作らない**。既にある `user` の行をアドレスで引くだけである。
 * 作れるようにすると、この口は「誰にでもなれる口」になる。
 * 通行証そのものは本番と同じ [[session-issuer]] が出すので、
 * 担当者の登録が無いアドレスでは、この口を通っても入れない。
 */

/** 旗の名前。2 か所に書かないため、ここだけで持つ。 */
export const DEV_SIGNIN_FLAG = "DEV_SIGNIN_ENABLED";
/** 誰として入るかを指す旗。既定は seed が入れる担当者。 */
export const DEV_SIGNIN_EMAIL_KEY = "DEV_SIGNIN_EMAIL";
export const DEV_SIGNIN_DEFAULT_EMAIL = "owner@local.test";

export type DevSignInDecision =
  | { readonly kind: "open"; readonly email: string }
  /** 開けない。理由は画面に出してよい（本番では旗が無いので、そもそも出ない）。 */
  | { readonly kind: "closed"; readonly reason: string };

/**
 * 旗だけを見て決める。**入出力を持たないので、そのまま試せる。**
 *
 * 判定を route の中に書くと、「本番で閉じている」ことを確かめるのに
 * Worker を積む必要が出る。ここに出しておけば表で確かめられる。
 */
export function decideDevSignIn(input: {
  readonly flag: unknown;
  readonly email: unknown;
  readonly nodeEnv: string | undefined;
}): DevSignInDecision {
  if (input.nodeEnv === "production") {
    return { kind: "closed", reason: "積んだ環境では使えない口である。" };
  }
  if (input.flag !== "1") {
    return { kind: "closed", reason: `${DEV_SIGNIN_FLAG} が "1" ではない。` };
  }
  const email = typeof input.email === "string" && input.email.trim() !== ""
    ? input.email.trim()
    : DEV_SIGNIN_DEFAULT_EMAIL;
  return { kind: "open", email };
}

/** いまの環境で開いているか。画面（`/signin`）と route の両方から引く。 */
export async function devSignInDecision(): Promise<DevSignInDecision> {
  const env = await tryGetWorkerEnv();
  return decideDevSignIn({
    flag: env[DEV_SIGNIN_FLAG],
    email: env[DEV_SIGNIN_EMAIL_KEY],
    nodeEnv: process.env.NODE_ENV,
  });
}

/** アドレスから担当者を引く。**居なければ作らない。** */
export async function findDevUserId(db: DrizzleD1, email: string): Promise<string | null> {
  const rows = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);
  return rows[0]?.id ?? null;
}
