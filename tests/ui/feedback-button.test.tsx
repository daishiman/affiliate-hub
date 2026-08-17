/** @tier 2 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BRAND_THEMES, COLOR_MODES } from "@/domain/authoring/site-blueprint";
import { appearanceAttributes } from "@/presentation/ui/appearance";
import { UI_COPY } from "@/presentation/ui/copy";
import {
  FeedbackButton,
  type FeedbackSubmission,
} from "@/presentation/ui/patterns/feedback-button";
import { describeViolations, findA11yViolations } from "../support/a11y";

/**
 * 改善したいことを送るボタン。
 *
 * --- ここで固定したいこと ---
 *
 * 1. **権限を持たない人には何も出ない。** 出しておいて押したら断る、にしない。
 * 2. **文章だけで必ず送れる。** 画面の写しを撮れない環境は普通にある。
 *    撮れないことを理由に送れなくすると、そこで諦められる。
 * 3. **何が一緒に送られるかを、送る前に見せている。**
 * 4. 送ったあとに、送れたことが分かる。
 *
 * 3 と 4 は文言が消えても型は通る。だから出力を見る。
 */

afterEach(cleanup);

function submissions(): {
  readonly calls: FeedbackSubmission[];
  readonly onSubmit: (s: FeedbackSubmission) => Promise<{ message: string }>;
} {
  const calls: FeedbackSubmission[] = [];
  return {
    calls,
    onSubmit: async (s) => {
      calls.push(s);
      return { message: UI_COPY.feedback.sent };
    },
  };
}

function mount(canSubmit = true) {
  const { calls, onSubmit } = submissions();
  render(
    <FeedbackButton screenName="順位表" route="/admin/rankings" canSubmit={canSubmit} onSubmit={onSubmit} />,
  );
  return calls;
}

function openDialog(): void {
  fireEvent.click(screen.getByRole("button", { name: UI_COPY.feedback.openButton }));
}

describe("出す・出さない", () => {
  it("権限が無い人には、ボタンごと出ない", () => {
    mount(false);
    expect(screen.queryByRole("button", { name: UI_COPY.feedback.openButton })).toBeNull();
  });

  it("権限がある人には、押せるボタンが出る", () => {
    mount(true);
    expect(screen.getByRole("button", { name: UI_COPY.feedback.openButton })).not.toBeNull();
  });
});

describe("送る", () => {
  it("いま開いている画面の名前が、書かせずに入っている", () => {
    mount();
    openDialog();
    // 画面名を人に書かせると表記がばらつき、あとで同じ画面の要望をまとめられない。
    expect(screen.getByText(/順位表/)).not.toBeNull();
  });

  it("何が一緒に送られるかを、送る前に出している", () => {
    mount();
    openDialog();
    expect(screen.getByText(UI_COPY.feedback.disclosureBody)).not.toBeNull();
  });

  it("画像を付けなくても送れて、そのとき capture は空になる", async () => {
    const calls = mount();
    openDialog();
    fireEvent.change(screen.getByLabelText(UI_COPY.feedback.bodyLabel), {
      target: { value: "並び替えが効いているか分かりません。" },
    });
    fireEvent.click(screen.getByRole("button", { name: UI_COPY.feedback.submit }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.body).toBe("並び替えが効いているか分かりません。");
    expect(calls[0]?.capture).toBeNull();
    expect(calls[0]?.origin.screenName).toBe("順位表");
    // 送れたことを画面で伝える。無言で閉じると、送れたのか分からない。
    await waitFor(() => expect(screen.getByText(UI_COPY.feedback.sent)).not.toBeNull());
  });

  it("「どうなってほしいか」は空のままでも送れる", async () => {
    const calls = mount();
    openDialog();
    fireEvent.change(screen.getByLabelText(UI_COPY.feedback.bodyLabel), {
      target: { value: "受信箱が白いままです。" },
    });
    fireEvent.click(screen.getByRole("button", { name: UI_COPY.feedback.submit }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.wish).toBe("");
  });

  it("改善したいことが空なら送らず、何を書けばよいか伝える", () => {
    const calls = mount();
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: UI_COPY.feedback.submit }));
    expect(calls).toHaveLength(0);
    expect(screen.getByText(/「改善したいこと」を書いてください。/)).not.toBeNull();
  });

  it("写しを撮れない環境では、断ったうえで文章の道を残す", () => {
    // `getDisplayMedia` を持たない環境（古い端末・許可されていない場面）を作る。
    vi.stubGlobal("navigator", { ...window.navigator, mediaDevices: {} });
    mount();
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: UI_COPY.feedback.captureTake }));
    expect(screen.getByText(UI_COPY.feedback.captureUnavailable)).not.toBeNull();
    // 送るボタンは生きたまま。撮れないことは送れないことではない。
    expect(screen.getByRole("button", { name: UI_COPY.feedback.submit }).hasAttribute("disabled")).toBe(
      false,
    );
    vi.unstubAllGlobals();
  });
});

describe("読み上げと配色", () => {
  it("開いた状態に、機械で分かる読み上げの問題が無い", async () => {
    mount();
    openDialog();
    const violations = await findA11yViolations(
      `<main><h1>順位表</h1>${document.body.innerHTML}</main>`,
    );
    expect(describeViolations(violations)).toBe("");
  });

  it("配色 5 種 × 明暗 3 種のどれでも、同じ中身が出る", () => {
    // 見た目はトークン側が解く。**部品側で配色ごとに出し分けない**ことの実測。
    // 出し分けると、配色を 1 つ足すたびに部品を直すことになる。
    for (const brandTheme of BRAND_THEMES) {
      for (const colorMode of COLOR_MODES) {
        cleanup();
        const attrs = appearanceAttributes({ brandTheme, colorMode });
        for (const [name, value] of Object.entries(attrs)) {
          document.documentElement.setAttribute(name, String(value));
        }
        mount();
        expect(
          screen.getByRole("button", { name: UI_COPY.feedback.openButton }),
          `${brandTheme} / ${colorMode} でボタンが出ていません`,
        ).not.toBeNull();
      }
    }
  });
});
