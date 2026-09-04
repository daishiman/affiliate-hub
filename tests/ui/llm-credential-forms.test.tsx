/** @tier 2 */
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 鍵を登録・確認・失効する操作部品。
 *
 * --- 押した後の見た目まで見る ---
 * 成功・失敗は**利用者が最も多く見る状態**でありながら、手で開かれる回数が
 * 最も少ない。押す前の姿だけを固定すると、「送ったのに何も出ない」画面が
 * 誰にも気づかれずに公開される。返り値だけを差し替え、囲いと表示は本物を通す。
 *
 * --- 送った後に入力欄が空になることを見る ---
 * 鍵が欄に残ると、開いたままの端末に鍵が出続ける。
 * 見た目の話ではなく、**画面に秘密を置き続けない**という決まりである。
 *
 * 押した先の判断は `tests/presentation/llm-credential-actions.test.ts` が
 * 本物の道で確かめている。ここで見るのは画面に何が出ているかだけ。
 *
 * @req REQ-SEC01
 * @types secrets
 */

let actionResult: unknown = { status: "idle", message: "" };
const sent: FormData[] = [];

vi.mock("@/presentation/admin/maintain/llm-credential-action", () => ({
  manageLlmCredentialAction: async (_prev: unknown, formData: FormData) => {
    sent.push(formData);
    return actionResult;
  },
}));

const { RegisterLlmKeyForm, RevokeLlmKeyForm, VerifyLlmKeyForm } = await import(
  "@/presentation/admin/maintain/llm-credential-form"
);

const MODELS = [
  { modelId: "m-1", label: "見本モデル" },
  { modelId: "m-2", label: "別の見本" },
];

afterEach(cleanup);
beforeEach(() => {
  actionResult = { status: "idle", message: "" };
  sent.length = 0;
});

/** 送信して、状態の更新が反映されるまで待つ。 */
async function submit(form: HTMLFormElement): Promise<void> {
  await act(async () => {
    fireEvent.submit(form);
  });
}

describe("鍵の登録欄", () => {
  it("何が起きるかを、押す前に書いてある", () => {
    render(
      <RegisterLlmKeyForm providerId="anthropic" label="見本" keyIssueUrl="https://e.invalid/k" />,
    );
    expect(screen.getByText(/包んで（暗号化して）保管します/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "提供元の画面" }).getAttribute("href")).toBe(
      "https://e.invalid/k",
    );
  });

  it("発行先が分からない提供元では、案内の行を出さない", () => {
    render(<RegisterLlmKeyForm providerId="anthropic" label="見本" keyIssueUrl="" />);
    expect(screen.queryByRole("link", { name: "提供元の画面" })).toBeNull();
  });

  it("入力した鍵は伏せ字で受け、送った後は欄に残らない", async () => {
    const { container } = render(
      <RegisterLlmKeyForm providerId="anthropic" label="見本" keyIssueUrl="" />,
    );
    const input = container.querySelector<HTMLInputElement>('input[name="apiKey"]');
    expect(input?.type).toBe("password");

    await act(async () => {
      fireEvent.change(input as HTMLInputElement, { target: { value: "sk-secret-value-12345" } });
    });
    expect(input?.value).toBe("sk-secret-value-12345");

    await submit(container.querySelector("form") as HTMLFormElement);
    expect(input?.value).toBe("");
    expect(sent[0]?.get("intent")).toBe("register");
    expect(sent[0]?.get("providerId")).toBe("anthropic");
  });

  it("成功したら、二度と表示されないことを伝える", async () => {
    actionResult = { status: "done", message: "登録しました。値は表示されません。" };
    const { container } = render(
      <RegisterLlmKeyForm providerId="anthropic" label="見本" keyIssueUrl="" />,
    );
    await submit(container.querySelector("form") as HTMLFormElement);
    expect(screen.getByText("登録しました。値は表示されません。")).toBeTruthy();
  });

  it("欄の誤りは、その欄の下に出す", async () => {
    actionResult = { status: "failed", message: "API キーが短すぎます。", field: "apiKey" };
    const { container } = render(
      <RegisterLlmKeyForm providerId="anthropic" label="見本" keyIssueUrl="" />,
    );
    await submit(container.querySelector("form") as HTMLFormElement);
    const shown = screen.getByRole("alert");
    expect(shown.textContent).toContain("短すぎます");
  });

  it("欄の分からない失敗は、まとめて 1 行で出す", async () => {
    actionResult = { status: "failed", message: "保存先につながっていません。" };
    const { container } = render(
      <RegisterLlmKeyForm providerId="anthropic" label="見本" keyIssueUrl="" />,
    );
    await submit(container.querySelector("form") as HTMLFormElement);
    expect(screen.getByText("保存先につながっていません。")).toBeTruthy();
  });
});

describe("疎通の確認", () => {
  it("料金が掛かることを、ボタンの近くに書いてある", () => {
    render(<VerifyLlmKeyForm providerId="anthropic" label="見本" models={MODELS} />);
    expect(screen.getByText(/料金が掛かり/)).toBeTruthy();
  });

  it("選んだモデルが送られる", async () => {
    const { container } = render(
      <VerifyLlmKeyForm providerId="anthropic" label="見本" models={MODELS} />,
    );
    const select = container.querySelector("select") as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(select, { target: { value: "m-2" } });
    });
    await submit(container.querySelector("form") as HTMLFormElement);
    expect(sent[0]?.get("intent")).toBe("verify");
    expect(sent[0]?.get("modelId")).toBe("m-2");
  });

  it("失敗したら、失敗として出す", async () => {
    actionResult = { status: "failed", message: "鍵が拒否されました。" };
    const { container } = render(
      <VerifyLlmKeyForm providerId="anthropic" label="見本" models={MODELS} />,
    );
    await submit(container.querySelector("form") as HTMLFormElement);
    expect(screen.getByText("鍵が拒否されました。")).toBeTruthy();
  });

  it("成功したら、使える状態だと出す", async () => {
    actionResult = { status: "done", message: "つながりました。" };
    const { container } = render(
      <VerifyLlmKeyForm providerId="anthropic" label="見本" models={MODELS} />,
    );
    await submit(container.querySelector("form") as HTMLFormElement);
    expect(screen.getByText("つながりました。")).toBeTruthy();
  });

  it("モデルが 1 つも無くても壊れない（選べないだけ）", () => {
    const { container } = render(
      <VerifyLlmKeyForm providerId="anthropic" label="見本" models={[]} />,
    );
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe("");
  });
});

describe("失効", () => {
  it("どの提供元を失効させるかが、ボタンに書いてある", () => {
    render(<RevokeLlmKeyForm providerId="anthropic" label="見本の提供元" />);
    expect(screen.getByRole("button").textContent).toContain("見本の提供元");
  });

  it("押すと失効として送られ、結果が出る", async () => {
    actionResult = { status: "done", message: "失効させました。" };
    const { container } = render(<RevokeLlmKeyForm providerId="anthropic" label="見本" />);
    await submit(container.querySelector("form") as HTMLFormElement);
    expect(sent[0]?.get("intent")).toBe("revoke");
    expect(screen.getByText("失効させました。")).toBeTruthy();
  });

  it("失効できなかったときは、理由が出る", async () => {
    actionResult = { status: "failed", message: "権限がありません。" };
    const { container } = render(<RevokeLlmKeyForm providerId="anthropic" label="見本" />);
    await submit(container.querySelector("form") as HTMLFormElement);
    expect(screen.getByText("権限がありません。")).toBeTruthy();
  });
});
