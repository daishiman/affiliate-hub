/**
 * @tier 1
 * @types equivalence, boundary, secrets
 * @req REQ-S10
 *
 * 「誰を通すか」の判定。
 *
 * ここで見るのは**設定が欠けたとき・名簿が空のときにどちらへ倒れるか**。
 * 通す側へ倒れる作りだと、設定を消すことが認証を外す操作になる。
 */
import { describe, expect, it, vi } from "vitest";
import {
  applyAppSession,
  assertAllowed,
  assertKnownUserAllowed,
  isAllowedEmail,
  parseAllowedEmails,
  readAuthConfig,
  reportAuthApiError,
  reportBetterAuthLog,
  type AfterAuthContext,
  type PassCookieAttributes,
} from "@/infrastructure/identity/better-auth";
import { SESSION_COOKIE_NAME } from "@/infrastructure/identity/session-actor";
import type { SessionIssuerPort } from "@/infrastructure/identity/session-issuer";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";

const FULL = {
  BETTER_AUTH_URL: "https://example.workers.dev",
  BETTER_AUTH_SECRET: "s".repeat(32),
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: "secret",
  AUTH_ALLOWED_EMAILS: "a@example.com",
};

describe("名簿の読み方", () => {
  it("読点でもカンマでも空白でも区切れる", () => {
    expect(parseAllowedEmails("a@x.com、b@x.com, c@x.com  d@x.com")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
      "d@x.com",
    ]);
  });

  it("大文字は揃える。Google が返す値と突き合わせるため", () => {
    expect(parseAllowedEmails("Taro@Example.COM")).toEqual(["taro@example.com"]);
  });

  it("アドレスの形をしていないものは名簿に入れない", () => {
    expect(parseAllowedEmails("メモ 、 taro@example.com , ---")).toEqual(["taro@example.com"]);
  });
});

describe("許可の判定は閉じる側へ倒す", () => {
  it("名簿が空なら、誰も通さない", () => {
    // ここを true にすると、設定を消すことが認証を外す操作になる。
    expect(isAllowedEmail("a@example.com", [])).toBe(false);
  });

  it("アドレスが無い・空のときも通さない", () => {
    expect(isAllowedEmail(null, ["a@example.com"])).toBe(false);
    expect(isAllowedEmail("", ["a@example.com"])).toBe(false);
    expect(isAllowedEmail("   ", ["a@example.com"])).toBe(false);
  });

  it("名簿に載っている相手だけを通す（大文字と前後の空白は無視する）", () => {
    expect(isAllowedEmail(" A@Example.com ", ["a@example.com"])).toBe(true);
    expect(isAllowedEmail("b@example.com", ["a@example.com"])).toBe(false);
  });

  it("似ているだけのアドレスは通さない", () => {
    expect(isAllowedEmail("a@example.com.attacker.test", ["a@example.com"])).toBe(false);
    expect(isAllowedEmail("xa@example.com", ["a@example.com"])).toBe(false);
  });
});

describe("設定の読み取り", () => {
  it("全部そろっていれば使える", () => {
    const availability = readAuthConfig(FULL);
    expect(availability.ready).toBe(true);
  });

  it("欠けているものを名前で返す（「使えません」だけにしない）", () => {
    const availability = readAuthConfig({ ...FULL, GOOGLE_CLIENT_SECRET: "  " });
    expect(availability.ready).toBe(false);
    if (availability.ready) return;
    expect(availability.missing).toEqual(["GOOGLE_CLIENT_SECRET"]);
  });

  it("何も無ければ、足りないもの 5 つを全部返す", () => {
    const availability = readAuthConfig({});
    expect(availability.ready).toBe(false);
    if (availability.ready) return;
    expect(availability.missing).toHaveLength(5);
  });

  it("名簿だけ空でも「使える」にしない", () => {
    const availability = readAuthConfig({ ...FULL, AUTH_ALLOWED_EMAILS: "" });
    expect(availability.ready).toBe(false);
    if (availability.ready) return;
    expect(availability.missing).toContain("AUTH_ALLOWED_EMAILS");
  });

  it("読み取った設定に秘密の値そのものを混ぜて返さない（足りない側の返り値）", () => {
    const availability = readAuthConfig({ ...FULL, BETTER_AUTH_SECRET: "" });
    expect(JSON.stringify(availability)).not.toContain("secret");
  });
});

/* --- 断る側の記録と、2 回目以降のログイン ------------------------------- */

type DenialRow = { readonly email: string; readonly reason: string };

