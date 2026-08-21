/** @tier 1 @req REQ-E13 @types state-transition, fault-injection, ssrf */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RedirectResolution } from "@/domain/monetization";
import {
  type AffiliateLinkId,
  type WorkspaceId,
  ok,
  taggedString,
} from "@/domain/shared";

/**
 * 転送の入口 `/go/<合言葉>`（仕様 03 §1.2）。
 *
 * --- なぜ入口そのものを叩くのか ---
 * 「転送する / 知らない / もう無い」の判断はドメイン側で固定してある
 * （tests/domain/redirect-resolution.test.ts）。ここに残っているのは
 * **判断を HTTP の番号と見出しに読み替える部分**と、
 * **記録の失敗で転送を止めないこと**の 2 つで、どちらも入口にしか無い。
 *
 * 特に後者は、壊れても画面上は何も起きない（読者は普通に販売ページへ着く）。
 * 逆向きに壊れたとき——記録が失敗すると読者が飛べなくなる——も、
 * 保存先が落ちた日にしか現れない。どちらの向きもここで固定する。
 *
 * 規範: docs/spec/03-分析・解析基盤仕様.md §1.2
 */

const WS = taggedString<"WorkspaceId">("ws_test") as WorkspaceId;
const LINK = taggedString<"AffiliateLinkId">("al_1") as AffiliateLinkId;
const DESTINATION = "https://example.com/click?aid=1&pid=2";

function resolution(over: Partial<RedirectResolution> = {}): RedirectResolution {
  return {
    code: "abc123",
    workspaceId: WS,
    affiliateLinkId: LINK,
    destinationUrl: DESTINATION,
    siteSlug: "sample",
    articlePath: "/s/sample/reviews/a",
    placement: "順位表",
    productId: "prd_a",
    state: "active",
    expiresAt: null,
    ...over,
  };
}

type ResolveResult = Awaited<ReturnType<() => Promise<unknown>>>;

/** 入口が読む 2 つのつなぎ目。1 件ごとに差し替える。 */
let resolveImpl: (code: string) => Promise<ResolveResult>;
let recordImpl: (input: unknown) => Promise<ResolveResult>;
const recorded: unknown[] = [];

vi.mock("server-only", () => ({}));
vi.mock("@/infrastructure/persistence/d1/connection", () => ({
  tryGetDb: async () => null,
}));
vi.mock("@/infrastructure/composition", () => ({
  createDeps: () => ({
    redirectResolver: { resolve: (code: string) => resolveImpl(code) },
    clickTracking: {
      recordClick: (input: unknown) => {
        recorded.push(input);
        return recordImpl(input);
      },
    },
  }),
}));

const { GET } = await import("@/app/go/[code]/route");
const { logger } = await import("@/infrastructure/platform/logger");

function call(code: string): Promise<Response> {
  return GET(new Request(`https://hub.test/go/${code}`), {
    params: Promise.resolve({ code }),
  });
}

const storageFailed = {
  ok: false as const,
  error: { code: "storage_failure", message: "保存先を読めませんでした。" },
};

beforeEach(() => {
  recorded.length = 0;
  resolveImpl = async () => ok(resolution());
  recordImpl = async () => ok(true as const);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("転送できるとき", () => {
  it("302 で、保存された URL へそのまま送る", async () => {
    const res = await call("abc123");
    expect(res.status).toBe(302);
    // URL に何かを足すと ASP の規約違反になり、成果そのものが計上されない。
    expect(res.headers.get("location")).toBe(DESTINATION);
  });

  it("押されたことを、解決した内容ごと記録へ渡す", async () => {
    await call("abc123");
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      resolution: { affiliateLinkId: LINK, placement: "順位表", siteSlug: "sample" },
    });
  });

  it("途中に覚えさせない", async () => {
    // 中継に覚えられると、止めたリンクが生き続け、クリックも数えられなくなる。
    const res = await call("abc123");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("転送できないとき", () => {
  it("知らない合言葉は 404", async () => {
    resolveImpl = async () => ok(null);
    const res = await call("zzz999");
    expect(res.status).toBe(404);
  });

  it("合言葉の形が違うときは、保存先を引かずに 404", async () => {
    let asked = 0;
    resolveImpl = async () => {
      asked += 1;
      return ok(null);
    };
    const res = await call("../../etc/passwd");
    expect(res.status).toBe(404);
    // 形の検査を通す前に保存先を引くと、細工した文字列がそのまま問い合わせに乗る。
    expect(asked).toBe(0);
  });

  it("止めたリンクは 410 で、理由を読める言葉で返す", async () => {
    resolveImpl = async () => ok(resolution({ state: "disabled" }));
    const res = await call("abc123");
    expect(res.status).toBe(410);
    expect(await res.text()).toContain("停止");
  });

  it("期限切れは 410", async () => {
    resolveImpl = async () => ok(resolution({ state: "expired" }));
    expect((await call("abc123")).status).toBe(410);
  });

  it("読み取りが例外で落ちても、読める言葉の 503 を返す", async () => {
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    resolveImpl = async () => {
      throw new Error("boom");
    };
    const res = await call("abc123");
    expect(res.status).toBe(503);
    expect(await res.text()).toContain("もう一度");
  });

  it("保存先を読めなかったときは 503（404 にしない）", async () => {
    // 404 は「そんなリンクは無い」。読者はリンクが消されたと受け取る。
    // ここは「いま確認できない」であって、意味が違う。
    resolveImpl = async () => storageFailed;
    const res = await call("abc123");
    expect(res.status).toBe(503);
    expect(await res.text()).toContain("もう一度");
  });
});

describe("記録の失敗は、読者を止めない（劣化契約）", () => {
  it("記録が失敗しても 302 で転送する", async () => {
    recordImpl = async () => storageFailed;
    const res = await call("abc123");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(DESTINATION);
  });

  it("数えられなかったことは記録に残す（黙って捨てない）", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    recordImpl = async () => storageFailed;
    await call("abc123");
    expect(warn).toHaveBeenCalledWith(
      "measurement_delivery_failed",
      expect.objectContaining({ code: "abc123" }),
    );
  });

  it("記録が例外で落ちても、読者には転送が返る", async () => {
    // つなぎ目が Result を返さずに投げる作りに変わっても、読者は買いに行ける。
    recordImpl = async () => {
      throw new Error("boom");
    };
    await expect(call("abc123")).resolves.toMatchObject({ status: 302 });
  });
});
