/**
 * @tier 1
 * @req REQ-S10, REQ-SEC01, REQ-SEC11, REQ-API02
 * @types equivalence, boundary, permission-matrix
 *
 * AWS-ACC-01 の門「そのもの」を動かす。
 *
 * 判定部品（`entry-gate.ts`）は既に 100% だが、
 * **門の配線（`src/middleware.ts`）は 1 行も実行されていなかった**
 * （final-review-log FR-02 の実測値: lines 0%）。
 * 部品が緑でも、配線が違う部品を呼んでいれば門は開いたままになる。
 * だからここは `middleware()` を実際に呼び、返ってきた `Response` を見る。
 *
 * 差し替えているのは**保存先（D1）だけ**である。
 * 判定（`decideEntry` / `isGuardedPath`）も応答の組み立ても本物を通す。
 * 判定を差し替えると、門を通したつもりで何も確かめないテストになる。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/infrastructure/identity/session-actor";
import type { SessionReaderPort } from "@/infrastructure/identity/session-repository";
import { asUserId, asWorkspaceId, domainError, err, ok } from "@/domain/shared";
import { buildSecurityHeaders } from "@/infrastructure/http/security-headers";

const NOW_PLUS = () => new Date(Date.now() + 60_000);

/** 有効な通行証。本物の形をまねない（`test-honesty` が鍵らしい形を弾く）。 */
const VALID = "dummy-session-for-tests";

/** 保存先の振る舞いを試験ごとに差し替えるための入れ物。 */
let dbMode: "あり" | "なし" | "例外" = "あり";
let readerBehavior: SessionReaderPort["findValid"] = async (token: string) =>
  token === VALID
    ? ok({
        userId: asUserId("user-1"),
        workspaceId: asWorkspaceId("ws-1"),
        expiresAt: NOW_PLUS(),
      })
    : ok(null);

vi.mock("@/infrastructure/persistence/d1/connection", () => ({
  tryGetDb: async () => {
    if (dbMode === "例外") throw new Error("接続そのものが落ちた");
    return dbMode === "あり" ? ({} as never) : null;
  },
}));

vi.mock("@/infrastructure/identity/session-repository", () => ({
  createD1SessionReader: () => ({
    findValid: (token: string, now: Date) => readerBehavior(token, now),
  }),
}));

/** 門を叩く。cookie を渡さなければ「未ログイン」。 */
async function 叩く(path: string, token?: string) {
  const { middleware } = await import("@/middleware");
  const request = new NextRequest(new URL(`https://example.test${path}`));
  if (token !== undefined) request.cookies.set(SESSION_COOKIE_NAME, token);
  return await middleware(request);
}

/** `NextResponse.next()` は本文を持たず、この目印を付けて奥へ渡す。 */
function 通したか(res: Response): boolean {
  return res.headers.get("x-middleware-next") === "1" && res.headers.get("location") === null;
}