/** 断った記録の書き込みだけを覚えておく、保存先の代役。 */
function recordingDb(rows: readonly { email: string; emailVerified: boolean }[] = []) {
  const denials: DenialRow[] = [];
  const db = {
    insert: () => ({
      values: (row: DenialRow) => {
        denials.push(row);
        return Promise.resolve();
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve(rows.map((r) => ({ email: r.email, verified: r.emailVerified }))),
        }),
      }),
    }),
  } as unknown as DrizzleD1;
  return { db, denials };
}

describe("通してよいかの門", () => {
  it("Google 側で確認できていないアドレスは通さない", async () => {
    const { db, denials } = recordingDb();
    await expect(assertAllowed(db, "a@example.com", false, ["a@example.com"])).rejects.toThrow();
    expect(denials[0]?.reason).toBe("email_unverified");
  });

  it("名簿に無い相手は通さない。理由を分けて残す", async () => {
    const { db, denials } = recordingDb();
    await expect(assertAllowed(db, "b@example.com", true, ["a@example.com"])).rejects.toThrow();
    expect(denials[0]?.reason).toBe("not_allowed");
  });

  it("名簿にある相手は通る", async () => {
    const { db } = recordingDb();
    await expect(assertAllowed(db, "a@example.com", true, ["a@example.com"])).resolves.toBeUndefined();
  });

  it("記録できなくても、断る判断は変えない", async () => {
    // 保存先を落とすだけで認証を外せる状態にしない。
    const broken = {
      insert: () => ({ values: () => Promise.reject(new Error("D1_ERROR")) }),
    } as unknown as DrizzleD1;
    await expect(assertAllowed(broken, "b@example.com", true, ["a@example.com"])).rejects.toThrow();
  });

  it("保存先が無いときも、断る判断は変えない", async () => {
    await expect(assertAllowed(null, "b@example.com", true, ["a@example.com"])).rejects.toThrow();
  });

  it("2 回目以降でも、名簿から外れた人はそこで止まる", async () => {
    const { db, denials } = recordingDb([{ email: "b@example.com", emailVerified: true }]);
    await expect(assertKnownUserAllowed(db, "u_1", ["a@example.com"])).rejects.toThrow();
    expect(denials[0]?.reason).toBe("not_allowed");
  });

  it("相手が分からないときは通さない", async () => {
    // 「分からない＝たぶん本人」で通すと、確かめられない状態が通行証になる。
    const { db } = recordingDb([]);
    await expect(assertKnownUserAllowed(db, "u_1", ["a@example.com"])).rejects.toThrow();
  });

  it("名簿にある人は 2 回目以降も通る", async () => {
    const { db } = recordingDb([{ email: "a@example.com", emailVerified: true }]);
    await expect(assertKnownUserAllowed(db, "u_1", ["a@example.com"])).resolves.toBeUndefined();
  });
});

/* --- Google との往復のあと --------------------------------------------- */

const COOKIE_ATTRS: PassCookieAttributes = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
};
const NOW = new Date("2026-08-18T00:00:00.000Z");

function fakeContext(over: {
  path?: string;
  cookie?: string | null;
  newSession?: AfterAuthContext["context"]["newSession"];
}) {
  const setCookie = vi.fn();
  const deleteSession = vi.fn(() => Promise.resolve());
  const ctx: AfterAuthContext = {
    path: over.path ?? "/callback/google",
    getCookie: () => over.cookie ?? null,
    setCookie,
    context: {
      newSession:
        over.newSession === undefined
          ? { user: { id: "u_1", email: "a@example.com" }, session: { token: "base" } }
          : over.newSession,
      internalAdapter: { deleteSession },
    },
  };
  return { ctx, setCookie, deleteSession };
}

function fakeIssuer(outcome: Awaited<ReturnType<SessionIssuerPort["issue"]>>) {
  return {
    issue: vi.fn(() => Promise.resolve(outcome)),
    revoke: vi.fn(() => Promise.resolve()),
  } satisfies SessionIssuerPort;
}

