/** @tier 2 */
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KEY_SCOPES, KEY_SCOPE_LABELS } from "@/domain/feedback";
import { asPartOfPage, describeViolations, findA11yViolations } from "../support/a11y";

/**
 * 改善要望を扱う側の操作部品。
 *
 * --- 押した先はここでは呼ばない ---
 *
 * 押した結果（回数が増える・扱いが戻る）は
 * `tests/presentation/feedback-actions.test.ts` が本物の道で確かめている。
 * ここで見るのは**画面に何が出ているか**だけ。両方で同じことを見ると、
 * 直したときに 2 か所直すことになり、片方が必ず古くなる。
 *
 * --- 鍵の値が画面に出ないことを見る ---
 *
 * 取りに来てもらう案内は、鍵そのものではなく手元の環境変数を指す。
 * ここに値が出ると、この画面を開ける人全員がその鍵を使えることになる。
 * 文言は消えても型は通るので、出力そのものを見る。
 *
 * --- 押した後の見た目まで見る ---
 *
 * 成功・失敗・欄ごとの指摘は、**利用者が最も多く見る状態**でありながら
 * 手で開かれる回数が最も少ない。押す前の姿だけを固定すると、
 * 「送ったのに何も出ない」画面が誰にも気づかれずに公開される。
 * 返り値だけを差し替え、囲いと表示は本物を通す。
 */

/** 差し替えた操作が返す値。試験ごとに書き換える（囲いの側は本物）。 */
let statusResult: unknown = { status: "idle", message: "" };
let handoffResult: unknown = {
  status: "idle",
  message: "",
  prompts: [],
  skipped: [],
  idempotencyText: "",
  previewOnly: false,
};
let accessResult: unknown = { status: "idle", message: "", issuedValue: null };

vi.mock("@/presentation/admin/feedback-action", () => ({
  changeFeedbackStatusAction: async () => statusResult,
  handOffFeedbackAction: async () => handoffResult,
  manageIntegrationAccessAction: async () => accessResult,
}));

const {
  FeedbackDispositionForm,
  FeedbackHandoffForm,
  FeedbackPullCommand,
  FeedbackStatusForm,
} = await import("@/presentation/admin/maintain/feedback-forms");
const { IssueIntegrationAccessForm, RevokeIntegrationAccessForm } = await import(
  "@/presentation/admin/maintain/integration-access-form"
);

afterEach(cleanup);

beforeEach(() => {
  statusResult = { status: "idle", message: "" };
  handoffResult = {
    status: "idle",
    message: "",
    prompts: [],
    skipped: [],
    idempotencyText: "",
    previewOnly: false,
  };
  accessResult = { status: "idle", message: "", issuedValue: null };
});

/** 囲いを 1 回送る。押した後の見た目はここを通らないと出ない。 */
async function submit(container: HTMLElement): Promise<void> {
  const form = container.querySelector("form");
  if (form === null) throw new Error("囲いが見つかりませんでした");
  await act(async () => {
    fireEvent.submit(form);
  });
}

describe("まとめて渡す囲い", () => {
  it("下読みと払い出しが別のボタンになっている", () => {
    render(
      <FeedbackHandoffForm>
        <input type="hidden" name="ids" value="fb_sample_sort" />
      </FeedbackHandoffForm>,
    );

    const preview = screen.getByRole("button", { name: /指示文を見る/ });
    const handoff = screen.getByRole("button", { name: /払い出し|渡した|済み/ });
    expect(preview).not.toBe(handoff);
    // どちらを押したかがサーバー側で分かれる必要がある
    expect(preview.getAttribute("value")).toBe("preview");
    expect(handoff.getAttribute("value")).toBe("handoff");
  });

  it("選ぶための行は、渡した側（画面）がそのまま出る", () => {
    render(
      <FeedbackHandoffForm>
        <label>
          <input type="checkbox" name="ids" value="fb_sample_sort" />
          fb_sample_sort を渡す
        </label>
      </FeedbackHandoffForm>,
    );

    expect(screen.getByRole("checkbox", { name: /fb_sample_sort/ })).toBeTruthy();
  });
});

