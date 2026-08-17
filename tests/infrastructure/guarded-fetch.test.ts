/** @tier 1 */
import { describe, expect, it } from "vitest";
import { MAX_REDIRECTS, checkHop, guardedFetch } from "@/infrastructure/http/guarded-fetch";

/**
 * 外から受け取った URL を取りに行くときの守り。
 *
 * 入口で 1 回だけ見ても足りない。外から見える URL が、
 * 転送で社内アドレスへ連れていくことがあるため。
 * ここで固定するのは「転送先にも同じ判定が当たること」。
 */

function response(init: {
  status?: number;
  location?: string;
  body?: string;
  contentType?: string;
}): Response {
  const headers = new Headers();
  if (init.location !== undefined) headers.set("location", init.location);
  headers.set("content-type", init.contentType ?? "text/html");
  return new Response(init.status !== undefined && init.status >= 300 && init.status < 400 ? null : (init.body ?? "本文"), {
    status: init.status ?? 200,
    headers,
  });
}

/** 行き先ごとの応答を決めておく差し替え用。 */
function fetcher(routes: Record<string, Response | (() => Response)>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    const found = routes[url];
    if (found === undefined) throw new Error(`想定していない行き先です: ${url}`);
    return typeof found === "function" ? found() : found;
  }) as typeof fetch;
}

describe("行き先の判定", () => {
  it("http と https 以外は取りに行かない", () => {
    const r = checkHop("file:///etc/passwd");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("file:");
  });

  it("内部ネットワーク宛は取りに行かない", () => {
    for (const url of [
      "http://127.0.0.1/",
      "http://169.254.169.254/latest/meta-data/",
      "http://192.168.0.1/",
      "http://10.0.0.5/",
      "http://localhost:8080/",
    ]) {
      const r = checkHop(url);
      expect(r.ok, url).toBe(false);
    }
  });

  it("外部の URL は通す", () => {
    expect(checkHop("https://example.com/a").ok).toBe(true);
  });
});

describe("転送の追いかけ方", () => {
  it("転送先が社内アドレスなら、そこで止める", async () => {
    const result = await guardedFetch("https://example.com/start", {
      fetchImpl: fetcher({
        "https://example.com/start": () =>
          response({ status: 302, location: "http://169.254.169.254/latest/meta-data/" }),
      }),
    });
    expect(result.kind).toBe("rejected");
    if (result.kind !== "rejected") return;
    expect(result.url).toContain("169.254.169.254");
    expect(result.reason).toContain("内部ネットワーク");
  });

  it("外部への転送は追いかけて、経由先を残す", async () => {
    const result = await guardedFetch("https://example.com/start", {
      fetchImpl: fetcher({
        "https://example.com/start": () =>
          response({ status: 301, location: "https://example.org/final" }),
        "https://example.org/final": () => response({ body: "最終的な本文" }),
      }),
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.finalUrl).toBe("https://example.org/final");
    expect(result.body).toBe("最終的な本文");
    expect(result.hops).toEqual(["https://example.com/start", "https://example.org/final"]);
  });

  it("相対的な転送先も、絶対の形に直してから判定する", async () => {
    const result = await guardedFetch("https://example.com/a/b", {
      fetchImpl: fetcher({
        "https://example.com/a/b": () => response({ status: 302, location: "/c" }),
        "https://example.com/c": () => response({ body: "移動先" }),
      }),
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.finalUrl).toBe("https://example.com/c");
  });

  it("転送が回り続けると、回数の上限で止める", async () => {
    const result = await guardedFetch("https://example.com/loop", {
      fetchImpl: fetcher({
        "https://example.com/loop": () =>
          response({ status: 302, location: "https://example.com/loop" }),
      }),
    });
    expect(result.kind).toBe("failed");
    if (result.kind !== "failed") return;
    expect(result.reason).toContain(String(MAX_REDIRECTS));
  });

  it("転送先が書かれていなければ、成功にしない", async () => {
    const result = await guardedFetch("https://example.com/x", {
      fetchImpl: fetcher({ "https://example.com/x": () => response({ status: 302 }) }),
    });
    expect(result.kind).toBe("failed");
  });

  it("最初から社内アドレスなら、取りに行かずに断る", async () => {
    const result = await guardedFetch("http://localhost:9999/secret", {
      fetchImpl: fetcher({}),
    });
    expect(result.kind).toBe("rejected");
  });
});
