// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KEY_SCOPES, KEY_SCOPE_LABELS } from "@/domain/feedback";
import { describeViolations, findA11yViolations } from "../support/a11y";

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
 */

vi.mock("@/presentation/admin/feedback-action", () => ({
  changeFeedbackStatusAction: async () => ({ status: "idle", message: "" }),
  handOffFeedbackAction: async () => ({
    status: "idle",
    message: "",
    prompts: [],
    skipped: [],
    idempotencyText: "",
    previewOnly: false,
  }),
  manageIntegrationAccessAction: async () => ({
    status: "idle",
    message: "",
    issuedValue: null,
  }),
}));

const {
  FeedbackDispositionForm,
  FeedbackHandoffForm,
  FeedbackPullCommand,
  FeedbackStatusForm,
} = await import("@/presentation/admin/feedback-forms");
const { IssueIntegrationAccessForm, RevokeIntegrationAccessForm } = await import(
  "@/presentation/admin/integration-access-form"
);

afterEach(cleanup);

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

describe("取りに来てもらう案内", () => {
  it("鍵の値ではなく、手元の環境変数を指すコマンドを出す", () => {
    render(<FeedbackPullCommand />);

    const shown = document.body.textContent ?? "";
    expect(shown).toContain("$AFFILIATE_HUB_FEEDBACK_KEY");
    expect(shown).toContain("/api/feedback/pending");
    // 値そのものを書かせる形にしない
    expect(shown).toContain("ファイルに書いたりしないでください");
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
    const violations = await findA11yViolations(container.innerHTML);
    expect(violations, describeViolations(violations)).toHaveLength(0);
  });
});