describe("渡した後に出るもの", () => {
  it("下読みでは、指示文と「渡していない」ことが同時に出る", async () => {
    handoffResult = {
      status: "done",
      message: "指示文を出しました（まだ渡していません）。",
      previewOnly: true,
      idempotencyText: "同じ要望からは、何度出しても同じ文になります。",
      skipped: [],
      prompts: [
        {
          reportId: "fb_sample_sort",
          text: "順位表の並び替えが効いているか分からない、という要望です。",
          templateVersion: "handoff-2026-08",
          fingerprint: "abc123",
        },
      ],
    };

    const { container } = render(
      <FeedbackHandoffForm>
        <input type="hidden" name="ids" value="fb_sample_sort" />
      </FeedbackHandoffForm>,
    );
    await submit(container);

    // 文面は画面にも出す。クリップボードが使えない環境で行き止まりにしないため。
    expect(screen.getByRole("textbox", { name: /fb_sample_sort の指示文/ })).toBeTruthy();
    const shown = document.body.textContent ?? "";
    expect(shown).toContain("まだ渡していません");
    expect(shown).toContain("handoff-2026-08");
  });

  it("渡せなかったものは、理由つきで画面にも出る", async () => {
    handoffResult = {
      status: "done",
      message: "1 件渡しました。",
      previewOnly: false,
      idempotencyText: "何度渡しても同じ内容です。",
      skipped: [{ reportId: "fb_does_not_exist", reason: "この要望は見つかりませんでした。" }],
      prompts: [],
    };

    const { container } = render(
      <FeedbackHandoffForm>
        <input type="hidden" name="ids" value="fb_does_not_exist" />
      </FeedbackHandoffForm>,
    );
    await submit(container);

    const shown = document.body.textContent ?? "";
    expect(shown).toContain("fb_does_not_exist は渡せませんでした");
    expect(shown).toContain("見つかりませんでした");
  });

  it("何も選ばずに押したときは、理由だけが出て指示文は出ない", async () => {
    handoffResult = {
      status: "failed",
      message: "渡すものを選んでください。",
      previewOnly: false,
      idempotencyText: "",
      skipped: [],
      prompts: [],
    };

    const { container } = render(
      <FeedbackHandoffForm>
        <span>選ぶ行はここ</span>
      </FeedbackHandoffForm>,
    );
    await submit(container);

    expect((document.body.textContent ?? "")).toContain("渡すものを選んでください");
    expect(screen.queryByRole("textbox", { name: /指示文/ })).toBeNull();
  });
});

describe("状態と扱いの結果表示", () => {
  it("欄の指摘は、その欄のそばに出る（下にまとめて出さない）", async () => {
    statusResult = {
      status: "failed",
      field: "status",
      message: "知らない状態です。一覧から選んでください。",
    };

    const { container } = render(
      <FeedbackStatusForm id="fb_sample_sort" currentStatus="未対応" />,
    );
    await submit(container);

    const select = screen.getByRole("combobox", { name: /変更後の状態/ });
    const described = select.getAttribute("aria-describedby") ?? "";
    expect(described, "指摘が読み上げで欄と結びついていません").not.toBe("");
    expect((document.body.textContent ?? "")).toContain("知らない状態です");
  });

  it("どの欄とも言えない失敗は、囲いの下に 1 つだけ出る", async () => {
    statusResult = { status: "failed", message: "この操作は許可されていません。" };

    const { container } = render(
      <FeedbackStatusForm id="fb_sample_sort" currentStatus="未対応" />,
    );
    await submit(container);

    expect((document.body.textContent ?? "")).toContain("許可されていません");
  });

  it("扱いを取り消せたことが、その場に出る", async () => {
    statusResult = { status: "done", message: "扱いを取り消しました。" };

    const { container } = render(
      <FeedbackDispositionForm id="fb_sample_sort" dispositionLabel="対応しない" />,
    );
    await submit(container);

    expect((document.body.textContent ?? "")).toContain("取り消しました");
  });

  it("「重複」を選んだときだけ、どれと同じかを聞く", () => {
    render(<FeedbackDispositionForm id="fb_sample_sort" dispositionLabel={null} />);

    // 選ぶ前は出さない。使わない欄を先に見せると、必須だと思われる。
    expect(screen.queryByRole("textbox", { name: /どの要望と同じか/ })).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: /扱い/ }), {
      target: { value: "duplicate" },
    });
    expect(screen.getByRole("textbox", { name: /どの要望と同じか/ })).toBeTruthy();
  });
});

