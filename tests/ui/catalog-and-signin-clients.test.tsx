/** @tier 2 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackSamples } from "@/app/admin/ui-catalog/feedback-samples";
import { HumanOnlyFormSample, InputSamples } from "@/app/admin/ui-catalog/input-samples";
import { GoogleSignInButton } from "@/app/signin/google-signin-button";
import { UI_COPY } from "@/presentation/ui";

/**
 * 画面の隣に置いてある「手元で動く側」の部品。
 *
 * --- ここで守りたいこと ---
 * 1. **見本帳は送らない。** 見本を開いただけで本物の一覧に空の要望が並ぶと、
 *    本物の要望が埋もれる。
 * 2. **入力欄は打ち込みに反応する。** 静止画のような見本だと、
 *    間違いの伝え方も、取り込んだ値の戻し方も確かめられない。
 * 3. **ログインの失敗理由を、入ろうとした人へ細かく出さない。**
 *    どの設定が抜けているかは運用する人が見るもので、
 *    入口に出すと設定の欠けが外から読める。
 * 4. **秘密の値はこの部品を通らない。** 送る中身に鍵が混ざっていないことを見る。
 *
 * @req REQ-UX01
 * @types screen-states, decision-table
 */

afterEach(cleanup);

describe("入力欄の見本", () => {
  it("打ち込みが短いあいだだけ、その場で直し方を伝える", () => {
    render(<InputSamples />);
    const name = screen.getByLabelText(/商品名/);

    fireEvent.change(name, { target: { value: "あ" } });
    expect(screen.getByText("3文字以上で入力してください")).toBeTruthy();

    fireEvent.change(name, { target: { value: "あいう" } });
    expect(screen.queryByText("3文字以上で入力してください")).toBeNull();

    // 空は「まだ書いていない」であって間違いではない。ここを間違い扱いすると、
    // 開いた直後の画面が赤くなる。
    fireEvent.change(name, { target: { value: "" } });
    expect(screen.queryByText("3文字以上で入力してください")).toBeNull();
  });

  it("取り込んだ値を手で直すと印が付き、元へ戻せる", () => {
    render(<InputSamples />);
    const price = screen.getByLabelText(/実売価格/) as HTMLInputElement;
    expect(price.value).toBe("129800");

    fireEvent.change(price, { target: { value: "119800" } });
    expect((screen.getByLabelText(/実売価格/) as HTMLInputElement).value).toBe("119800");

    // 「直した」ことが分かる印が出ている。印が出ないと、取り込んだ値と
    // 手で入れた値が記録の上で同じ形になる。
    const reset = screen.getByRole("button", { name: /戻/ });
    fireEvent.click(reset);
    expect((screen.getByLabelText(/実売価格/) as HTMLInputElement).value).toBe("129800");
  });

  it("選べないものには理由があり、選択肢としては残る", () => {
    render(<InputSamples />);
    const disabled = screen.getByRole("option", {
      name: /プリンター/,
    }) as HTMLOptionElement;
    // 消してしまうと「なぜ無いのか」が画面から分からなくなる。
    expect(disabled.disabled).toBe(true);
  });

  it("送っても画面は遷移しない（見本帳は記録しない）", () => {
    const { container } = render(<InputSamples />);
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    // 既定の送信が止まっている。止めないと、見本帳を触っただけで通信が起きる。
    expect(fireEvent.submit(form as HTMLFormElement)).toBe(false);
  });
});

describe("人だけが使う欄の見本", () => {
  it("道具として名乗らない（名乗らないことがこの部品の仕事）", () => {
    const { container } = render(<HumanOnlyFormSample />);
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    // 理由は DOM へ出さない。押す人ではなく、次にこのコードを触る人への文だから。
    // 出るのは「名乗っていないこと」だけで、そこが AI から呼べない境界になる。
    expect(form?.getAttribute("toolname")).toBeNull();
  });

  it("合言葉は伏せ字で受け取り、打ち込みを覚えさせない", () => {
    render(<HumanOnlyFormSample />);
    const field = screen.getByLabelText(/合言葉/) as HTMLInputElement;
    expect(field.type).toBe("password");
    expect(field.autocomplete).toBe("off");

    fireEvent.change(field, { target: { value: "ひみつ" } });
    expect(field.value).toBe("ひみつ");
  });
});

describe("改善要望の見本", () => {
  it("印付けの土台を作れない環境では、その旨を伝えて止まる", () => {
    render(<FeedbackSamples />);
    // jsdom には絵を描く仕組みが無い。取れないときに黙って進むと、
    // 印を付けたつもりの空白が送られる。
    fireEvent.click(screen.getByRole("button", { name: /印付けを試す/ }));
    expect(screen.getByText(UI_COPY.feedback.captureUnavailable)).toBeTruthy();
  });
});

describe("Google でログインする入口", () => {
  const assign = vi.fn();

  beforeEach(() => {
    assign.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign, href: "https://example.test/signin" },
    });
  });

  it("行き先が返れば、その行き先へ移す", async () => {
    const fetchMock = vi.fn<
      (url: string, init?: { body?: string }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>
    >(async () => ({
      ok: true,
      json: async () => ({ url: "https://accounts.example.test/o/oauth2" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<GoogleSignInButton callbackUrl="/admin" />);
    fireEvent.click(screen.getByRole("button", { name: /Google/ }));
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("https://accounts.example.test/o/oauth2"));

    // 送る中身に鍵が混ざっていない。画面の中に鍵を置くと誰でも読める。
    const body = String(fetchMock.mock.calls[0]?.[1]?.body ?? "");
    expect(body).toContain('"provider":"google"');
    expect(body).toContain("/admin");
    expect(body.toLowerCase()).not.toContain("secret");

    vi.unstubAllGlobals();
  });

  it("断られたら、どの設定が抜けているかは出さずに、もう一度を促す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ message: "GOOGLE_CLIENT_SECRET is not configured" }),
      })),
    );

    render(<GoogleSignInButton callbackUrl="/admin" />);
    fireEvent.click(screen.getByRole("button", { name: /Google/ }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent ?? "").toContain("もう一度");
    // 入ろうとした人に設定の欠けを教えない。
    expect(alert.textContent ?? "").not.toContain("GOOGLE_CLIENT_SECRET");
    expect(assign).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("行き先が入っていない返事も、断りとして扱う", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({}) })),
    );

    render(<GoogleSignInButton callbackUrl="/admin" />);
    fireEvent.click(screen.getByRole("button", { name: /Google/ }));

    expect((await screen.findByRole("alert")).textContent ?? "").toContain("もう一度");
    expect(assign).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("通信そのものができないときは、接続を確かめるよう促す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    render(<GoogleSignInButton callbackUrl="/admin" />);
    fireEvent.click(screen.getByRole("button", { name: /Google/ }));

    expect((await screen.findByRole("alert")).textContent ?? "").toContain("接続");
    expect(assign).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