describe("往復のあとに通行証を出す", () => {
  it("担当者なら、この製品の通行証を cookie へ入れる", async () => {
    const expiresAt = new Date(NOW.getTime() + 1000);
    const issuer = fakeIssuer({ kind: "issued", session: { token: "pass_1", expiresAt } });
    const { ctx, setCookie } = fakeContext({});
    const { db } = recordingDb();

    await applyAppSession({ db, issuer, cookieAttributes: COOKIE_ATTRS }, ctx, NOW);

    expect(setCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, "pass_1", {
      ...COOKIE_ATTRS,
      expires: expiresAt,
    });
  });

  it("担当者でなければ、認証基盤側のログイン状態も残さない", async () => {
    // 残すと「入れないはずの人のログイン状態」が保存先に溜まる。
    const issuer = fakeIssuer({ kind: "not_member" });
    const { ctx, setCookie, deleteSession } = fakeContext({});
    const { db, denials } = recordingDb();

    await expect(
      applyAppSession({ db, issuer, cookieAttributes: COOKIE_ATTRS }, ctx, NOW),
    ).rejects.toThrow();

    expect(deleteSession).toHaveBeenCalledWith("base");
    expect(setCookie).not.toHaveBeenCalled();
    expect(denials[0]?.reason).toBe("no_membership");
  });

  it("保存先が落ちたときは「担当ではない」として記録しない", async () => {
    // 記録が混ざると、後から名簿の不備と障害を見分けられなくなる。
    const issuer = fakeIssuer({ kind: "failed", reason: "unavailable" });
    const { ctx, deleteSession } = fakeContext({});
    const { db, denials } = recordingDb();

    await expect(
      applyAppSession({ db, issuer, cookieAttributes: COOKIE_ATTRS }, ctx, NOW),
    ).rejects.toThrow();

    expect(deleteSession).toHaveBeenCalledWith("base");
    expect(denials).toEqual([]);
  });

  it("ログインが成立していない往復では、何もしない", async () => {
    const issuer = fakeIssuer({ kind: "not_member" });
    const { ctx, setCookie } = fakeContext({ newSession: null });
    const { db } = recordingDb();

    await applyAppSession({ db, issuer, cookieAttributes: COOKIE_ATTRS }, ctx, NOW);

    expect(issuer.issue).not.toHaveBeenCalled();
    expect(setCookie).not.toHaveBeenCalled();
  });

  it("ログアウトでは、保存先の通行証を無効にして cookie も消す", async () => {
    const issuer = fakeIssuer({ kind: "not_member" });
    const { ctx, setCookie } = fakeContext({ path: "/sign-out", cookie: "pass_1" });
    const { db } = recordingDb();

    await applyAppSession({ db, issuer, cookieAttributes: COOKIE_ATTRS }, ctx, NOW);

    expect(issuer.revoke).toHaveBeenCalledWith("pass_1", NOW);
    expect(setCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, "", {
      ...COOKIE_ATTRS,
      maxAge: 0,
    });
  });

  it("通行証が無い状態のログアウトでも、cookie は必ず消す", async () => {
    const issuer = fakeIssuer({ kind: "not_member" });
    const { ctx, setCookie } = fakeContext({ path: "/sign-out", cookie: null });
    const { db } = recordingDb();

    await applyAppSession({ db, issuer, cookieAttributes: COOKIE_ATTRS }, ctx, NOW);

    expect(issuer.revoke).not.toHaveBeenCalled();
    expect(setCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, "", {
      ...COOKIE_ATTRS,
      maxAge: 0,
    });
  });
});

/**
 * 壊れたことが記録に残るか。
 *
 * ここが黙ると、次に壊れたときも「黙って /signin へ戻る」だけになる。
 * 実際 `account.issuer` 列が無かった間、記録は 1 行も出ず、
 * 断ったのか壊れたのかを画面からも記録からも区別できなかった。
 * **出ないことが症状を隠す**ので、出ること自体を固定する。
 */
describe("失敗を記録に残す", () => {
  it("往復の失敗は原因を残し、token・cookie・secret は記録に出さない", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const cause = Object.assign(
      new Error("no such column: issuer; token=session-token-value"),
      {
        cookie: "ah_session=session-cookie-value",
        secret: "oauth-client-secret-value",
      },
    );

    reportAuthApiError(cause);

    const recorded = JSON.stringify(spy.mock.calls);
    expect(recorded).toContain("no such column: issuer");
    expect(recorded).not.toContain("session-token-value");
    expect(recorded).not.toContain("session-cookie-value");
    expect(recorded).not.toContain("oauth-client-secret-value");
    spy.mockRestore();
  });

  it("Better Auth 側は安全な例外argsを残し、Authorizationを秘匿する", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const cause = Object.assign(new Error("no such column: issuer"), {
      headers: {
        authorization: "Bearer bearer-token-value",
        cookie: "better-auth.session_token=session-cookie-value",
      },
    });

    reportBetterAuthLog("error", "Better auth was unable to query your database.", cause);

    const recorded = JSON.stringify(spy.mock.calls);
    expect(recorded).toContain("no such column: issuer");
    expect(recorded).not.toContain("bearer-token-value");
    expect(recorded).not.toContain("session-cookie-value");
    spy.mockRestore();
  });

  it("args が無い記録も、そのまま通す", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    reportBetterAuthLog("warn", "設定が足りません");

    expect(spy).toHaveBeenCalledWith("[better-auth:warn]", "設定が足りません");
    spy.mockRestore();
  });
});