beforeEach(() => {
  dbMode = "あり";
  readerBehavior = async (token: string) =>
    token === VALID
      ? ok({
          userId: asUserId("user-1"),
          workspaceId: asWorkspaceId("ws-1"),
          expiresAt: NOW_PLUS(),
        })
      : ok(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AWS-ACC-01 門の配線: どこを守ると宣言しているか", () => {
  /*
   * `config.matcher` は「どこを**守る**か」ではなく「どこを**通す**か」の宣言である。
   * ブログの住所（`<URL名>.example.com`）で来た読者を振り分けるために、
   * 2026-08-31 から matcher はほぼ全 path を拾う。守る範囲を決めているのは
   * 今までどおり `isGuardedPath` 一本で、そこは変わっていない。
   *
   * そこでこの節は matcher の字面ではなく、**守る範囲そのもの**を固定する。
   * 字面で固定していると、振り分けを足しただけでここが赤くなり、
   * 「門が壊れた」と「宣言が広がった」の区別がつかない。
   */
  it("守るのは `/admin` とその下だけで、ログインの往復と読者のページは守らない", async () => {
    const { isGuardedPath } = await import("@/infrastructure/identity/entry-gate");

    for (const guarded of ["/admin", "/admin/sites", "/admin/sites/new"]) {
      expect(isGuardedPath(guarded)).toBe(true);
    }
    // `/api/auth` を守ると誰もログインできなくなる。守っていないことを固定する。
    for (const open of ["/api/auth/callback", "/signin", "/s/home-office-desk", "/"]) {
      expect(isGuardedPath(open)).toBe(false);
    }
  });

  it("宣言は静的ファイルと Cloudflare の内部 path を拾わない", async () => {
    const { config } = await import("@/middleware");
    // 拾うと画像や JS まで門を通り、1 ページ開くたびに保存先を叩くことになる。
    for (const m of config.matcher) {
      expect(m).toContain("_next/");
      expect(m).toContain("cdn-cgi/");
    }
  });
});

describe("AWS-ACC-01 未ログインは入れない（本文を 1 バイトも返さない）", () => {
  it("通行証が無ければ `/signin` へ送り、本文は空である", async () => {
    const res = await 叩く("/admin/sites");

    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/signin");

    // Proxy が直接返す redirect にも、Next 設定を通る通常応答と同じ正本を適用する。
    for (const { key, value } of buildSecurityHeaders("admin")) {
      expect(res.headers.get(key)).toBe(value);
    }

    // 「見えないだけで中身は届いている」を許さない。本文の実測が 0 バイト。
    expect(res.body).toBeNull();
    const body = await res.clone().arrayBuffer();
    expect(body.byteLength).toBe(0);
    expect(await res.text()).toBe("");

    // 奥へ渡す目印が付いていないこと（＝素通りしていない）。
    expect(res.headers.get("x-middleware-next")).toBeNull();
  });

  it("`/admin` ちょうど（境界）でも送り返す", async () => {
    const res = await 叩く("/admin");
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/signin");
    expect((await res.clone().arrayBuffer()).byteLength).toBe(0);
  });

  it("通行証が偽物・期限切れでも送り返し、本文は空である", async () => {
    const res = await 叩く("/admin/sites", "偽の通行証");
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/signin");
    expect((await res.clone().arrayBuffer()).byteLength).toBe(0);
  });
});

describe("AWS-ACC-01 確かめられないときは通さない（D-02 fail-closed）", () => {
  it("保存先へ届かないとき、通行証を持っていても送り返す", async () => {
    dbMode = "なし";
    const res = await 叩く("/admin/sites", VALID);
    expect(通したか(res)).toBe(false);
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/signin");
  });

  it("接続を取る途中で落ちたとき（例外）も送り返す", async () => {
    dbMode = "例外";
    const res = await 叩く("/admin/sites", VALID);
    expect(通したか(res)).toBe(false);
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/signin");
  });

  it("保存先が答えを返せないとき（読み取り失敗）も送り返す", async () => {
    readerBehavior = async () =>
      err(domainError("UPSTREAM_UNAVAILABLE", "ログイン状態の確認に失敗しました。"));
    const res = await 叩く("/admin/sites", VALID);
    expect(通したか(res)).toBe(false);
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/signin");
  });
});

describe("AWS-ACC-01 通す側（全部拒否で緑にならないこと）", () => {
  it("有効な通行証なら奥へ通す", async () => {
    const res = await 叩く("/admin/sites", VALID);
    expect(通したか(res)).toBe(true);
    expect(res.status).toBe(200);
  });

  it("守らない道（`/signin`）は通行証なしでも通す", async () => {
    const res = await 叩く("/signin");
    expect(通したか(res)).toBe(true);
  });

  /**
   * 機械の呼び出し元に HTML のログイン画面を返しても直しようがない。
   * `/api` はこの門が触らず、各ルートの `authenticateApiRequest` が 401 を返す
   * （その 401 は `tests/presentation/api-routes.test.ts` が実際に叩いて見ている）。
   * ここが見るのは**この門が `/api` を横取りしていないこと**である。
   */
  it("`/api/...` は通行証なしでもログイン画面へ送らない", async () => {
    for (const path of ["/api/tools", "/api/mcp", "/api/auth/callback"]) {
      const res = await 叩く(path);
      expect(通したか(res)).toBe(true);
      expect(res.headers.get("location")).toBeNull();
    }
  });
});
