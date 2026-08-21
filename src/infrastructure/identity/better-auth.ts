import "server-only";

import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";

import { schema } from "@/db";
import { signinDenials, user as userTable } from "@/db/schema";
import { tryGetDb } from "@/infrastructure/persistence/d1/connection";
import { tryGetWorkerEnv } from "@/infrastructure/platform/worker-env";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";
import { SESSION_COOKIE_NAME } from "./session-actor";
import { createD1SessionIssuer, type SessionIssuerPort } from "./session-issuer";

/**
 * Google でのログイン。
 *
 * ここが持つのは**本人確認だけ**である。「その人が何をしてよいか」は持たない。
 * 権限は担当者の登録（`memberships`）から引く（[[session-actor]]）。
 * 分けてある理由は、ログインの方式を変えても権限の判定を書き直さずに済むこと。
 *
 * --- 許可の決め方 ---
 *
 * Google Workspace なら `hd` という区切り（会社のドメイン）で絞れるが、
 * **この製品の利用者は個人の Gmail である**。`@gmail.com` には区切りが無く、
 * ドメインで絞ると全世界の Gmail 利用者が通る。
 * よって**アドレスを名指しで許可する**（`AUTH_ALLOWED_EMAILS`）。
 *
 * 名簿が空のときは**全員を断る**。「設定漏れなら全員通す」にすると、
 * 設定を消すことが認証を外す操作になる。壊れ方は必ず閉じる側へ倒す。
 *
 * --- 断り方 ---
 *
 * 断るときは**セッションを作らない**。作ってから画面で断ると、
 * 「入れないはずの人が、入れた状態で立っている」ことになり、
 * その状態から漏れる経路を 1 つずつ塞ぐ作業が発生する。
 *
 * 断った試みは日時・アドレス・理由だけを残す（`signin_denials`）。
 * **合言葉・トークン・Google から返る値は 1 つも残さない。**
 * 残す目的は「誰かが入ろうとしているか」を後から見ることであって、
 * 入れなかった人を再現することではない。
 */

/** 認証に要る設定。1 つでも欠けたらログインは動かない（黙って動かさない）。 */
export type AuthConfig = {
  readonly baseUrl: string;
  readonly secret: string;
  readonly googleClientId: string;
  readonly googleClientSecret: string;
  readonly allowedEmails: readonly string[];
};

export type AuthAvailability =
  | { readonly ready: true; readonly config: AuthConfig }
  /** 何が足りないかを必ず名前で返す。「使えません」だけだと次の行動が決まらない。 */
  | { readonly ready: false; readonly missing: readonly string[] };

