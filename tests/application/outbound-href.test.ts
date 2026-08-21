/** @tier 1 @req REQ-E13 @types equivalence */
import { describe, expect, it } from "vitest";
import { outboundHref } from "@/application/read-models/published-article";

/**
 * 読者を送り出す先の決め方。
 *
 * ここが間違うと、**画面は普通に動いたままクリックだけが数えられなくなる**。
 * 合言葉があるのに ASP の URL を直に出せば計測が抜け、
 * 合言葉が無いのに入口へ送れば読者が 404 に着く。どちらも見た目では気づけない。
 */
describe("送り出す先", () => {
  it("合言葉があるときは、転送の入口へ送る", () => {
    expect(outboundHref("abc123", "https://example.com/click?aid=1")).toBe("/go/abc123");
  });

  it("合言葉が無いときは、ASP の URL をそのまま出す", () => {
    // 計測の準備ができていないだけで、読者の買う導線を消さない。
    const url = "https://example.com/click?aid=1&pid=2";
    expect(outboundHref(undefined, url)).toBe(url);
  });

  it("URL に何も足さない", () => {
    // ASP の URL を書き換えると規約違反になり、成果そのものが計上されない。
    const url = "https://example.com/click?aid=1&pid=2#ref";
    expect(outboundHref(undefined, url)).toBe(url);
  });

  it("どちらも無いときは、導線を作らない", () => {
    // 空文字や `#` を返すと、押せるのにどこへも行かないリンクができる。
    expect(outboundHref(undefined, undefined)).toBeUndefined();
  });
});
