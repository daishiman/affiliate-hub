/** @tier 1 @req REQ-B18 */
import { describe, expect, it } from "vitest";
import { createContactRateLimitKeyDeriver } from "@/infrastructure/platform/contact-rate-key";

describe("問い合わせの秘密鍵付き回数制限キー", () => {
  it("生値を含まない安定した64桁hexへ変換する", async () => {
    const deriver = createContactRateLimitKeyDeriver("a".repeat(32));
    const first = await deriver.derive("ip", "203.0.113.10");
    const again = await deriver.derive("ip", "203.0.113.10");

    expect(first.ok && first.value).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toEqual(again);
    expect(first.ok && first.value).not.toContain("203.0.113.10");
  });

  it("同じ値でも入口scopeが違えば共有しない", async () => {
    const deriver = createContactRateLimitKeyDeriver("a".repeat(32));
    expect(await deriver.derive("ip", "same")).not.toEqual(
      await deriver.derive("actor", "same"),
    );
  });

  it("別の秘密では同じ送信元を横断照合できない", async () => {
    const first = createContactRateLimitKeyDeriver("a".repeat(32));
    const second = createContactRateLimitKeyDeriver("b".repeat(32));
    expect(await first.derive("ip", "203.0.113.10")).not.toEqual(
      await second.derive("ip", "203.0.113.10"),
    );
  });

  it("秘密が足りなければ生値のhashへフォールバックせずfail-closedする", async () => {
    const got = await createContactRateLimitKeyDeriver("").derive("ip", "203.0.113.10");
    expect(got.ok).toBe(false);
  });
});
