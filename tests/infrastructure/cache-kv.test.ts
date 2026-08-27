/** @tier 1 @req REQ-TS03, REQ-TS08 @types boundary, fault-injection, equivalence */
import { describe, expect, it, vi } from "vitest";
import { createKvCache, memoryCache } from "@/infrastructure/platform/cache-kv";

/**
 * KV のキャッシュ。
 *
 * ここで固定したいのは 2 つ。**読みの失敗は業務の失敗にしない**こと
 * （壊れた値が 1 つ入っただけで画面が落ちてはいけない）と、
 * **TTL を 60 秒まで持ち上げる**こと（KV が 60 秒未満を拒むので、
 * 呼び出し側が 30 秒と書いた瞬間に put ごと落ちる）。
 */

function kvSpy(overrides: Partial<Parameters<typeof createKvCache>[0]> = {}) {
  return {
    get: vi.fn(async () => null),
    put: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("createKvCache", () => {
  it("入っていなければ null を返す", async () => {
    const cache = createKvCache(kvSpy());
    const result = await cache.get<{ a: number }>("k");

    expect(result).toEqual({ ok: true, value: null });
  });

  it("入っている値は JSON として組み立て直す", async () => {
    const cache = createKvCache(kvSpy({ get: vi.fn(async () => '{"a":1}') }));
    const result = await cache.get<{ a: number }>("k");

    expect(result.ok && result.value).toEqual({ a: 1 });
  });

  it("壊れた値は事故として飲み込み、空として扱う", async () => {
    const cache = createKvCache(kvSpy({ get: vi.fn(async () => "{壊れている") }));
    const result = await cache.get("k");

    // err ではない。キャッシュが壊れただけで画面を止めない。
    expect(result).toEqual({ ok: true, value: null });
  });

  it("KV そのものが落ちていても、読みは空として返す", async () => {
    const cache = createKvCache(
      kvSpy({ get: vi.fn(async () => { throw new Error("KV down"); }) }),
    );

    expect(await cache.get("k")).toEqual({ ok: true, value: null });
  });

  it("TTL は 60 秒まで持ち上げる", async () => {
    const kv = kvSpy();
    await createKvCache(kv).set("k", { a: 1 }, 30);

    expect(kv.put).toHaveBeenCalledWith("k", '{"a":1}', { expirationTtl: 60 });
  });

  it("60 秒以上の TTL はそのまま渡す", async () => {
    const kv = kvSpy();
    await createKvCache(kv).set("k", "v", 3600);

    expect(kv.put).toHaveBeenCalledWith("k", '"v"', { expirationTtl: 3600 });
  });

  it("書きの失敗は、やり直せる断りとして返す", async () => {
    const cache = createKvCache(
      kvSpy({ put: vi.fn(async () => { throw new Error("KV down"); }) }),
    );
    const result = await cache.set("k", "v", 60);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
      expect(result.error.retryable).toBe(true);
    }
  });

  it("消すときは鍵をそのまま渡す", async () => {
    const kv = kvSpy();
    const result = await createKvCache(kv).delete("k");

    expect(kv.delete).toHaveBeenCalledWith("k");
    expect(result).toEqual({ ok: true, value: true });
  });
});

describe("memoryCache", () => {
  it("入れた値をそのまま取り出せ、消すと空に戻る", async () => {
    const cache = memoryCache();

    expect((await cache.get("k")).ok && (await cache.get("k"))).toEqual({ ok: true, value: null });
    await cache.set("k", { a: 1 }, 60);
    expect(await cache.get<{ a: number }>("k")).toEqual({ ok: true, value: { a: 1 } });
    await cache.delete("k");
    expect(await cache.get("k")).toEqual({ ok: true, value: null });
  });
});