describe("取りに来てもらう案内", () => {
  it("鍵の値ではなく、手元の環境変数を指すコマンドを出す", () => {
    render(<FeedbackPullCommand />);

    const shown = document.body.textContent ?? "";
    expect(shown).toContain("$AFFILIATE_HUB_FEEDBACK_KEY");
    expect(shown).toContain("/api/feedback/pending");
    // 値そのものを書かせる形にしない
    expect(shown).toContain("ファイルに書いたりしないでください");
  });

  it("コピーできたときは、できたと言う", async () => {
    // 呼ばれた回数ではなく、**手元に渡った文字列**を見る。回数は利用者に見えない。
    const copied: string[] = [];
    const writeText = async (text: string): Promise<void> => {
      copied.push(text);
    };
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    render(<FeedbackPullCommand />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /コピー/ }));
    });

    expect((document.body.textContent ?? "")).toContain("コピーしました");
    expect(copied.join("\n")).toContain("/api/feedback/pending");
  });

  it("コピーが使えない環境では、行き止まりにせず画面の文へ誘導する", async () => {
    // 押しても何も起きないボタンは、壊れているのか自分の操作が悪いのか分からない。
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });

    render(<FeedbackPullCommand />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /コピー/ }));
    });

    expect((document.body.textContent ?? "")).toContain("下の文をそのまま選んでコピー");
  });

  it("コピーが途中で断られたときも、同じ逃げ道を出す", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("書き込みが許可されていません");
        },
      },
      configurable: true,
    });

    render(<FeedbackPullCommand />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /コピー/ }));
    });

    expect((document.body.textContent ?? "")).toContain("コピーできませんでした");
  });
});

describe("状態と扱いの操作", () => {
  it("いまの状態を先に出してから、変更後を選ばせる", () => {
    render(<FeedbackStatusForm id="fb_sample_sort" currentStatus="未対応" />);

    expect((document.body.textContent ?? "")).toContain("いまは「未対応」です。");
    expect(screen.getByRole("combobox", { name: /変更後の状態/ })).toBeTruthy();
  });

  it("扱いが決まっていなければ、決めるための欄を出す", () => {
    render(<FeedbackDispositionForm id="fb_sample_sort" dispositionLabel={null} />);

    expect(screen.getByRole("combobox", { name: /扱い/ })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /そう扱う理由/ })).toBeTruthy();
  });

  it("扱いが決まっていれば、同じ場所に取り消しを出す", () => {
    render(<FeedbackDispositionForm id="fb_sample_sort" dispositionLabel="対応しない" />);

    expect(screen.getByRole("button", { name: /取り消して元に戻す/ })).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: /扱い/ })).toBeNull();
  });
});

describe("鍵の発行と失効", () => {
  it("できることを 1 つずつ選ばせる（既定は読むだけ）", () => {
    render(<IssueIntegrationAccessForm />);

    for (const scope of KEY_SCOPES) {
      expect(screen.getByRole("checkbox", { name: new RegExp(KEY_SCOPE_LABELS[scope]) })).toBeTruthy();
    }
    const read = screen.getByRole("checkbox", {
      name: new RegExp(KEY_SCOPE_LABELS.read),
    }) as HTMLInputElement;
    expect(read.checked).toBe(true);
  });

  it("押す前に、どの鍵が失効するかが分かる", () => {
    render(<RevokeIntegrationAccessForm id="ik_1" label="手元の Claude Code" />);

    expect(screen.getByRole("button", { name: /「手元の Claude Code」を失効させる/ })).toBeTruthy();
  });

  it("読み上げでも使える（発行の欄）", async () => {
    const { container } = render(<IssueIntegrationAccessForm />);
    const violations = await findA11yViolations(asPartOfPage(container.innerHTML));
    expect(violations, describeViolations(violations)).toHaveLength(0);
  });
});
