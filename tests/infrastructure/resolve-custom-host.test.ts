/**
 * @tier 1
 * @req REQ-BOPC01
 * @req feat-blog-custom-domain
 * @types equivalence, boundary, scenario
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCustomHostCache,
  normalizeRequestHost,
  resolveCanonicalHostForSite,
  resolveCustomHostSlug,
} from "@/infrastructure/domains/resolve-custom-host";

/**
 * 入口が独自ドメインからブログを引く経路。
 *
 * ここで固定したいのは**写しの規則**であって D1 の引き方ではない。
 * 引き方は `tests/integration/d1-custom-domain.test.ts` が別に見ている。
 */
describe("独自ドメインの住所引き", () => {
  beforeEach(() => {
    clearCustomHostCache();
  });

  describe("Host ヘッダの正規化", () => {
    it("ポート番号を落とす（手元の :3000 が住所として流れないように）", () => {
      expect(normalizeRequestHost("blog.example.com:3000")).toBe("blog.example.com");
    });

    it("大文字を小文字に倒す", () => {
      expect(normalizeRequestHost("Blog.Example.COM")).toBe("blog.example.com");
    });

    it("ホスト名として成り立たない値は null", () => {
      expect(normalizeRequestHost("not a host/path")).toBeNull();
      expect(normalizeRequestHost(null)).toBeNull();
    });
  });

  describe("写しの規則", () => {
    it("同じホストの2回目は照会しない", async () => {
      const lookup = vi.fn(async () => "my-blog");

      const first = await resolveCustomHostSlug("blog.example.com", lookup, 0);
      const second = await resolveCustomHostSlug("blog.example.com", lookup, 1_000);

      // 2 回目も同じ答えが返ること。回数だけを見ると、
      // 「写しはしたが違う値を返す」実装を見逃す。
      expect([first, second]).toEqual(["my-blog", "my-blog"]);
      expect(lookup).toHaveBeenCalledTimes(1);
    });

    it("見つからなかったことも写す（未使用の環境で毎回引かない）", async () => {
      const lookup = vi.fn(async () => null);

      const first = await resolveCustomHostSlug("unknown.example.com", lookup, 0);
      const second = await resolveCustomHostSlug("unknown.example.com", lookup, 1_000);

      expect([first, second]).toEqual([null, null]);
      expect(lookup).toHaveBeenCalledTimes(1);
    });

    it("寿命を過ぎたら引き直す（取り下げがここで効く）", async () => {
      const lookup = vi
        .fn<(hostname: string) => Promise<string | null>>()
        .mockResolvedValueOnce("my-blog")
        .mockResolvedValueOnce(null);

      // 60 秒ちょうどでは切れず、超えたところで切れる。
      const atStart = await resolveCustomHostSlug("blog.example.com", lookup, 0);
      const justBefore = await resolveCustomHostSlug("blog.example.com", lookup, 59_999);
      const justAfter = await resolveCustomHostSlug("blog.example.com", lookup, 60_001);

      expect([atStart, justBefore, justAfter]).toEqual(["my-blog", "my-blog", null]);
      expect(lookup).toHaveBeenCalledTimes(2);
    });

    it("照会が投げたときは写さない（一瞬の障害を寿命ぶん固定しない）", async () => {
      const lookup = vi
        .fn<(hostname: string) => Promise<string | null>>()
        .mockRejectedValueOnce(new Error("D1 down"))
        .mockResolvedValueOnce("my-blog");

      const whileDown = await resolveCustomHostSlug("blog.example.com", lookup, 0);
      const afterRecovery = await resolveCustomHostSlug("blog.example.com", lookup, 1);

      // 直後に引き直せていること。写していたら 1 ミリ秒後も null のまま返る。
      expect([whileDown, afterRecovery]).toEqual([null, "my-blog"]);
      expect(lookup).toHaveBeenCalledTimes(2);
    });

    it("知らないホスト名を大量に投げられても写しが際限なく太らない", async () => {
      const lookup = vi.fn(async () => null);

      // 上限 512 を超えて詰める。溢れた分は古いものから捨てられるので、
      // 最初のホストは写しから消えており、引き直しになる。
      for (let i = 0; i < 600; i += 1) {
        await resolveCustomHostSlug(`h${i}.example.com`, lookup, 0);
      }
      const callsAfterFill = lookup.mock.calls.length;
      await resolveCustomHostSlug("h0.example.com", lookup, 0);

      expect(callsAfterFill).toBe(600);
      expect(lookup).toHaveBeenCalledTimes(601);
    });

    it("ホスト名にならない値では照会しない", async () => {
      const lookup = vi.fn(async () => "my-blog");

      expect(await resolveCustomHostSlug("not a host/path", lookup, 0)).toBeNull();

      expect(lookup).not.toHaveBeenCalled();
    });

    it("ポート違いは同じ住所として1回だけ引く", async () => {
      // 渡された値そのものを見たいので、引数の型を持つ形で作る
      // （`vi.fn(async () => ...)` だと引数が空になり `calls` を辿れない）。
      const lookup = vi.fn<(hostname: string) => Promise<string | null>>(async () => "my-blog");

      const bare = await resolveCustomHostSlug("blog.example.com", lookup, 0);
      const withPort = await resolveCustomHostSlug("blog.example.com:8080", lookup, 0);

      expect([bare, withPort]).toEqual(["my-blog", "my-blog"]);
      // 照会に渡ったのはポートを落とした形であること。
      expect(lookup.mock.calls.map(([h]) => h)).toEqual(["blog.example.com"]);
    });
  });

  describe("逆向き（ブログ → 正本の住所）", () => {
    it("同じブログの2回目は照会しない", async () => {
      const lookup = vi.fn(async () => "blog.example.jp");

      const first = await resolveCanonicalHostForSite("gadget", lookup, 0);
      const second = await resolveCanonicalHostForSite("gadget", lookup, 1_000);

      expect([first, second]).toEqual(["blog.example.jp", "blog.example.jp"]);
      expect(lookup).toHaveBeenCalledTimes(1);
    });

    it("寿命を過ぎたら引き直す（canonical を降ろすとここで効く）", async () => {
      const lookup = vi
        .fn<(slug: string) => Promise<string | null>>()
        .mockResolvedValueOnce("blog.example.jp")
        .mockResolvedValueOnce(null);

      expect(await resolveCanonicalHostForSite("gadget", lookup, 0)).toBe("blog.example.jp");
      expect(await resolveCanonicalHostForSite("gadget", lookup, 60_001)).toBeNull();
    });

    it("住所の写しとブログの写しは混ざらない", async () => {
      // 「`blog.example.jp` という URL 名のブログ」が住所表を汚せないこと。
      const hostLookup = vi.fn(async () => "gadget");
      const canonicalLookup = vi.fn(async () => "blog.example.jp");

      const asHost = await resolveCustomHostSlug("blog.example.jp", hostLookup, 0);
      const asSite = await resolveCanonicalHostForSite("blog.example.jp", canonicalLookup, 0);

      // 住所引きは「gadget」、正本引きは「blog.example.jp」。同じ鍵でも別の答え。
      expect([asHost, asSite]).toEqual(["gadget", "blog.example.jp"]);
      expect(canonicalLookup).toHaveBeenCalledTimes(1);
    });

    it("URL 名が空なら照会しない", async () => {
      const lookup = vi.fn(async () => "blog.example.jp");

      expect(await resolveCanonicalHostForSite("", lookup, 0)).toBeNull();

      expect(lookup).not.toHaveBeenCalled();
    });
  });
});
