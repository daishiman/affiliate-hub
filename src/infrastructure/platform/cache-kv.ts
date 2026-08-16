import type { CachePort, PortResult } from "@/application/ports";
import { domainError, err, ok } from "@/domain/shared";

/**
 * キャッシュ (Cloudflare KV)。
 *
 * バインディングを型で直接受けず、必要な形だけを構造で受け取る。
 * こうするとテストで差し替えられ、KV 以外へ替えるときもこのファイルだけで済む。
 */
export type KvLike = {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

/** KV の TTL は 60 秒未満を受け付けない。呼び出し側で毎回気にしないよう、ここで持ち上げる。 */
const MIN_TTL_SECONDS = 60;

export function createKvCache(kv: KvLike): CachePort {
  return {
    async get<T>(key: string): PortResult<T | null> {
      try {
        const raw = await kv.get(key, "text");
        return ok(raw === null ? null : (JSON.parse(raw) as T));
      } catch {
        // 壊れた値はキャッシュの事故であり、業務の失敗ではない。空として扱う。
        return ok(null);
      }
    },

    async set<T>(key: string, value: T, ttlSeconds: number): PortResult<true> {
      try {
        await kv.put(key, JSON.stringify(value), {
          expirationTtl: Math.max(ttlSeconds, MIN_TTL_SECONDS),
        });
        return ok(true);
      } catch {
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "一時保存に失敗しました。", { retryable: true }),
        );
      }
    },

    async delete(key: string): PortResult<true> {
      await kv.delete(key);
      return ok(true);
    },
  };
}

/** テスト用。メモリ上のキャッシュ。TTL は無視する。 */
export function memoryCache(): CachePort {
  const store = new Map<string, string>();
  return {
    async get<T>(key: string) {
      const raw = store.get(key);
      return ok(raw === undefined ? null : (JSON.parse(raw) as T));
    },
    async set<T>(key: string, value: T) {
      store.set(key, JSON.stringify(value));
      return ok(true as const);
    },
    async delete(key: string) {
      store.delete(key);
      return ok(true as const);
    },
  };
}