function readString(env: Readonly<Record<string, unknown>>, key: string): string {
  const value = env[key];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 名簿を読む。
 *
 * 区切りは読点でもカンマでもよい（人が手で入れる値なので、
 * 区切りを 1 種類に決めると、間違えた日に**全員が断られる**）。
 * 大文字小文字は揃える。Google が返すアドレスと突き合わせるため。
 */
export function parseAllowedEmails(raw: string): readonly string[] {
  return raw
    .split(/[,、\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes("@"));
}

export function readAuthConfig(env: Readonly<Record<string, unknown>>): AuthAvailability {
  const baseUrl = readString(env, "BETTER_AUTH_URL");
  const secret = readString(env, "BETTER_AUTH_SECRET");
  const googleClientId = readString(env, "GOOGLE_CLIENT_ID");
  const googleClientSecret = readString(env, "GOOGLE_CLIENT_SECRET");
  const allowedEmails = parseAllowedEmails(readString(env, "AUTH_ALLOWED_EMAILS"));

  const missing: string[] = [];
  if (baseUrl === "") missing.push("BETTER_AUTH_URL");
  if (secret === "") missing.push("BETTER_AUTH_SECRET");
  if (googleClientId === "") missing.push("GOOGLE_CLIENT_ID");
  if (googleClientSecret === "") missing.push("GOOGLE_CLIENT_SECRET");
  if (allowedEmails.length === 0) missing.push("AUTH_ALLOWED_EMAILS");

  if (missing.length > 0) return { ready: false, missing };
  return {
    ready: true,
    config: { baseUrl, secret, googleClientId, googleClientSecret, allowedEmails },
  };
}

/** 許可された相手か。**名簿が空なら常に false**（設定漏れは閉じる側へ倒す）。 */
export function isAllowedEmail(
  email: string | null | undefined,
  allowed: readonly string[],
): boolean {
  if (allowed.length === 0) return false;
  const normalized = (email ?? "").trim().toLowerCase();
  if (normalized === "") return false;
  return allowed.includes(normalized);
}

/**
 * 断った試みを残す。**失敗しても断る判断は変えない。**
 *
 * 記録できないことを理由に通すと、保存先を落とすだけで認証を外せることになる。
 */
async function recordDenial(
  db: DrizzleD1 | null,
  email: string,
  reason: "not_allowed" | "email_unverified" | "no_membership",
): Promise<void> {
  if (db === null) return;
  try {
    await db.insert(signinDenials).values({
      id: crypto.randomUUID(),
      at: new Date(),
      email: email.trim().toLowerCase(),
      reason,
    });
  } catch {
    // 記録の失敗は握りつぶす。ここで例外を投げると、
    // 断る処理そのものが 500 になり、断られたことが利用者に伝わらない。
  }
}

/**
 * 通してよいかを決める、唯一の関門。
 *
 * 新しい人（`user.create`）と、2 回目以降の人（`session.create`）の
 * **両方**がここを通る。片方だけにすると、一度でも登録された人は
 * 名簿から外したあとも入り続ける。
 */
export async function assertAllowed(
  db: DrizzleD1 | null,
  email: string,
  emailVerified: boolean,
  allowed: readonly string[],
): Promise<void> {
  if (!emailVerified) {
    await recordDenial(db, email, "email_unverified");
    throw new APIError("FORBIDDEN", { message: "ACCESS_DENIED" });
  }
  if (!isAllowedEmail(email, allowed)) {
    await recordDenial(db, email, "not_allowed");
    throw new APIError("FORBIDDEN", { message: "ACCESS_DENIED" });
  }
}

/**
 * 2 回目以降のログイン。名簿から外した人がここで止まる。
 *
 * `betterAuth(...)` の引数の中に直接書かず、名前のある関数にしてあるのは、
 * **門の判定だけを取り出して確かめられる状態にするため**である。
 * 引数リテラルの中に置くと、この判定はログインを丸ごと動かさない限り実行されない。
 */
export async function assertKnownUserAllowed(
  db: DrizzleD1,
  userId: string,
  allowed: readonly string[],
): Promise<void> {
  const rows = await db
    .select({ email: userTable.email, verified: userTable.emailVerified })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  const found = rows[0];
  // 相手が分からないときは通さない。
  // 「分からない＝たぶん本人」で通すと、確かめられない状態が通行証になる。
  if (found === undefined) {
    throw new APIError("FORBIDDEN", { message: "ACCESS_DENIED" });
  }
  await assertAllowed(db, found.email, found.verified === true, allowed);
}

/** cookie に付ける属性。値そのものではなく、扱い方を決める。 */
export type PassCookieAttributes = {
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite: "lax";
  readonly path: string;
};

/**
 * Google との往復のあとに受け取るもの。
 *
 * Better Auth が渡す文脈のうち、**ここで実際に使う分だけ**を書いている。
 * 全部を書き写すと、認証基盤の更新のたびにこちらの型が壊れる。
 */
export type AfterAuthContext = {
  readonly path: string;
  readonly getCookie: (name: string) => string | null | undefined;
  readonly setCookie: (name: string, value: string, attributes: object) => void;
  readonly context: {
    readonly newSession?: {
      readonly user: { readonly id: string; readonly email: string };
      readonly session: { readonly token: string };
    } | null;
    readonly internalAdapter: {
      readonly deleteSession: (token: string) => Promise<unknown>;
    };
  };
};

/**
 * Google との往復が終わったあと。
 *
 * ここで**この製品の通行証**（`ah_session`）を出す。Better Auth のセッションは
 * Google と往復するための足場であって、画面の権限には使わない
 * （理由は [[session-issuer]] 冒頭）。
 */
export async function applyAppSession(
  deps: {
    readonly db: DrizzleD1;
    readonly issuer: SessionIssuerPort;
    readonly cookieAttributes: PassCookieAttributes;
  },
  ctx: AfterAuthContext,
  now: Date = new Date(),
): Promise<void> {
  if (ctx.path === "/sign-out") {
    const token = ctx.getCookie(SESSION_COOKIE_NAME);
    if (token) await deps.issuer.revoke(token, now);
    // 保存先の更新が失敗しても、cookie は必ず消す。
    // 消さないと、その端末には無効な通行証が残り続ける。
    ctx.setCookie(SESSION_COOKIE_NAME, "", { ...deps.cookieAttributes, maxAge: 0 });
    return;
  }

  const created = ctx.context.newSession;
  if (!created) return;

  const outcome = await deps.issuer.issue(created.user.id, created.user.email, now);

  if (outcome.kind !== "issued") {
    // 通行証を出せないなら、足場の側も残さない。
    // 残すと「入れないはずの人のログイン状態」が保存先に溜まり、
    // あとで別の入口が増えたときに、それが通行証に化ける。
    await ctx.context.internalAdapter.deleteSession(created.session.token);
    if (outcome.kind === "not_member") {
      await recordDenial(deps.db, created.user.email, "no_membership");
    }
    throw new APIError("FORBIDDEN", { message: "ACCESS_DENIED" });
  }

  ctx.setCookie(SESSION_COOKIE_NAME, outcome.session.token, {
    ...deps.cookieAttributes,
    expires: outcome.session.expiresAt,
  });
}

/**
 * この実行のログインの仕組みを組み立てる。
 *
 * **module の読み込み時に作らない。** 接続も設定もリクエストごとに供給されるため、
 * 読み込み時に固定すると、最初の 1 リクエストの環境が全部に効いてしまう。
 */
export function createAuth(db: DrizzleD1, config: AuthConfig) {
  const issuer = createD1SessionIssuer(db);
  // 本番は https。手元の確認（`pnpm run preview`）は http なので、
  // ここを常に true にすると手元では cookie が付かず、ログインが成立しない。
  const passAttributes = {
    httpOnly: true,
    secure: config.baseUrl.startsWith("https://"),
    // Google からの戻りは別サイトからの画面遷移なので、"strict" だと cookie が付かない。
    sameSite: "lax" as const,
    path: "/",
  };

  return betterAuth({
    appName: "affiliate-hub",
    baseURL: config.baseUrl,
    secret: config.secret,
    trustedOrigins: [config.baseUrl],
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
      // D1 は複数の操作をまとめて取り消す仕組みを持たない。
      // 使えるふりをすると、途中で失敗したときに中途半端な行が残る。
      transaction: false,
    }),
    socialProviders: {
      google: {
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
        // 共有の端末で、前の人のアカウントのまま入らないようにする。
        prompt: "select_account",
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (newUser) => {
            await assertAllowed(
              db,
              newUser.email,
              newUser.emailVerified === true,
              config.allowedEmails,
            );
            return { data: newUser };
          },
        },
      },
      session: {
        create: {
          before: async (newSession) => {
            await assertKnownUserAllowed(db, newSession.userId, config.allowedEmails);
            return { data: newSession };
          },
        },
      },
    },
    /** 中身は [[applyAppSession]]。ここは配線だけにして、判定は取り出せる形に置く。 */
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        await applyAppSession({ db, issuer, cookieAttributes: passAttributes }, ctx);
      }),
    },
    /**
     * ログインに失敗したら、この画面へ戻す。理由は画面側が言葉にする。
     *
     * **失敗の中身はサーバーの記録にだけ残す。** 画面へ出さないのは
     * 「どの設定が抜けているか」を入ろうとした人に教えないためだが、
     * どこにも出さないと、運用する人まで原因を見られなくなる。
     * 実際、Google との往復が黙って `/signin` へ戻る状態を追ったとき、
     * 記録が 1 行も無いせいで、断ったのか壊れたのかが分からなかった。
     */
    onAPIError: {
      errorURL: "/signin",
      onError: (error) => {
        console.error("[auth] ログインの往復が失敗しました:", error);
      },
    },
    /**
     * Better Auth 自身の記録をどこへ流すか。
     *
     * 既定では `console` へ直接書かれるが、`account.issuer` 列が無くて
     * ログインが壊れていた間、その記録は 1 行も出てこなかった。
     * 出るはずのものが出ない状態のまま運用すると、次に壊れたときも
     * 「黙って /signin へ戻る」だけになる。
     *
     * **`args` まで出す。** ここに入るのは例外そのもので、
     * 今回原因を指していたのも `args` の側だった（`message` は
     * 「データベースに問い合わせられませんでした」までしか言わない）。
     * 出力先は Cloudflare の記録で、運用する人しか見ない。
     * 画面へ返す言葉とは別物なので、入ろうとした人には何も伝わらない。
     */
    logger: {
      level: "error",
      log: (level, message, ...args) => {
        console.error(`[better-auth:${level}]`, message, ...args);
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      // ログインの入口だけは厳しくする。総当たりで名簿を探られる口になるため。
      customRules: { "/sign-in/social": { window: 60, max: 10 } },
    },
    advanced: {
      // Cloudflare の後ろでは、素の接続元アドレスは常に Cloudflare になる。
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
  });
}

/**
 * 組み立てた結果の型。`ReturnType<typeof betterAuth>` と書くと
 * 設定の中身が消えた広い型になり、呼び出し側で型が合わなくなる。
 */
export type Auth = ReturnType<typeof createAuth>;

/**
 * この実行で使えるログインの仕組み。使えなければ `null`。
 *
 * **null を「ログイン成功」に読み替えない。** 呼び出し側は、null のときは
 * ログインしていない扱いにする（`resolveActor`）。
 */
export async function tryGetAuth(): Promise<Auth | null> {
  const db = await tryGetDb();
  if (db === null) return null;
  const availability = readAuthConfig(await tryGetWorkerEnv());
  if (!availability.ready) return null;
  return createAuth(db, availability.config);
}

/** ログインが使えるかどうかと、使えないなら何が足りないか。画面に出すため。 */
export async function authAvailability(): Promise<AuthAvailability> {
  return readAuthConfig(await tryGetWorkerEnv());
}
