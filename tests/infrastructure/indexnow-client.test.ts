/** @tier 1 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * IndexNow への送信を、実際に呼び出して確かめる。
 *
 * ここで一番大事なのは **鍵が戻り値に出てこないこと**。
 * 送信の結果は呼び出し元がログにも画面にも書く値なので、
 * 鍵がここへ混ざると、鍵は「書かれる場所」へ自分で歩いていく。
 * 鍵が居てよいのは送信本文の中だけである。
 *
 * 次に大事なのが **失敗しても throw しないこと**。IndexNow は通知であって
 * 公開の条件ではない。通知先の障害で記事の公開が道連れになってはいけない。
 *
 * @req REQ-SEO04
 * @types secrets, fault-injection, boundary
 */

/** 実在の鍵と紛れない形にする（理由は docs/product/credential-registration.md）。 */
const KEY = "test-indexnow-key-0123456789abcdef";

const envState: { key: unknown } = { key: KEY };

vi.mock("@/infrastructure/platform/worker-env", () => ({
  tryGetWorkerEnv: async () => (envState.key === undefined ? {} : { INDEXNOW_KEY: envState.key }),
}));

const { submitToIndexNow } = await import("@/infrastructure/indexnow/indexnow-client");

const ORIGIN = "https://example.com";
const URLS = ["https://example.com/s/gadget/a", "https://example.com/s/gadget/b"];

/** 送信を捕まえる。実際の網へは出さない。 */
function stubFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const spy = vi.fn(handler);
  vi.stubGlobal("fetch", spy);
  return spy;
}

beforeEach(() => {
  envState.key = KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("submitToIndexNow", () => {
  it("鍵が無いときは、黙って何もせず理由を返す", async () => {
    envState.key = undefined;
    const spy = stubFetch(async () => new Response(null, { status: 200 }));

    const result = await submitToIndexNow(ORIGIN, URLS);

    expect(result).toEqual({ status: "skipped", reason: "INDEXNOW_KEY が設定されていません。" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("鍵が空白だけのときも、設定されていないものとして扱う", async () => {
    // 登録画面で空欄を保存した跡が "   " で残ることがある。長さ 0 だけを見ると通ってしまう。
    envState.key = "   ";
    const spy = stubFetch(async () => new Response(null, { status: 200 }));

    expect(await submitToIndexNow(ORIGIN, URLS)).toEqual({
      status: "skipped",
      reason: "INDEXNOW_KEY が設定されていません。",
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("通知する URL が無いときは送らない", async () => {
    const spy = stubFetch(async () => new Response(null, { status: 200 }));

    expect(await submitToIndexNow(ORIGIN, [])).toEqual({
      status: "skipped",
      reason: "通知する URL がありません。",
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("origin が URL として読めないときも送らない", async () => {
    const spy = stubFetch(async () => new Response(null, { status: 200 }));

    expect(await submitToIndexNow("こわれた", URLS)).toEqual({
      status: "skipped",
      reason: "通知する URL がありません。",
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("送れたら、送った件数を返す", async () => {
    stubFetch(async () => new Response(null, { status: 200 }));

    expect(await submitToIndexNow(ORIGIN, URLS)).toEqual({ status: "sent", count: 2 });
  });

  it("行き先は固定で、本文には鍵と鍵の置き場所が入る", async () => {
    const spy = stubFetch(async () => new Response(null, { status: 200 }));

    await submitToIndexNow(ORIGIN, URLS);

    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.indexnow.org/indexnow");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      host: "example.com",
      key: KEY,
      keyLocation: "https://example.com/indexnow.txt",
      urlList: URLS,
    });
  });

  it("相手が失敗の番号を返したら、失敗として返す（例外にはしない）", async () => {
    stubFetch(async () => new Response(null, { status: 503 }));

    expect(await submitToIndexNow(ORIGIN, URLS)).toEqual({
      status: "failed",
      error: "IndexNow が 503 を返しました。",
    });
  });

  it("網が落ちていても、例外を外へ出さない", async () => {
    stubFetch(async () => {
      throw new Error("接続できません");
    });

    const result = await submitToIndexNow(ORIGIN, URLS);

    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(result.error).toContain("接続できません");
  });

  it("どの結末でも、戻り値に鍵は現れない", async () => {
    // 「鍵が漏れていないこと」は結末ごとに確かめないと意味がない。
    // 1 本だけ通す形にすると、後から足した分岐が黙って鍵を運べる。
    const endings: Array<() => void> = [
      () => stubFetch(async () => new Response(null, { status: 200 })),
      () => stubFetch(async () => new Response(null, { status: 500 })),
      () =>
        stubFetch(async () => {
          // 例外の文にわざと鍵を混ぜても、返る文には出ないこと。
          throw new Error(`失敗しました key=${KEY}`);
        }),
    ];

    for (const setUp of endings) {
      vi.unstubAllGlobals();
      setUp();
      const result = await submitToIndexNow(ORIGIN, URLS);
      expect(JSON.stringify(result)).not.toContain(KEY);
    }
  });
});
