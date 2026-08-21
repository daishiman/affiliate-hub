/** @tier 1 @req REQ-B18, REQ-API01 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContactMessage } from "@/application/ports/reader-interaction";
import { domainError, err, ok } from "@/domain/shared";

/**
 * 問い合わせフォームの受け口（画面から呼ばれる関数）。
 *
 * --- ここで固定したいこと ---
 * 1. **画面用にもう 1 つ実装を作っていないこと。** 呼び先は REST / WebMCP と同じユースケース。
 * 2. **書かれていない欄を「空文字」として渡さないこと。**
 *    未記入の返信先が `""` のまま届くと、保存側は「空のメールアドレスが書かれた」と受け取る。
 *    書かなかったことと、空で書いたことは別物として扱う。
 * 3. **失敗したとき、次に何をすればよいかを出すこと。** 直し方のない文言だけを返さない。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-3（画面の受け口）
 */

const seen = vi.hoisted(() => ({ input: null as ContactMessage | null, actorRoles: -1 }));
const answer = vi.hoisted(() => ({
  value: null as unknown,
}));

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    readerUseCases: () => ({
      submitContact: {
        async execute(actor: { roles: readonly unknown[] }, input: ContactMessage) {
          seen.input = input;
          seen.actorRoles = actor.roles.length;
          return answer.value;
        },
      },
    }),
  };
});

const { submitContactAction } = await import("@/presentation/site/contact-action");

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

const IDLE = { status: "idle" as const, message: "" };

beforeEach(() => {
  seen.input = null;
  seen.actorRoles = -1;
  answer.value = ok({ receiptId: "rc_0001" });
});

describe("送れたとき", () => {
  it("受付番号を添えて、受け付けたと返す", async () => {
    const state = await submitContactAction(IDLE, form({ siteSlug: "lens-start", body: "本文" }));
    expect(state.status).toBe("sent");
    // 番号が出ないと、あとで問い合わせ直すときに指せるものが無い。
    expect(state.message).toContain("rc_0001");
  });

  it("入力された値を、そのままユースケースへ渡す", async () => {
    await submitContactAction(
      IDLE,
      form({
        siteSlug: "lens-start",
        body: "記事の型番が古いようです。",
        replyTo: "reader@example.com",
        humanCheckToken: "tok_abc",
      }),
    );
    expect(seen.input).toEqual({
      siteSlug: "lens-start",
      body: "記事の型番が古いようです。",
      replyTo: "reader@example.com",
      humanCheckToken: "tok_abc",
    });
  });

  it("読者は権限を持たない人として扱う（ログインを求めない）", async () => {
    await submitContactAction(IDLE, form({ siteSlug: "lens-start", body: "本文" }));
    expect(seen.actorRoles).toBe(0);
  });
});

describe("書かれなかった欄", () => {
  it("返信先が未記入なら、空文字ではなく「無い」として渡す", async () => {
    await submitContactAction(IDLE, form({ siteSlug: "lens-start", body: "本文", replyTo: "" }));
    expect(seen.input?.replyTo).toBeUndefined();
  });

  it("自動送信よけの確認結果が無いときも、空文字では渡さない", async () => {
    await submitContactAction(
      IDLE,
      form({ siteSlug: "lens-start", body: "本文", humanCheckToken: "" }),
    );
    expect(seen.input?.humanCheckToken).toBeUndefined();
  });

  it("欄そのものが送られてこなくても落ちない", async () => {
    // 画面の作りが変わって欄が消えても、例外ではなく通常の失敗として扱えること。
    const state = await submitContactAction(IDLE, new FormData());
    expect(state.status).toBe("sent");
    expect(seen.input).toEqual({
      siteSlug: "",
      body: "",
      replyTo: undefined,
      humanCheckToken: undefined,
    });
  });
});

describe("送れなかったとき", () => {
  /*
   * 次にすることだけを出すと、**何が起きたかが画面から消える**。
   * ここでは「送信先が未設定」が消えると、送った人は本文を書き直して
   * 何度も押すことになる（原因は本文ではないので、何度押しても同じ）。
   * 両方を出す判断は `src/presentation/refusal-text.ts` に 1 つだけ置いてある。
   */
  it("起きたことと、次にすることの両方を出す", async () => {
    answer.value = err(
      domainError("NOT_IMPLEMENTED", "送信先がまだ設定されていません。", {
        suggestedAction: "運営者へ直接ご連絡ください。",
      }),
    );
    const state = await submitContactAction(IDLE, form({ siteSlug: "lens-start", body: "本文" }));
    expect(state.status).toBe("failed");
    expect(state.message).toContain("送信先がまだ設定されていません。");
    expect(state.message).toContain("運営者へ直接ご連絡ください。");
  });

  it("次の一歩が無いときは、起きたことをそのまま出す（無言にしない）", async () => {
    answer.value = err(domainError("UPSTREAM_UNAVAILABLE", "いま受け付けられません。"));
    const state = await submitContactAction(IDLE, form({ siteSlug: "lens-start", body: "本文" }));
    expect(state.status).toBe("failed");
    expect(state.message).toBe("いま受け付けられません。");
  });

  it("どの欄が原因かが分かっているときは、欄の名前も返す", async () => {
    answer.value = err(
      domainError("VALIDATION_FAILED", "内容が入力されていません。", {
        field: "body",
        suggestedAction: "お問い合わせの内容をご記入ください。",
      }),
    );
    const state = await submitContactAction(IDLE, form({ siteSlug: "lens-start", body: "" }));
    expect(state.field).toBe("body");
  });

  it("原因の欄が分からないときは、欄の名前を作らない", async () => {
    answer.value = err(domainError("UPSTREAM_UNAVAILABLE", "いま受け付けられません。"));
    const state = await submitContactAction(IDLE, form({ siteSlug: "lens-start", body: "本文" }));
    // 当てずっぽうの欄に赤い印が付くと、読者は関係ない欄を直そうとする。
    expect(state.field).toBeUndefined();
  });
});
