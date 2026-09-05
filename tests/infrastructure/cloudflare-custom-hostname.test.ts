/** @tier 1 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cloudflare for SaaS の custom hostname とのつなぎ目を、実際に呼んで確かめる。
 *
 * ここで一番大事なのは **API token が戻り値へ出てこないこと**。この層の戻り値は
 * 呼び出し元が画面にもログにも書く。token が理由文に混ざれば、token は自分の足で
 * 「書かれる場所」へ歩いていく。fetch の実装が要求ヘッダを例外メッセージへ写す日が
 * 来ても壊れないよう、外へ出す前に伏せることを実際に検査する。
 *
 * 次に大事なのが **外部の語彙をこちらの状態へ翻訳できていること**。翻訳表が崩れると、
 * 配信できていない住所が「有効」に見える。取り消しの 404 を成功として扱うことも
 * 同じ理由で検査する。失敗にすると、向こうが掃除済みのとき取り下げが永久に終わらない。
 *
 * @req REQ-BOPC01
 * @req feat-blog-custom-domain
 * @types secrets, fault-injection, boundary
 */

/** 実在の token と紛れない形にする（理由は docs/product/credential-registration.md）。 */
const TOKEN = "test-cloudflare-token-0123456789ab";
const ZONE = "test-zone-id-0123456789";

const envState: { token: unknown; zone: unknown } = { token: TOKEN, zone: ZONE };

vi.mock("@/infrastructure/platform/worker-env", () => ({
  tryGetWorkerEnv: async () => ({
    CLOUDFLARE_API_TOKEN: envState.token,
    CLOUDFLARE_ZONE_ID: envState.zone,
  }),
}));

const { createCloudflareCustomHostnameProvider } = await import(
  "@/infrastructure/domains/cloudflare-custom-hostname"
);

/** 送信を捕まえる。実際の網へは出さない。 */
function stubFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const spy = vi.fn(handler);
  vi.stubGlobal("fetch", spy);
  return spy;
}

function cfOk(result: unknown) {
  return async () =>
    new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
}

