import { describe, expect, it, vi } from "vitest";

/**
 * 接続が無いときに null を返すこと。
 *
 * `drizzle(undefined)` は例外を投げず、使えない相手をそのまま返す。
 * そのため `tryGetDb()` は **接続が無い環境でも null を返していなかった**。
 * 画面には「保存されます」と出たまま、保存だけが後から落ちる形になる。
 * この分岐は一度実際に噛んだので、条件をここで固定する。
 */

vi.mock("server-only", () => ({}));

describe("D1 の接続が無いとき", () => {
  it("バインディングが無ければ null を返す（つながったことにしない）", async () => {
    vi.resetModules();
    vi.doMock("@opennextjs/cloudflare", () => ({
      getCloudflareContext: async () => ({ env: {} }),
    }));
    const { tryGetDb } = await import("@/infrastructure/persistence/d1/connection");
    expect(await tryGetDb()).toBeNull();
  });

  it("バインディングがあれば接続を返す", async () => {
    vi.resetModules();
    vi.doMock("@opennextjs/cloudflare", () => ({
      // D1 の実体は要らない。渡された物が使われることだけを見る。
      getCloudflareContext: async () => ({ env: { DB: { prepare: () => ({}) } } }),
    }));
    const { tryGetDb } = await import("@/infrastructure/persistence/d1/connection");
    expect(await tryGetDb()).not.toBeNull();
  });
});
