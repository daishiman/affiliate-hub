/**
 * @tier 1
 * @req REQ-SEO04
 * @types equivalence, boundary
 */
import { describe, expect, it } from "vitest";
import { buildIndexNowSubmission } from "@/domain/seo/indexnow";

/**
 * IndexNow 通知本文の組み立て。
 *
 * ここが間違うと、**通知は届くのに鍵の検証で全部捨てられる**
 * （keyLocation の場所がずれると所有の証明が成立しない）。
 */
describe("IndexNow の通知本文", () => {
  it("origin からホスト名を導き、鍵の置き場所を固定の形で組む", () => {
    const submission = buildIndexNowSubmission("https://example.com", "abc123", [
      "https://example.com/s/blog/best/laptops",
    ]);
    expect(submission).toEqual({
      host: "example.com",
      key: "abc123",
      keyLocation: "https://example.com/indexnow.txt",
      urlList: ["https://example.com/s/blog/best/laptops"],
    });
  });

  it("URL が 0 件なら null（空の通知を作らせない）", () => {
    expect(buildIndexNowSubmission("https://example.com", "abc123", [])).toBeNull();
  });

  it("origin が URL として読めなければ null（壊れた設定で半端な本文を作らない)", () => {
    expect(buildIndexNowSubmission("example.com", "abc123", ["https://example.com/"])).toBeNull();
  });

  it("ポート付きの origin ではホストにポートが残る", () => {
    const submission = buildIndexNowSubmission("http://localhost:3000", "k", ["http://localhost:3000/x"]);
    expect(submission?.host).toBe("localhost:3000");
  });

  it.each(["ftp://example.com", "https://example.com/path", "https://user@example.com"])(
    "http/httpsの純粋なorigin以外は通知本文にしない: %s",
    (origin) => {
      expect(buildIndexNowSubmission(origin, "k", ["https://example.com/x"])).toBeNull();
    },
  );

  it("originと異なるhostのURLを同じ通知へ混ぜない", () => {
    expect(
      buildIndexNowSubmission("https://example.com", "k", [
        "https://example.com/owned",
        "https://attacker.example/not-owned",
      ]),
    ).toBeNull();
  });
});
