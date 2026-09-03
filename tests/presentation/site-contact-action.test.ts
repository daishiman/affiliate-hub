/** @tier 1 @req REQ-B18, REQ-SEC02 @types equivalence, boundary, fault-injection */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { domainError, err, ok } from "@/domain/shared";

/**
 * 読者からの問い合わせの送信。
 *
 * ここで守るのは **どの IP を信じるか** の一点に尽きる。
 * `x-forwarded-for` は名乗るだけで書き換えられるので、回数制限の鍵に使うと
 * 制限を無限に回避できる。信じるのは Cloudflare が付ける `cf-connecting-ip` だけ。
 * 取れないときは undefined を渡し、断るかどうかはユースケース側に委ねる。
 */

const headerStore = new Map<string, string>();
const headers = vi.fn(async () => ({
  get: (name: string) => headerStore.get(name) ?? null,
}));
vi.mock("next/headers", () => ({ headers }));

const executeSubmit = vi.fn();
const READER = { kind: "reader" } as const;
vi.mock("@/presentation/composition", () => ({
  readerActor: () => READER,
  readerUseCases: async () => ({ submitContact: { execute: executeSubmit } }),
}));

const { submitContactAction } = await import("@/presentation/site/contact-action");

const IDLE = { status: "idle", message: "" } as const;

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

beforeEach(() => {
  headerStore.clear();
  headers.mockClear();
  executeSubmit.mockReset();
  executeSubmit.mockResolvedValue(ok({ receiptId: "r-1" }));
});

describe("submitContactAction", () => {
  it("受け付けたら、受付番号まで含めて知らせる", async () => {
    const state = await submitContactAction(
      IDLE,
      form({ siteSlug: "blog", body: "こわれています", replyTo: "me@example.com" }),
    );

    expect(executeSubmit.mock.calls[0][0]).toBe(READER);
    expect(state).toEqual({ status: "done", message: "受け付けました（受付番号 r-1）。" });
  });

  it("空欄の返信先と合言葉は、空文字ではなく undefined で渡す", async () => {
    await submitContactAction(IDLE, form({ siteSlug: "blog", body: "本文" }));

    const input = executeSubmit.mock.calls[0][1];
    expect(input.replyTo).toBeUndefined();
    expect(input.humanCheckToken).toBeUndefined();
  });

  it("Turnstile の欄が来ていれば、それを合言葉として使う", async () => {
    await submitContactAction(
      IDLE,
      form({ siteSlug: "blog", body: "本文", "cf-turnstile-response": "t-1" }),
    );

    expect(executeSubmit.mock.calls[0][1].humanCheckToken).toBe("t-1");
  });

  it("Turnstile の欄が無いときだけ、humanCheckToken を代わりに読む", async () => {
    await submitContactAction(IDLE, form({ siteSlug: "blog", body: "本文", humanCheckToken: "t-2" }));

    expect(executeSubmit.mock.calls[0][1].humanCheckToken).toBe("t-2");
  });

  it("Cloudflare が付けた IP だけを、回数制限の鍵と発信元に使う", async () => {
    headerStore.set("cf-connecting-ip", " 203.0.113.5 ");
    await submitContactAction(IDLE, form({ siteSlug: "blog", body: "本文" }));

    const input = executeSubmit.mock.calls[0][1];
    expect(input.rateLimitIdentity).toEqual({ scope: "ip", value: "203.0.113.5" });
    expect(input.remoteIp).toBe("203.0.113.5");
  });

  it("x-forwarded-for は、名乗れるだけなので使わない", async () => {
    headerStore.set("x-forwarded-for", "198.51.100.9");
    await submitContactAction(IDLE, form({ siteSlug: "blog", body: "本文" }));

    const input = executeSubmit.mock.calls[0][1];
    expect(input.rateLimitIdentity).toBeUndefined();
    expect(input.remoteIp).toBeUndefined();
  });

  it("cf-connecting-ip が空白だけなら、無いものとして扱う", async () => {
    headerStore.set("cf-connecting-ip", "   ");
    await submitContactAction(IDLE, form({ siteSlug: "blog", body: "本文" }));

    expect(executeSubmit.mock.calls[0][1].rateLimitIdentity).toBeUndefined();
  });

  it("ヘッダが取れない実行でも落とさず、判断はユースケースへ渡す", async () => {
    headers.mockImplementationOnce(async () => {
      throw new Error("request metadata がありません");
    });
    const state = await submitContactAction(IDLE, form({ siteSlug: "blog", body: "本文" }));

    expect(executeSubmit.mock.calls[0][1].remoteIp).toBeUndefined();
    expect(state.status).toBe("done");
  });

  it("断られたら、断りの文と原因の欄を返す", async () => {
    executeSubmit.mockResolvedValue(
      err(domainError("CONFLICT", "本文が空です。", { field: "body" })),
    );
    const state = await submitContactAction(IDLE, form({ siteSlug: "blog" }));

    expect(state.status).toBe("failed");
    expect(state.field).toBe("body");
    expect(state.message).toContain("本文が空です。");
  });
});
