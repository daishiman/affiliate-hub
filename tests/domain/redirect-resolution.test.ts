/** @tier 1 @req REQ-E13 @types state-transition, equivalence, boundary */
import { describe, expect, it } from "vitest";
import {
  type RedirectResolution,
  isSafeDestination,
  resolveRedirect,
  trackingPathForCode,
} from "@/domain/monetization";
import {
  type AffiliateLinkId,
  type WorkspaceId,
  taggedString,
} from "@/domain/shared";

/**
 * 転送の入口が何を返すかの判断（仕様 03 §1.2）。
 *
 * --- なぜ HTTP の番号をここで持たないのか ---
 * ここが決めるのは「転送する / 知らない / もう無い」の 3 つだけで、
 * 302・404・410 への読み替えは入口（`src/app/go/[code]/route.ts`）が 1 箇所で行う。
 * 番号をドメインに持ち込むと、同じ判断を別の入口（管理画面の確認など）から
 * 使えなくなる。
 *
 * --- ここで守っているもの ---
 *   1. 転送先を**組み立てない**。保存された値をそのまま返す
 *   2. 「知らない合言葉」と「止めた／期限切れ」を混ぜない
 *   3. https 以外は転送しない（保存が壊れたときに任意の場所へ飛ばさない）
 */

const WS = taggedString<"WorkspaceId">("ws_test") as WorkspaceId;
const LINK = taggedString<"AffiliateLinkId">("al_1") as AffiliateLinkId;
const NOW = new Date("2026-08-18T00:00:00Z");

function resolution(over: Partial<RedirectResolution> = {}): RedirectResolution {
  return {
    code: "abc123",
    workspaceId: WS,
    affiliateLinkId: LINK,
    destinationUrl: "https://example.com/click?aid=1&pid=2",
    siteSlug: "sample",
    articlePath: "/s/sample/reviews/a",
    placement: "順位表",
    productId: "prd_a",
    state: "active",
    expiresAt: null,
    ...over,
  };
}

describe("転送の判断", () => {
  it("生きているリンクは、保存された URL を 1 文字も変えずに返す", () => {
    const url = "https://example.com/click?aid=1&pid=2&x=%E3%81%82";
    const outcome = resolveRedirect(resolution({ destinationUrl: url }), NOW);
    expect(outcome).toEqual({ kind: "redirect", url });
  });

  it("知らない合言葉は「知らない」として返す", () => {
    // ここを「もう無い」にすると、打ち間違いが「消したリンク」と同じ見え方になる。
    expect(resolveRedirect(null, NOW)).toEqual({ kind: "unknown" });
  });

  it("止めたリンクは、理由つきで「もう無い」を返す", () => {
    const outcome = resolveRedirect(resolution({ state: "disabled" }), NOW);
    expect(outcome.kind).toBe("gone");
    // 読者が読んで分かる言葉であること。コードや記号だけにしない。
    if (outcome.kind === "gone") expect(outcome.reason).toContain("停止");
  });

  it("期限切れの印が付いたリンクは「もう無い」を返す", () => {
    const outcome = resolveRedirect(resolution({ state: "expired" }), NOW);
    expect(outcome.kind).toBe("gone");
    if (outcome.kind === "gone") expect(outcome.reason).toContain("有効期限");
  });

  it("印が active でも、期限の日時を過ぎていれば「もう無い」", () => {
    // 印の更新は後回しになりがち。日時のほうを最終的な根拠にする。
    const outcome = resolveRedirect(
      resolution({ expiresAt: new Date("2026-08-17T23:59:59Z") }),
      NOW,
    );
    expect(outcome.kind).toBe("gone");
  });

  it("期限の日時ちょうどは、もう転送しない", () => {
    // 境界。「以下」で切ることで、期限の瞬間に 2 通りの答えが出ない。
    const outcome = resolveRedirect(resolution({ expiresAt: NOW }), NOW);
    expect(outcome.kind).toBe("gone");
  });

  it("期限が先ならそのまま転送する", () => {
    const outcome = resolveRedirect(
      resolution({ expiresAt: new Date("2026-08-18T00:00:01Z") }),
      NOW,
    );
    expect(outcome.kind).toBe("redirect");
  });
});

describe("転送先の安全確認", () => {
  it.each([
    ["http://example.com/click", false],
    ["javascript:alert(1)", false],
    ["/admin", false],
    ["//example.com", false],
    ["https://example.com/click", true],
  ])("%s は %s", (url, expected) => {
    expect(isSafeDestination(url)).toBe(expected);
  });

  it("https 以外が保存されていたら、転送せず「もう無い」を返す", () => {
    // 保存が壊れた・取り込みがすり抜けた場合の最後の砦。
    // ここで通すと、合言葉を細工して任意の場所へ飛ばせる入口になる。
    const outcome = resolveRedirect(
      resolution({ destinationUrl: "javascript:alert(1)" }),
      NOW,
    );
    expect(outcome.kind).toBe("gone");
    expect(outcome).not.toMatchObject({ kind: "redirect" });
  });
});

describe("入口の道の形", () => {
  it("合言葉から作る（画面側で組み立てない）", () => {
    expect(trackingPathForCode("abc123")).toBe("/go/abc123");
  });
});