beforeEach(() => {
  envState.token = TOKEN;
  envState.zone = ZONE;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("設定が無いとき", () => {
  it.each([
    ["token が未設定", { token: undefined, zone: ZONE }],
    ["token が空白だけ", { token: "   ", zone: ZONE }],
    ["token が文字列でない", { token: 42, zone: ZONE }],
    ["zone が未設定", { token: TOKEN, zone: undefined }],
    ["zone が空白だけ", { token: TOKEN, zone: "  " }],
  ])("%s なら外部を呼ばずに設定不足を返す", async (_name, state) => {
    envState.token = state.token;
    envState.zone = state.zone;
    const spy = stubFetch(cfOk({}));
    const provider = createCloudflareCustomHostnameProvider();

    for (const result of [
      await provider.request("blog.example.com"),
      await provider.snapshot("hostname-1"),
      await provider.release("hostname-1"),
    ]) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_SUPPORTED");
    }
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("request", () => {
  it("申し込みに成功したら、向こうの状態をこちらの語彙へ翻訳して返す", async () => {
    const spy = stubFetch(
      cfOk({
        id: "ch-1",
        hostname: "blog.example.com",
        status: "pending",
        ownership_verification: { type: "txt", name: "_cf.blog", value: "ov-value" },
        ownership_verification_http: { http_url: "http://blog/.well-known/x", http_body: "body" },
        ssl: {
          status: "pending_validation",
          validation_records: [
            { txt_name: "_acme.blog", txt_value: "acme-value" },
            { txt_name: undefined, txt_value: "落とす" },
          ],
        },
      }),
    );

    const result = await createCloudflareCustomHostnameProvider().request("blog.example.com");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.externalHostnameId).toBe("ch-1");
    expect(result.value.status).toBe("pending");
    expect(result.value.certificateStatus).toBe("pending");
    expect(result.value.lastError).toBeNull();
    expect(result.value.instructions.map((i) => i.recordType)).toEqual(["TXT", "HTTP", "TXT"]);
    // 案内は値だけでなく「なぜ要るか」を伴う。消してよいか判断できないと住所が落ちる。
    for (const instruction of result.value.instructions) {
      expect(instruction.why.length).toBeGreaterThan(0);
    }

    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      hostname: "blog.example.com",
      ssl: { method: "txt", type: "dv", settings: { min_tls_version: "1.2" } },
    });
  });

  it("向こうの理由は全部つなげて返す。先頭だけ残すと本当の原因に辿り着けない", async () => {
    stubFetch(
      cfOk({
        id: "ch-2",
        hostname: "blog.example.com",
        status: "moved",
        verification_errors: ["所有権が確認できません"],
        ssl: {
          status: "expired",
          validation_errors: [{ message: "証明書が失効しています" }, { message: undefined }],
        },
      }),
    );

    const result = await createCloudflareCustomHostnameProvider().request("blog.example.com");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed");
    expect(result.value.certificateStatus).toBe("expired");
    expect(result.value.lastError).toBe("所有権が確認できません / 証明書が失効しています");
    expect(result.value.instructions).toEqual([]);
  });

  it("向こうが失敗を返したら、理由を伝えつつ再試行できると告げる", async () => {
    stubFetch(
      async () =>
        new Response(
          JSON.stringify({ success: false, errors: [{ message: "重複" }, { message: undefined }] }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
    );

    const result = await createCloudflareCustomHostnameProvider().request("blog.example.com");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(result.error.message).toBe("重複");
    expect(result.error.retryable).toBe(true);
  });

  it("理由が 1 つも無いときは、せめて状態コードを伝える", async () => {
    stubFetch(
      async () =>
        new Response(JSON.stringify({ success: false }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
    );

    const result = await createCloudflareCustomHostnameProvider().request("blog.example.com");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("503");
  });

  it("success が真でも result が無ければ成功にしない", async () => {
    stubFetch(
      async () =>
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    const result = await createCloudflareCustomHostnameProvider().request("blog.example.com");

    expect(result.ok).toBe(false);
  });

  it("向こうの理由に token が混ざっていても、そのまま外へ出さない", async () => {
    stubFetch(
      async () =>
        new Response(
          JSON.stringify({ success: false, errors: [{ message: `Bearer ${TOKEN} は無効です` }] }),
          { status: 403, headers: { "content-type": "application/json" } },
        ),
    );

    const result = await createCloudflareCustomHostnameProvider().request("blog.example.com");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).not.toContain(TOKEN);
    expect(result.error.message).toContain("***");
    // 伏せるのは token だけ。文の残りを消すと原因を辿れなくなる。
    expect(result.error.message).toContain("は無効です");
  });

  it("通信そのものが落ちても throw せず、理由を伏せ字にして返す", async () => {
    stubFetch(async () => {
      throw new Error(`socket closed while sending ${TOKEN}`);
    });

    const result = await createCloudflareCustomHostnameProvider().request("blog.example.com");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.retryable).toBe(true);
    expect(JSON.stringify(result.error)).not.toContain(TOKEN);
  });

  it("Error でないものが投げられても文字列にして扱う", async () => {
    stubFetch(async () => {
      // biome-ignore lint/complexity/useLiteralKeys: 文字列以外が投げられる経路の再現
      throw "壊れた応答";
    });

    const result = await createCloudflareCustomHostnameProvider().request("blog.example.com");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(String(result.error.details?.["reason"])).toContain("壊れた応答");
  });
});

describe("状態の翻訳", () => {
  async function statusOf(status: string, sslStatus?: string) {
    stubFetch(
      cfOk({ id: "ch", hostname: "h", status, ...(sslStatus === undefined ? {} : { ssl: { status: sslStatus } }) }),
    );
    const result = await createCloudflareCustomHostnameProvider().snapshot("ch");
    if (!result.ok) throw new Error("成功するはずの経路");
    return result.value;
  }

  it.each([
    ["active", "active"],
    ["pending", "pending"],
    ["active_redeploying", "verifying"],
    ["pending_deletion", "verifying"],
    ["blocked", "verifying"],
    ["moved", "failed"],
    ["deleted", "failed"],
    ["見たことのない状態", "verifying"],
  ])("hostname が %s なら %s とみなす", async (given, expected) => {
    expect((await statusOf(given)).status).toBe(expected);
  });

  it.each([
    ["active", "issued"],
    ["pending_validation", "pending"],
    ["pending_issuance", "pending"],
    ["pending_deployment", "pending"],
    ["initializing", "pending"],
    ["expired", "expired"],
    ["見たことのない状態", "error"],
  ])("証明書が %s なら %s とみなす", async (given, expected) => {
    expect((await statusOf("pending", given)).certificateStatus).toBe(expected);
  });

  it("証明書の記述そのものが無ければ「まだ無い」とみなす", async () => {
    expect((await statusOf("pending")).certificateStatus).toBe("none");
  });
});

describe("snapshot", () => {
  it("id を URL へ埋めるとき、そのままつなげない", async () => {
    const spy = stubFetch(cfOk({ id: "ch", hostname: "h", status: "active" }));

    await createCloudflareCustomHostnameProvider().snapshot("ch/../../zones");

    expect(String(spy.mock.calls[0]?.[0])).toContain("ch%2F..%2F..%2Fzones");
  });

  it("向こうが失敗を返したら、理由を伏せ字にして返す", async () => {
    stubFetch(
      async () =>
        new Response(JSON.stringify({ success: false, errors: [{ message: `token=${TOKEN}` }] }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
    );

    const result = await createCloudflareCustomHostnameProvider().snapshot("ch");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).not.toContain(TOKEN);
    expect(result.error.retryable).toBe(true);
  });

  it("通信そのものが落ちても throw しない", async () => {
    stubFetch(async () => {
      throw new Error("timeout");
    });

    const result = await createCloudflareCustomHostnameProvider().snapshot("ch");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toBe("ドメインの状態を確認できませんでした。");
  });
});

describe("release", () => {
  it("取り消せたら成功を返す", async () => {
    const spy = stubFetch(async () => new Response(null, { status: 200 }));

    const result = await createCloudflareCustomHostnameProvider().release("ch-1");

    expect(result).toEqual({ ok: true, value: true });
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
  });

  it("向こうに既に無ければ（404）成功として扱う", async () => {
    stubFetch(async () => new Response(null, { status: 404 }));

    const result = await createCloudflareCustomHostnameProvider().release("ch-1");

    expect(result).toEqual({ ok: true, value: true });
  });

  it("404 以外の失敗は、状態コードを添えて再試行できると告げる", async () => {
    stubFetch(async () => new Response(null, { status: 500 }));

    const result = await createCloudflareCustomHostnameProvider().release("ch-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("500");
    expect(result.error.retryable).toBe(true);
  });

  it("通信そのものが落ちても throw せず、token を伏せて返す", async () => {
    stubFetch(async () => {
      throw new Error(`refused (${TOKEN})`);
    });

    const result = await createCloudflareCustomHostnameProvider().release("ch-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(JSON.stringify(result.error)).not.toContain(TOKEN);
  });

  it("取り消しの要求に token を載せるが、返す値には載せない", async () => {
    const spy = stubFetch(async () => new Response(null, { status: 200 }));

    const result = await createCloudflareCustomHostnameProvider().release("ch-1");

    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(JSON.stringify(init.headers)).toContain(TOKEN);
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });
});
